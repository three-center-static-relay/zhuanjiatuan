import guarded, { CenterGate } from "./guard.js";
import { runGovernanceRelay } from "./governance-relay.js";

export { CenterGate };

const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/v1/governance-assist") {
      if (url.hostname !== "expert.internal") {
        return json({ ok: false, error: "POLICY_DENIED", message: "governance relay is service-binding internal only" }, 403);
      }
      return runGovernanceRelay(request, env);
    }
    return guarded.fetch(request, env, ctx);
  }
};
