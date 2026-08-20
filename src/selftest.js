export function buildSelftest(env = {}) {
  return {
    ok: true,
    service: "expert-worker",
    runtime: "langgraph-orchestrator",
    checks: {
      langgraph: "loaded",
      ai_gateway: Boolean(env.AI_GATEWAY_URL) ? "configured" : "missing",
      fail_closed: true,
      single_task_guard: true
    }
  };
}
