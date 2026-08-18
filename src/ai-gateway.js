// Cloudflare build-path marker: maintenance-small-flow-rescue-v1
const DEFAULT_AI_GATEWAY_ID = "test";
const DEFAULT_DYNAMIC_ROUTE = "expert-panel-v1";
const DEFAULT_ROUTE_FAMILY = "expert-panel";
const MAX_CUSTOM_METADATA = 5;

function configurationError(message, status = 503) {
  return Object.assign(new Error(message), { status });
}

export function aiGatewayId(env) {
  return String(env?.AI_GATEWAY_ID || DEFAULT_AI_GATEWAY_ID).trim();
}

export function aiGatewayRoute(env) {
  return String(env?.AI_GATEWAY_ROUTE || DEFAULT_DYNAMIC_ROUTE).trim();
}

export function aiGatewayRouteFamily(env) {
  const explicit = String(env?.AI_GATEWAY_ROUTE_FAMILY || "").trim();
  if (explicit) return explicit;
  const base = aiGatewayRoute(env);
  const derived = base.replace(/-(?:legacy-)?v\d+$/i, "").trim();
  return derived || DEFAULT_ROUTE_FAMILY;
}

export function routeShardForMetadata(metadata = {}) {
  const stage = String(metadata?.stage || "").trim().toLowerCase();
  const capability = String(metadata?.capability || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (["planner", "judge", "meta-judge", "governance"].includes(stage)) return "plan";
  if (["coding", "quantitative"].includes(capability)) return "code";
  if (["legal", "medical", "finance"].includes(capability)) return "regulated";
  if (["research", "evidence", "synthesis"].includes(capability)) return "research";
  if (["risk", "strategy", "systems", "adversarial", "forecasting"].includes(capability)) return "strategy";
  if (capability === "creative") return "creative";
  return "general";
}

export function aiGatewayRouteForMetadata(env, metadata = {}) {
  const family = aiGatewayRouteFamily(env);
  if (!family) throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  return `${family}-${routeShardForMetadata(metadata)}-v1`;
}

export function aiGatewayConfigured(env) {
  return Boolean(
    aiGatewayId(env) &&
    aiGatewayRoute(env) &&
    aiGatewayRouteFamily(env) &&
    String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim() &&
    String(env?.AI_GATEWAY_TOKEN || "").trim()
  );
}

export async function dynamicChatEndpoint(env) {
  const gatewayId = aiGatewayId(env);
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!gatewayId || !aiGatewayRoute(env) || !aiGatewayRouteFamily(env) || !accountId || !String(env?.AI_GATEWAY_TOKEN || "").trim()) {
    throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  }
  return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(gatewayId)}/compat/chat/completions`;
}

export function dynamicRouteModel(env, metadata = null) {
  const route = metadata ? aiGatewayRouteForMetadata(env, metadata) : aiGatewayRoute(env);
  if (!route) throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  return `dynamic/${route}`;
}

export function routeMetadata(_env, metadata = {}) {
  const entries = Object.entries(metadata).filter(([,value]) => value !== undefined && value !== null);
  if (entries.length !== MAX_CUSTOM_METADATA) throw configurationError("AI_GATEWAY_METADATA_LIMIT_MISMATCH", 500);
  return Object.fromEntries(entries.map(([key,value]) => [String(key), String(value)]));
}

export function aiGatewayRequestHeaders(env, timeoutMs, metadata = {}) {
  const boundedTimeout = Math.max(1, Math.trunc(Number(timeoutMs) || 1));
  const token = String(env?.AI_GATEWAY_TOKEN || "").trim();
  if (!token) throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  return {
    "cf-aig-authorization": `Bearer ${token}`,
    "cf-aig-max-attempts": "1",
    "cf-aig-request-timeout": String(boundedTimeout),
    "cf-aig-metadata": JSON.stringify(routeMetadata(env, metadata))
  };
}

export function aiGatewayDescriptor(env) {
  return {
    id: aiGatewayId(env),
    route: aiGatewayRoute(env),
    route_family: aiGatewayRouteFamily(env),
    route_shards: ["plan","general","code","regulated","research","strategy","creative"],
    configured: aiGatewayConfigured(env),
    authenticated_gateway: true,
    provider: "dynamic",
    inference_transport: "cloudflare-ai-gateway-dynamic-route",
    upstream_keys: "cloudflare-byok",
    cache: "gateway-default",
    request_logging: "gateway-default",
    worker_retries: 0,
    dynamic_routing: true,
    sharded_dynamic_routing: true,
    custom_metadata_limit: MAX_CUSTOM_METADATA,
    routed_metadata: ["stage","lane","capability","depth","cost_mode"]
  };
}
