export function buildProductionReadiness({ env = {}, checks = {} } = {}) {
  const result = {
    service: "expert-worker",
    runtime: "langgraph-orchestrator",
    checks: {
      runtime: true,
      capability_manifest: Boolean(checks.capability_manifest),
      selftest: Boolean(checks.selftest),
      gateway_configured: Boolean(env.AI_GATEWAY_URL),
      fail_closed: true
    }
  };

  result.production_ready = Object.values(result.checks).every(Boolean);
  return result;
}
