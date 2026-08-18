const DEFAULT_AI_GATEWAY_ID = "test";
const DEFAULT_DYNAMIC_ROUTE = "expert-panel-v1";
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

export function aiGatewayConfigured(env) {
  return Boolean(
    aiGatewayId(env) &&
    aiGatewayRoute(env) &&
    String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim() &&
    String(env?.AI_GATEWAY_TOKEN || "").trim()
  );
}

export async function dynamicChatEndpoint(env) {
  const gatewayId = aiGatewayId(env);
  const route = aiGatewayRoute(env);
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!gatewayId || !route || !accountId || !String(env?.AI_GATEWAY_TOKEN || "").trim()) {
    throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  }
  return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(gatewayId)}/compat/chat/completions`;
}

export function dynamicRouteModel(env) {
  const route = aiGatewayRoute(env);
  if (!route) throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  return `dynamic/${route}`;
}

export function routeMetadata(metadata = {}) {
  const selected = {
    center: "expert",
    expert_slot: String(metadata?.expert_slot || "").trim(),
    task_domain: String(metadata?.task_domain || "general").trim(),
    reasoning_depth: String(metadata?.reasoning_depth || "standard").trim(),
    context_size: String(metadata?.context_size || "short").trim()
  };
  if (!selected.expert_slot) throw configurationError("AI_GATEWAY_EXPERT_SLOT_REQUIRED", 500);
  if (Object.keys(selected).length > MAX_CUSTOM_METADATA) throw configurationError("AI_GATEWAY_METADATA_LIMIT_EXCEEDED", 500);
  return selected;
}

export function aiGatewayRequestHeaders(env, timeoutMs, metadata = {}) {
  const boundedTimeout = Math.max(1, Math.trunc(Number(timeoutMs) || 1));
  const token = String(env?.AI_GATEWAY_TOKEN || "").trim();
  if (!token) throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  return {
    "cf-aig-authorization": `Bearer ${token}`,
    "cf-aig-max-attempts": "1",
    "cf-aig-request-timeout": String(boundedTimeout),
    "cf-aig-metadata": JSON.stringify(routeMetadata(metadata))
  };
}

export function aiGatewayDescriptor(env) {
  return {
    id: aiGatewayId(env),
    route: aiGatewayRoute(env),
    configured: aiGatewayConfigured(env),
    authenticated_gateway: true,
    provider: "dynamic",
    inference_transport: "cloudflare-ai-gateway-dynamic-route",
    upstream_keys: "cloudflare-byok",
    cache: "gateway-default",
    request_logging: "gateway-default",
    worker_retries: 0,
    dynamic_routing: true,
    custom_metadata_limit: MAX_CUSTOM_METADATA,
    routed_metadata: ["center","expert_slot","task_domain","reasoning_depth","context_size"]
  };
}
