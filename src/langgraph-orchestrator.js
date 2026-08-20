// LangGraph-style orchestration layer for the expert center.
// This is a Cloudflare-compatible state machine adapter.
// External centers are connected through governed APIs only.

export const initialGraphState = {
  task: null,
  evidenceRequests: [],
  expertRequests: [],
  computeRequests: [],
  governanceChecks: [],
  result: null,
  status: "initialized"
};

export function createOrchestrator({ evidence, expert, compute, governance }) {
  return {
    async run(input) {
      const state = { ...initialGraphState, task: input, status: "running" };

      state.governanceChecks = await governance.validateIntent(state);
      state.evidenceRequests = await evidence.plan(state);
      state.expertRequests = await expert.plan(state);
      state.computeRequests = await compute.plan(state);

      state.result = {
        evidence: state.evidenceRequests,
        expert: state.expertRequests,
        compute: state.computeRequests
      };

      state.status = "completed";
      return state;
    }
  };
}
