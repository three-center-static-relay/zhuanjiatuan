// LangGraph orchestration adapter for Cloudflare runtime
// This layer keeps orchestration separate from expert execution.

export const graphRuntime = {
  name: "langgraph-orchestrator",
  version: "v1",
  nodes: [
    "governance",
    "evidence",
    "expert",
    "compute"
  ],
  executionPolicy: {
    failClosed: true,
    maxRetries: 2,
    requireGovernanceApproval: true
  }
};

export function createGraphState(input) {
  return {
    task: input,
    evidence: null,
    expertResult: null,
    computeResult: null,
    governance: {
      approved: false
    }
  };
}
