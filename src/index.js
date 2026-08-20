import { createOrchestrator } from "./langgraph-orchestrator.js";
import { routeExpertRequest } from "./ai-gateway-router.js";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const planned = async () => ({ ok: true, status: "planned" });

const orchestrator = createOrchestrator({
  evidence: { plan: planned },
  expert: { plan: async (state) => routeExpertRequest({ request: state.task, env: globalThis.env || {} }) },
  compute: { plan: planned },
  governance: { validateIntent: async () => ({ ok: true }) }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "expert-worker",
        runtime: "langgraph-orchestrator",
        status: "candidate-ai-gateway-ready"
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/run") {
      const input = await request.json().catch(() => null);
      if (!input) return json({ ok: false, error: "INVALID_JSON" }, 400);
      globalThis.env = env;
      return json(await orchestrator.run(input));
    }

    return json({ ok: false, error: "NOT_FOUND" }, 404);
  }
};
