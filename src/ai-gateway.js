const DEFAULT_AI_GATEWAY_ID = "test";
const DEFAULT_ROUTE_FAMILY = "expert-panel";
const MAX_CUSTOM_METADATA = 5;
const ROUTE_KEYS = ["plan","general","code","regulated","research","strategy","creative"];

function configurationError(message, status = 503) {
  return Object.assign(new Error(message), { status });
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function defaultRegistry(family = DEFAULT_ROUTE_FAMILY) {
  return {
    schema: "expert-route-registry-v4.1",
    default: "general",
    routes: Object.fromEntries(ROUTE_KEYS.map(key => [key, `${family}-${key}-v1`])),
    rules: [
      { field: "stage", values: ["planner","judge","meta-judge","governance"], route: "plan" },
      { field: "capability", values: ["coding","quantitative"], route: "code" },
      { field: "capability", values: ["legal","medical","finance"], route: "regulated" },
      { field: "capability", values: ["research","evidence","synthesis"], route: "research" },
      { field: "capability", values: ["risk","strategy","systems","adversarial","forecasting"], route: "strategy" },
      { field: "capability", values: ["creative"], route: "creative" }
    ]
  };
}

function validateRegistry(raw, family) {
  if (!raw || typeof raw !== "object") throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_INVALID", 500);
  const routes = raw.routes && typeof raw.routes === "object" ? raw.routes : {};
  const normalizedRoutes = {};
  for (const [key, value] of Object.entries(routes)) {
    const k = normalize(key);
    const route = String(value || "").trim();
    if (k && route) normalizedRoutes[k] = route;
  }
  if (!Object.keys(normalizedRoutes).length) throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_EMPTY", 500);
  const rules = Array.isArray(raw.rules) ? raw.rules.map(rule => ({
    field: normalize(rule?.field),
    values: Array.isArray(rule?.values) ? rule.values.map(normalize).filter(Boolean) : [],
    route: normalize(rule?.route)
  })).filter(rule => rule.field && rule.route && normalizedRoutes[rule.route]) : [];
  const fallback = normalize(raw.default || "general");
  if (!normalizedRoutes[fallback]) throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_DEFAULT_INVALID", 500);
  return { schema: String(raw.schema || "expert-route-registry-v4.1"), family, default: fallback, routes: normalizedRoutes, rules };
}

export function aiGatewayId(env) {
  return String(env?.AI_GATEWAY_ID || DEFAULT_AI_GATEWAY_ID).trim();
}

export function aiGatewayRouteFamily(env) {
  return String(env?.AI_GATEWAY_ROUTE_FAMILY || DEFAULT_ROUTE_FAMILY).trim();
}

export function routeRegistry(env = {}) {
  const family = aiGatewayRouteFamily(env);
  const configured = String(env?.AI_GATEWAY_ROUTE_REGISTRY || "").trim();
  if (!configured) return validateRegistry(defaultRegistry(family), family);
  try { return validateRegistry(JSON.parse(configured), family); }
  catch (error) {
    if (error?.message?.startsWith("AI_GATEWAY_ROUTE_REGISTRY_")) throw error;
    throw configurationError("AI_GATEWAY_ROUTE_REGISTRY_BAD_JSON", 500);
  }
}

export function routeShardForMetadata(metadata = {}, registry = null) {
  const active = registry || validateRegistry(defaultRegistry(DEFAULT_ROUTE_FAMILY), DEFAULT_ROUTE_FAMILY);
  for (const rule of active.rules) {
    const value = normalize(metadata?.[rule.field]);
    if (rule.values.includes(value)) return rule.route;
  }
  return active.default;
}

export function aiGatewayRouteForMetadata(env, metadata = {}) {
  const registry = routeRegistry(env);
  const key = routeShardForMetadata(metadata, registry);
  const route = registry.routes[key];
  if (!route) throw configurationError("AI_GATEWAY_ROUTE_NOT_REGISTERED", 500);
  return route;
}

export function aiGatewayConfigured(env) {
  return Boolean(
    aiGatewayId(env) &&
    aiGatewayRouteFamily(env) &&
    String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim() &&
    String(env?.AI_GATEWAY_TOKEN || "").trim()
  );
}

export async function dynamicChatEndpoint(env) {
  const gatewayId = aiGatewayId(env);
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!gatewayId || !aiGatewayRouteFamily(env) || !accountId || !String(env?.AI_GATEWAY_TOKEN || "").trim()) {
    throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  }
  return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(gatewayId)}/compat/chat/completions`;
}

export function dynamicRouteModel(env, metadata = null) {
  if (!metadata || typeof metadata !== "object") throw configurationError("AI_GATEWAY_ROUTE_METADATA_REQUIRED", 500);
  return `dynamic/${aiGatewayRouteForMetadata(env, metadata)}`;
}

export function routeMetadata(_env, metadata = {}) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length < 1 || entries.length > MAX_CUSTOM_METADATA) throw configurationError("AI_GATEWAY_METADATA_LIMIT_MISMATCH", 500);
  return Object.fromEntries(entries.map(([key, value]) => [String(key), String(value)]));
}

export function aiGatewayRequestHeaders(env, timeoutMs, metadata = {}) {
  const boundedTimeout = Math.max(1, Math.trunc(Number(timeoutMs) || 1));
  const token = String(env?.AI_GATEWAY_TOKEN || "").trim();
  if (!token) throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  const attempts = Math.max(1, Math.min(3, Math.trunc(Number(env?.AI_GATEWAY_MAX_ATTEMPTS || 1) || 1)));
  return {
    "cf-aig-authorization": `Bearer ${token}`,
    "cf-aig-max-attempts": String(attempts),
    "cf-aig-request-timeout": String(boundedTimeout),
    "cf-aig-metadata": JSON.stringify(routeMetadata(env, metadata))
  };
}

export function aiGatewayDescriptor(env) {
  const registry = routeRegistry(env);
  return {
    id: aiGatewayId(env),
    route: null,
    legacy_route: false,
    route_family: aiGatewayRouteFamily(env),
    route_registry_schema: registry.schema,
    route_shards: Object.keys(registry.routes),
    configured: aiGatewayConfigured(env),
    authenticated_gateway: true,
    provider: "dynamic",
    inference_transport: "cloudflare-ai-gateway-dynamic-route",
    upstream_keys: "cloudflare-byok-or-custom-provider",
    cache: "gateway-default",
    request_logging: "gateway-default",
    worker_retries: 0,
    dynamic_routing: true,
    registry_driven_routing: true,
    legacy_base_route_removed: true,
    custom_metadata_limit: MAX_CUSTOM_METADATA,
    routed_metadata_max: MAX_CUSTOM_METADATA
  };
}
