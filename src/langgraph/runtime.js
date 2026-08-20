// LangGraph 9.x migration foundation
// Fail-closed orchestration layer for Expert Center.

export const INITIAL_STATE = {
  task: null,
  capabilities: [],
  experts: [],
  selectedModels: [],
  evidence: [],
  decisions: [],
  validation: null,
  status: "INIT"
};

export function createGraphState(input = {}) {
  return {
    ...INITIAL_STATE,
    task: input.task ?? null,
    status: "PLANNING"
  };
}

export function routeExpertTask(state) {
  if (!state.task) return { ...state, status: "FAIL_CLOSED" };
  return {
    ...state,
    experts: ["analysis", "verification", "risk"],
    status: "EXPERT_ROUTED"
  };
}

export function validateOutput(state) {
  const valid = Array.isArray(state.decisions);
  return {
    ...state,
    validation: { ok: valid },
    status: valid ? "READY" : "FAIL_CLOSED"
  };
}
