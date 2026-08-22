const DEFAULT_AI_GATEWAY_ID = "test";
const DEFAULT_ROUTE_FAMILY = "expert-panel";
const DEFAULT_MODEL_SOURCE_POLICY = "dynamic-all-available-within-approved-sources";
const MAX_CUSTOM_METADATA = 5;
const HARD_MAX_LANES = 8;
const DEFAULT_SHARDS = [
  {key:"lanes-1-2",min:1,max:2},
  {key:"lanes-3-4",min:3,max:4},
  {key:"lanes-5-6",min:5,max:6},
  {key:"lanes-7-8",min:7,max:8}
];

function configurationError(message, status = 503) {return Object.assign(new Error(message), { status });}
function normalize(value) {return String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");}
function laneNumber(value){const lane=Math.trunc(Number(value));if(!Number.isFinite(lane)||lane<1||lane>HARD_MAX_LANES)throw configurationError("AI_GATEWAY_ROUTE_LANE_INVALID",500);return lane;}
function defaultRegistry(family = DEFAULT_ROUTE_FAMILY) {return {schema:"expert-route-registry-v4.2-lane-pair",default:"lanes-1-2",routes:Object.fromEntries(DEFAULT_SHARDS.map(s=>[s.key,`${family}-${s.key}-v1`])),lane_ranges:DEFAULT_SHARDS.map(s=>({min:s.min,max:s.max,route:s.key})),rules:[]};}
function validateRegistry(raw, family) {
  if (!raw || typeof raw !== "object") throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_INVALID", 500);
  const routes=raw.routes&&typeof raw.routes==="object"?raw.routes:{},normalizedRoutes={};
  for(const[key,value]of Object.entries(routes)){const k=normalize(key),route=String(value||"").trim();if(k&&route)normalizedRoutes[k]=route;}
  if(!Object.keys(normalizedRoutes).length)throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_EMPTY",500);
  const rules=Array.isArray(raw.rules)?raw.rules.map(rule=>({field:normalize(rule?.field),values:Array.isArray(rule?.values)?rule.values.map(normalize).filter(Boolean):[],route:normalize(rule?.route)})).filter(rule=>rule.field&&rule.route&&normalizedRoutes[rule.route]):[];
  const laneRanges=Array.isArray(raw.lane_ranges)?raw.lane_ranges.map(x=>({min:Math.trunc(Number(x?.min)),max:Math.trunc(Number(x?.max)),route:normalize(x?.route)})).filter(x=>Number.isFinite(x.min)&&Number.isFinite(x.max)&&x.min>=1&&x.max<=HARD_MAX_LANES&&x.min<=x.max&&normalizedRoutes[x.route]):[];
  if(laneRanges.length){const covered=new Set();for(const x of laneRanges)for(let n=x.min;n<=x.max;n++){if(covered.has(n))throw configurationError("AI_GATEWAY_ROUTE_LANE_RANGE_OVERLAP",500);covered.add(n)}}
  const fallback=normalize(raw.default||Object.keys(normalizedRoutes)[0]);
  if(!normalizedRoutes[fallback])throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_DEFAULT_INVALID",500);
  return{schema:String(raw.schema||"expert-route-registry-v4.2"),family,default:fallback,routes:normalizedRoutes,lane_ranges:laneRanges,rules};
}
export function aiGatewayId(env){return String(env?.AI_GATEWAY_ID||DEFAULT_AI_GATEWAY_ID).trim();}
export function aiGatewayRouteFamily(env){return String(env?.AI_GATEWAY_ROUTE_FAMILY||DEFAULT_ROUTE_FAMILY).trim();}
export function routeRegistry(env={}){const family=aiGatewayRouteFamily(env),configured=String(env?.AI_GATEWAY_ROUTE_REGISTRY||"").trim();if(!configured)return validateRegistry(defaultRegistry(family),family);try{return validateRegistry(JSON.parse(configured),family)}catch(error){if(error?.message?.startsWith("AI_GATEWAY_ROUTE_"))throw error;throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_BAD_JSON",500)}}
export function routeShardForMetadata(metadata={},registry=null){const active=registry||validateRegistry(defaultRegistry(DEFAULT_ROUTE_FAMILY),DEFAULT_ROUTE_FAMILY);if(active.lane_ranges?.length){const lane=laneNumber(metadata?.lane),match=active.lane_ranges.find(x=>lane>=x.min&&lane<=x.max);if(!match)throw configurationError("AI_GATEWAY_ROUTE_LANE_UNMAPPED",500);return match.route}for(const rule of active.rules){const value=normalize(metadata?.[rule.field]);if(rule.values.includes(value))return rule.route;}return active.default;}
export function aiGatewayRouteForMetadata(env,metadata={}){const registry=routeRegistry(env),key=routeShardForMetadata(metadata,registry),route=registry.routes[key];if(!route)throw configurationError("AI_GATEWAY_ROUTE_NOT_REGISTERED",500);return route;}
export function aiGatewayConfigured(env){return Boolean(aiGatewayId(env)&&aiGatewayRouteFamily(env)&&String(env?.CLOUDFLARE_ACCOUNT_ID||"").trim()&&String(env?.AI_GATEWAY_TOKEN||"").trim());}
export async function dynamicChatEndpoint(env){const gatewayId=aiGatewayId(env),accountId=String(env?.CLOUDFLARE_ACCOUNT_ID||"").trim();if(!gatewayId||!aiGatewayRouteFamily(env)||!accountId||!String(env?.AI_GATEWAY_TOKEN||"").trim())throw configurationError("AI_GATEWAY_NOT_CONFIGURED");return`https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(gatewayId)}/compat/chat/completions`;}
export function dynamicRouteModel(env,metadata=null){if(!metadata||typeof metadata!=="object")throw configurationError("AI_GATEWAY_ROUTE_METADATA_REQUIRED",500);return`dynamic/${aiGatewayRouteForMetadata(env,metadata)}`;}
export function routeMetadata(_env,metadata={}){const entries=Object.entries(metadata).filter(([,value])=>value!==undefined&&value!==null);if(entries.length<1||entries.length>MAX_CUSTOM_METADATA)throw configurationError("AI_GATEWAY_METADATA_LIMIT_MISMATCH",500);return Object.fromEntries(entries.map(([key,value])=>[String(key),String(value)]));}
export function aiGatewayRequestHeaders(env,timeoutMs,metadata={}){const boundedTimeout=Math.max(1,Math.trunc(Number(timeoutMs)||1)),token=String(env?.AI_GATEWAY_TOKEN||"").trim();if(!token)throw configurationError("AI_GATEWAY_NOT_CONFIGURED");const attempts=Math.max(1,Math.min(3,Math.trunc(Number(env?.AI_GATEWAY_MAX_ATTEMPTS||1)||1))),headers={"cf-aig-authorization":`Bearer ${token}`,"cf-aig-max-attempts":String(attempts),"cf-aig-request-timeout":String(boundedTimeout),"cf-aig-metadata":JSON.stringify(routeMetadata(env,metadata)),"cf-aig-collect-log":"true","cf-aig-collect-log-payload":"false","cf-aig-skip-cache":"true"};if(attempts>1){headers["cf-aig-retry-delay"]="250";headers["cf-aig-backoff"]="exponential"}return headers;}
export function aiGatewayDescriptor(env){const registry=routeRegistry(env);return{id:aiGatewayId(env),route:null,legacy_route:false,route_family:aiGatewayRouteFamily(env),route_registry_schema:registry.schema,route_shards:Object.keys(registry.routes),route_selection:registry.lane_ranges?.length?"global-lane-pair":"registry-rules",max_global_lanes:HARD_MAX_LANES,max_lanes_per_route:2,configured:aiGatewayConfigured(env),authenticated_gateway:true,provider:"dynamic",inference_transport:"cloudflare-ai-gateway-dynamic-route",model_source_policy:String(env?.MODEL_SOURCE_POLICY||DEFAULT_MODEL_SOURCE_POLICY).trim(),allowed_model_sources:["workers-ai","openrouter","deepseek","huggingface"],provider_key_sources:["openrouter","deepseek","huggingface"],keyless_model_sources:["workers-ai"],model_selection:"live-catalog-ranked",model_id_pinning:false,future_models_auto_discover:true,company_identity:"model-owner",upstream_keys:"cloudflare-byok-openrouter-deepseek-huggingface-plus-workers-ai",cache:"bypass-per-expert-request",request_logging:"metadata-only-no-payload",gateway_observability:true,gateway_request_timeout:true,gateway_retry_headers:Math.max(1,Math.min(3,Math.trunc(Number(env?.AI_GATEWAY_MAX_ATTEMPTS||1)||1)))>1,gateway_dynamic_route_conditions:["lane","stage","depth","capability","cost_mode"],worker_retries:0,dynamic_routing:true,registry_driven_routing:true,legacy_base_route_removed:true,custom_metadata_limit:MAX_CUSTOM_METADATA,routed_metadata_max:MAX_CUSTOM_METADATA};}
