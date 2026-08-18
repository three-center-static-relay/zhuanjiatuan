import assert from "node:assert/strict";
import {
  aiGatewayConfigured,
  aiGatewayDescriptor,
  aiGatewayRequestHeaders,
  openRouterChatEndpoint
} from "../src/ai-gateway.js";

const env = {
  AI_GATEWAY_ID: "four-center-ai-gateway",
  CLOUDFLARE_ACCOUNT_ID: "account",
  AI_GATEWAY_TOKEN: "test-gateway-token"
};

assert.equal(aiGatewayConfigured(env), true);
assert.equal(
  await openRouterChatEndpoint(env),
  "https://gateway.ai.cloudflare.com/v1/account/four-center-ai-gateway/openrouter/chat/completions"
);
const headers = aiGatewayRequestHeaders(env, 45000);
assert.equal(headers["cf-aig-authorization"], "Bearer test-gateway-token");
assert.equal(headers["cf-aig-skip-cache"], "true");
assert.equal(headers["cf-aig-collect-log"], "false");
assert.equal(headers["cf-aig-max-attempts"], "1");
assert.equal(headers["cf-aig-request-timeout"], "45000");
assert.deepEqual(JSON.parse(headers["cf-aig-metadata"]), { center: "expert", route: "model-inference" });

assert.deepEqual(aiGatewayDescriptor(env), {
  id: "four-center-ai-gateway",
  configured: true,
  authenticated_gateway: true,
  provider: "openrouter",
  inference_transport: "cloudflare-ai-gateway-openrouter",
  catalog_transport: "openrouter-direct-metadata-only",
  cache: false,
  request_logging: false,
  gateway_retries: 0
});

await assert.rejects(
  () => openRouterChatEndpoint({ AI_GATEWAY_ID: "four-center-ai-gateway", CLOUDFLARE_ACCOUNT_ID: "account" }),
  error => error?.message === "AI_GATEWAY_NOT_CONFIGURED" && error?.status === 503
);

assert.throws(
  () => aiGatewayRequestHeaders({}, 1000),
  error => error?.message === "AI_GATEWAY_NOT_CONFIGURED" && error?.status === 503
);

console.log(JSON.stringify({ ok: true, suite: "ai-gateway-contract", authenticated_gateway: true }));
