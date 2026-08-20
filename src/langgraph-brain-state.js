// Cloudflare-native LangGraph brain state primitives.
// Keeps orchestration state explicit and allows later Durable Object persistence.

export const createBrainState = (task) => ({
  task,
  stage: "governance",
  history: [],
  decisions: [],
  failures: [],
  status: "initialized"
});

export const transition = (state, stage, decision = null) => ({
  ...state,
  stage,
  history: [...state.history, state.stage],
  decisions: decision ? [...state.decisions, decision] : state.decisions,
  status: "running"
});

export const failSafe = (state, error) => ({
  ...state,
  failures: [...state.failures, String(error)],
  status: "degraded"
});
