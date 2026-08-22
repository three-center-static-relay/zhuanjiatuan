import assert from "node:assert/strict";
import {LA_BRAIN_POLICY,runLangGraphBrain} from "../src/langgraph-brain.js";

const baseTask={task_id:"la-brain-contract",goal:"Compare bounded options and prepare a governed plan.",constraints:{allowed_centers:["governance","expert"],write_scope:"none"},risk:{max_trust_level:"T2",uncertainty:"low"},budget:{cost_mode:"free-first"},required_capabilities:["governance.task-planner","expert.deliberation"],deadline:new Date(Date.now()+60000).toISOString(),success_criteria:["produce a safe plan","preserve governance authority"]};
assert.equal(LA_BRAIN_POLICY.routine_model,"@cf/zai-org/glm-4.7-flash");
assert.equal(LA_BRAIN_POLICY.deep_model,"@cf/nvidia/nemotron-3-120b-a12b");
assert.equal(LA_BRAIN_POLICY.free_allocation_behavior,"workers-ai-direct-before-openrouter");
assert.equal(LA_BRAIN_POLICY.explicit_zero_budget_blocks_paid_fallback,true);

let selectedModel=null;
const routine=await runLangGraphBrain({task:baseTask},{AI:{run:async model=>{selectedModel=model;return{response:JSON.stringify({preferred_centers:["expert","compute"],capability_order:["expert.deliberation","compute.cpu"],force_deep:false,summary:"bounded advisory"})}}}});
assert.equal(selectedModel,LA_BRAIN_POLICY.routine_model);assert.equal(routine.ok,true);assert.equal(routine.source,"cloudflare-workers-ai-free-first");assert.deepEqual(routine.advisory.preferred_centers,["expert"]);assert.deepEqual(routine.advisory.capability_order,["expert.deliberation"]);assert.equal(routine.advisory.tools,false);assert.equal(routine.advisory.web,false);assert.equal(routine.advisory.production_mutation,false);

const deepTask={...baseTask,risk:{...baseTask.risk,uncertainty:"high"}},deep=await runLangGraphBrain({task:deepTask},{AI:{run:async model=>{selectedModel=model;return{response:JSON.stringify({preferred_centers:["governance"],capability_order:["governance.task-planner"],force_deep:true,summary:"deep advisory"})}}}});
assert.equal(selectedModel,LA_BRAIN_POLICY.deep_model);assert.equal(deep.mode,"deep");

const originalFetch=globalThis.fetch;let discovered=false,postedModels=[];
globalThis.fetch=async(url,init={})=>{const target=String(url);if(target.includes("/models?")){discovered=true;return Response.json({data:[{id:"google/model-a",context_length:65536,supported_parameters:["reasoning"],architecture:{output_modalities:["text"]}},{id:"openai/blocked",context_length:65536,supported_parameters:["reasoning"],architecture:{output_modalities:["text"]}},{id:"x-ai/model-b",context_length:65536,supported_parameters:["reasoning"],architecture:{output_modalities:["text"]}},{id:"zai/free-model:free",context_length:65536,supported_parameters:["reasoning"],architecture:{output_modalities:["text"]}}]})}if(target.endsWith("/v1/chat/completions")){const body=JSON.parse(String(init.body||"{}"));postedModels=body.models||[];assert.equal(body.provider?.allow_fallbacks,true);assert.equal(body.provider?.sort,"price");assert.equal(init.headers?.["cf-aig-collect-log-payload"],"false");return Response.json({model:"x-ai/model-b",provider:"openrouter",choices:[{message:{content:JSON.stringify({preferred_centers:["expert"],capability_order:["expert.deliberation"],force_deep:false,summary:"fallback advisory"})}}]})}throw new Error("UNEXPECTED_FETCH")};
try{const fallback=await runLangGraphBrain({task:baseTask},{AI:{run:async()=>{throw new Error("Workers AI 3036 allocation exhausted")}},AI_GATEWAY_TOKEN:"redacted-test-token",CLOUDFLARE_ACCOUNT_ID:"acct",AI_GATEWAY_ID:"gateway"});assert.equal(discovered,true);assert.equal(fallback.ok,true);assert.equal(fallback.source,"openrouter-reasoning-ranked-fallback");assert.equal(fallback.fallback_trigger,"3036");assert.deepEqual(postedModels,["google/model-a","x-ai/model-b"]);assert.deepEqual(fallback.candidate_models,postedModels);assert.equal(fallback.model,"x-ai/model-b")}finally{globalThis.fetch=originalFetch}

let paidFetchCalled=false;const zeroBudgetFetch=globalThis.fetch;globalThis.fetch=async()=>{paidFetchCalled=true;throw new Error("MUST_NOT_CALL")};
try{const zeroBudget={...baseTask,budget:{cost_mode:"free-first",max_paid_usd:0}},blocked=await runLangGraphBrain({task:zeroBudget},{AI:{run:async()=>{throw new Error("3036")}},AI_GATEWAY_TOKEN:"redacted-test-token",CLOUDFLARE_ACCOUNT_ID:"acct",AI_GATEWAY_ID:"gateway"});assert.equal(blocked.ok,false);assert.equal(blocked.source,"deterministic-governance-fallback");assert.equal(blocked.error_code,"PAID_FALLBACK_DISALLOWED_BY_BUDGET");assert.equal(paidFetchCalled,false)}finally{globalThis.fetch=zeroBudgetFetch}

const savedFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error("gateway unavailable")};
try{const degraded=await runLangGraphBrain({task:baseTask},{AI:{run:async()=>{throw new Error("3036")}},AI_GATEWAY_TOKEN:"redacted-test-token",CLOUDFLARE_ACCOUNT_ID:"acct",AI_GATEWAY_ID:"gateway"});assert.equal(degraded.ok,false);assert.equal(degraded.source,"deterministic-governance-fallback");assert.equal(degraded.model,null);assert.equal(degraded.production_mutation,false)}finally{globalThis.fetch=savedFetch}

console.log("langgraph-brain-contract: PASS");
