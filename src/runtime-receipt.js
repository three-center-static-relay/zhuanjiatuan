export function runtimeReceipt({status="candidate",checks={}}={}){
  return {
    service:"expert-worker",
    runtime:"langgraph-orchestrator",
    status,
    checks,
    generated_at:new Date().toISOString()
  };
}
