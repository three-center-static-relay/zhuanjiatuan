import {runLangGraphBrain,LA_BRAIN_POLICY} from "./langgraph-brain.js";

const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const task=(mode)=>({
  task_id:`la-brain-live-${mode}`,
  goal:mode==="deep"?"Analyze a high-uncertainty multi-center decision and prioritize the governed capability sequence.":"Prioritize a routine governed task across the allowed centers.",
  constraints:{allowed_centers:["governance","intelligence","compute","expert"],write_scope:"none",tools:false,web:false},
  risk:{max_trust_level:"T2",uncertainty:mode==="deep"?"high":"low"},
  budget:{cost_mode:"free-first",max_paid_usd:0,allow_paid_fallback:false},
  required_capabilities:["governance.task-planner","intelligence.provider-query","compute.cpu","expert.deliberation"],
  success_criteria:["return bounded advisory","do not add centers or capabilities","no tools, web, paid fallback, or mutation"]
});

export default{async fetch(request,env){
  const url=new URL(request.url);
  if(request.method!=="GET"||!["/routine","/deep"].includes(url.pathname))return json({ok:false,error:"NOT_FOUND"},404);
  const requested=url.pathname.slice(1);
  const result=await runLangGraphBrain({mode:"brain-advisory",brain_mode:requested,task:task(requested)},env);
  const expected=requested==="deep"?LA_BRAIN_POLICY.deep_model:LA_BRAIN_POLICY.routine_model;
  const ok=result?.ok===true&&result?.source==="cloudflare-workers-ai-free-first"&&result?.provider==="workers-ai"&&result?.model===expected&&result?.advisory&&result?.tools_used===false&&result?.web_used===false&&result?.production_mutation===false;
  return json({ok,selftest:"la-brain-live-workers-ai-v1",requested_mode:requested,source:result?.source||null,provider:result?.provider||null,model:result?.model||null,expected_model:expected,advisory:result?.advisory||null,fallback_used:result?.fallback_used===true,fallback_trigger:result?.fallback_trigger||null,error_code:result?.error_code||null,tools_used:result?.tools_used===true,web_used:result?.web_used===true,production_mutation:result?.production_mutation===true,secrets_redacted:true},ok?200:502);
}};
