// Dynamic routing layer for LangGraph 9.x

export function selectCapability(task, registry = []) {
  if (!task) return null;

  const ranked = registry
    .filter(item => item && item.enabled !== false)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return ranked[0] ?? null;
}

export function buildExpertPanel(task) {
  if (!task) return [];

  return [
    { role: "primary", objective: "solve" },
    { role: "critic", objective: "challenge" },
    { role: "validator", objective: "verify" }
  ];
}
