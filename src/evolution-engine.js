// Evolution layer foundation.
// Future versions can attach capability scoring and governed upgrades.

export function evaluateCapability(candidate) {
  return {
    candidate,
    score: 0,
    approved: false,
    reason: "requires-governance-review"
  };
}
