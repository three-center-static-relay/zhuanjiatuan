export const ERROR_POLICY_VERSION = "expert-error-policy-v1";

export function classifyExpertFailure(error) {
  const code = error?.error || error?.code || "UNKNOWN";

  const policies = {
    AI_GATEWAY_NOT_CONFIGURED: { action: "quarantine", retry: false },
    UPSTREAM_UNAVAILABLE: { action: "fail-closed", retry: false },
    TIMEOUT: { action: "fail-closed", retry: false },
    INVALID_RESPONSE: { action: "reject", retry: false }
  };

  return {
    version: ERROR_POLICY_VERSION,
    code,
    ...(policies[code] || { action: "fail-closed", retry: false })
  };
}
