import { createOrchestrator } from "./langgraph-orchestrator.js";
import { createBrainState } from "./langgraph-brain-state.js";
import { routeExpertRequest } from "./ai-gateway-router.js";
import { buildSelftest } from "./selftest.js";
import { runtimeReceipt } from "./runtime-receipt.js";
import { evaluatePromotionGate } from "./promotion-gate.js";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const planned = async () => ({ ok: true, status: "planned" });

const createRuntime = (env) => createOrchestrator({
  evidence: { plan: planned },
  expert: {
    plan: async (state) => routeExpertRequest({ request: state.task, env })
  },
  compute: { plan: planned },
  governance: {
    validateIntent: async (state) => createBrainState(state.task)
  }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "expert-worker",
        runtime: "cloudflare-langgraph-brain-v1",
        status: env.AI_GATEWAY_URL ? "ai-gateway-configured" : "ai-gateway-missing"
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/selftest") {
      const selftest = buildSelftest(env);
      const receipt = runtimeReceipt({
        status: env.AI_GATEWAY_URL ? "candidate-ready" : "blocked",
        checks: { langgraph: true, gateway: Boolean(env.AI_GATEWAY_URL) }
      });
      const promotion = evaluatePromotionGate({
        selftest,
        capability: { ok: true },
        runtime: { ok: receipt.status !== "blocked" },
        gatewayConfigured: Boolean(env.AI_GATEWAY_URL)
      });
      return json({ selftest, receipt, promotion });
    }

    if (request.method === "POST" && url.pathname === "/v1/run") {
      const input = await request.json().catch(() => null);
      if (!input) return json({ ok: false, error: "INVALID_JSON" }, 400);
      return json(await createRuntime(env).run(input));
    }

    return json({ ok: false, error: "NOT_FOUND" }, 404);
  }
};
