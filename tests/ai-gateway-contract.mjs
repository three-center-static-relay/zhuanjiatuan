import assert from "node:assert/strict";
import {
  aiGatewayConfigured,
  aiGatewayDescriptor,
  aiGatewayRequestHeaders,
  aiGatewayRoute,
  dynamicChatEndpoint,
  dynamicRouteModel
} from "../src/ai-gateway.js";

const env = {
  AI_GATEWAY_ID: "test",
  AI_GATEWAY_ROUTE: "expert-panel-v1",
  CLOUDFLARE_ACCOUNT_ID: "account",
  AI_GATEWAY_TOKEN: "test-gateway-token"
};

assert.equal(aiGatewayConfigured(env), true);
assert.equal(aiGatewayRoute(env), "expert-panel-v1");
assert.equal(dynamicRouteModel(env), "dynamic/expert-panel-v1");
assert.equal(
  await dynamicChatEndpoint(env),
  "https://gateway.ai.cloudflare.com/v1/account/test/compat/chat/completions"
);
const headers = aiGatewayRequestHeaders(env, 45000, { expert_slot: "expert-1", task_id: "task-1" });
assert.equal(headers["cf-aig-authorization"], "Bearer test-gateway-token");
assert.equal(headers["cf-aig-skip-cache"], undefined);
assert.equal(headers["cf-aig-collect-log"], undefined);
assert.equal(headers["cf-aig-max-attempts"], "1");
assert.equal(headers["cf-aig-request-timeout"], "45000");
assert.deepEqual(JSON.parse(headers["cf-aig-metadata"]), {
  center: "expert",
  dynamic_route: "expert-panel-v1",
  expert_slot: "expert-1",
  task_id: "task-1"
});

assert.deepEqual(aiGatewayDescriptor(env), {
  id: "test",
  route: "expert-panel-v1",
  configured: true,
  authenticated_gateway: true,
  provider: "dynamic",
  inference_transport: "cloudflare-ai-gateway-dynamic-route",
  upstream_keys: "cloudflare-byok",
  cache: "gateway-default",
  request_logging: "gateway-default",
  worker_retries: 0,
  dynamic_routing: true
});

await assert.rejects(
  () => dynamicChatEndpoint({ AI_GATEWAY_ID: "test", AI_GATEWAY_ROUTE: "expert-panel-v1", CLOUDFLARE_ACCOUNT_ID: "account" }),
  error => error?.message === "AI_GATEWAY_NOT_CONFIGURED" && error?.status === 503
);
assert.throws(() => aiGatewayRequestHeaders({}, 1000), error => error?.message === "AI_GATEWAY_NOT_CONFIGURED");

console.log(JSON.stringify({ ok: true, suite: "ai-gateway-contract", authenticated_gateway: true, dynamic_routing: true }));
