const DEFAULT_AI_GATEWAY_ID = "four-center-ai-gateway";

function configurationError(message, status = 503) {
  return Object.assign(new Error(message), { status });
}

export function aiGatewayId(env) {
  return String(env?.AI_GATEWAY_ID || DEFAULT_AI_GATEWAY_ID).trim();
}

export function aiGatewayConfigured(env) {
  return Boolean(
    aiGatewayId(env) &&
    String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim() &&
    String(env?.AI_GATEWAY_TOKEN || "").trim()
  );
}

export async function openRouterChatEndpoint(env) {
  const gatewayId = aiGatewayId(env);
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!gatewayId || !accountId || !String(env?.AI_GATEWAY_TOKEN || "").trim()) {
    throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  }
  return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(gatewayId)}/openrouter/chat/completions`;
}

export function aiGatewayRequestHeaders(env, timeoutMs) {
  const boundedTimeout = Math.max(1, Math.trunc(Number(timeoutMs) || 1));
  const token = String(env?.AI_GATEWAY_TOKEN || "").trim();
  if (!token) throw configurationError("AI_GATEWAY_NOT_CONFIGURED");
  return {
    "cf-aig-authorization": `Bearer ${token}`,
    "cf-aig-skip-cache": "true",
    "cf-aig-collect-log": "false",
    "cf-aig-max-attempts": "1",
    "cf-aig-request-timeout": String(boundedTimeout),
    "cf-aig-metadata": JSON.stringify({ center: "expert", route: "model-inference" })
  };
}

export function aiGatewayDescriptor(env) {
  return {
    id: aiGatewayId(env),
    configured: aiGatewayConfigured(env),
    authenticated_gateway: true,
    provider: "openrouter",
    inference_transport: "cloudflare-ai-gateway-openrouter",
    catalog_transport: "openrouter-direct-metadata-only",
    cache: false,
    request_logging: false,
    gateway_retries: 0
  };
}
