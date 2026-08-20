export function evaluatePromotionGate({
  selftest = {},
  capability = {},
  runtime = {},
  gatewayConfigured = false
} = {}) {
  const checks = {
    selftest: selftest.ok === true,
    capability: capability.ok === true,
    runtime: runtime.ok === true,
    gateway: gatewayConfigured === true
  };

  const passed = Object.values(checks).every(Boolean);

  return {
    status: passed ? "promotable" : "blocked",
    production_ready: passed,
    fail_closed: true,
    checks
  };
}
