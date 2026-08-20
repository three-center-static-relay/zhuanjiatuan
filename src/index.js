import { createOrchestrator } from "./langgraph-orchestrator.js";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const noop = async () => ({ ok: true, status: "planned" });

const orchestrator = createOrchestrator({
  evidence: { plan: noop },
  expert: { plan: noop },
  compute: { plan: noop },
  governance: { validateIntent: async () => ({ ok: true }) }
});

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "expert-worker",
        runtime: "langgraph-orchestrator",
        status: "candidate"
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/run") {
      const input = await request.json().catch(() => null);
      if (!input) return json({ ok: false, error: "INVALID_JSON" }, 400);
      return json(await orchestrator.run(input));
    }

    return json({ ok: false, error: "NOT_FOUND" }, 404);
  }
};
