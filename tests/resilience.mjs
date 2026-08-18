import assert from "node:assert/strict";
import { createTestHarness } from "wrangler";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const watchdog=setTimeout(()=>{console.error("RESILIENCE_WATCHDOG_TIMEOUT");process.exit(124)},40000);
const CHAT_ENDPOINT="https://gateway.ai.cloudflare.com/v1/e3aec027af13c557bbcb831d29c1e7b4/test/compat/chat/completions";
const normal={"expert-1":"google/gemini-pro","expert-2":"deepseek/r1","expert-3":"mistralai/magistral",judge:"qwen/qwen3"};
let mode="normal",calls=[];
const network=setupServer(
  http.post(CHAT_ENDPOINT,async({request})=>{
    const body=await request.json(),metadata=JSON.parse(request.headers.get("cf-aig-metadata")||"{}"),slot=metadata.expert_slot;
    assert.equal(body.model,"dynamic/expert-panel-v1");
    assert.ok(["expert-1","expert-2","expert-3","judge"].includes(slot));
    let model=normal[slot],provider="openrouter";
    if(mode==="duplicate"&&slot==="expert-2")model="google/gemini-backup";
    if(mode==="forbidden"&&slot==="expert-1")model="anthropic/claude-opus";
    if(mode==="same-family-fallback"&&slot==="expert-1")model="google/gemini-pro-backup";
    calls.push({slot,model});
    const payload={model,choices:[{message:{content:slot==="judge"?"judge ok":"expert ok"}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
    if(mode==="missing-metadata"&&slot==="expert-1")return HttpResponse.json(payload);
    return HttpResponse.json(payload,{headers:{"cf-aig-model":model,"cf-aig-provider":provider}});
  })
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
async function post(taskId,count=4){const response=await server.fetch("https://expert.internal/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:taskId,prompt:"Evaluate resilient routing",model_count:count,timeout_seconds:20,max_tokens:64})});return{status:response.status,body:await response.json().catch(()=>null)}}
async function reset(nextMode="normal"){await server.reset();mode=nextMode;calls=[]}
let exitCode=0;
try{
  await server.listen();

  await reset();
  const normalRun=await post("normal");
  assert.equal(normalRun.status,200);assert.equal(normalRun.body.models.length,4);assert.equal(normalRun.body.dynamic_route,"expert-panel-v1");assert.equal(new Set(normalRun.body.companies).size,4);assert.deepEqual(calls.map(x=>x.slot),["expert-1","expert-2","expert-3","judge"]);

  await reset("same-family-fallback");
  const fallback=await post("fallback");
  assert.equal(fallback.status,200);assert.equal(fallback.body.models[0],"google/gemini-pro-backup");assert.equal(new Set(fallback.body.companies).size,4);

  await reset("duplicate");
  const duplicate=await post("duplicate");
  assert.equal(duplicate.status,502);assert.equal(duplicate.body.error,"COMPANY_DIVERSITY_INVARIANT_FAILED");

  await reset("forbidden");
  const forbidden=await post("forbidden");
  assert.equal(forbidden.status,502);assert.equal(forbidden.body.error,"DYNAMIC_ROUTE_POLICY_VIOLATION");assert.equal(calls.length,1,"fail closed before later expert slots");

  await reset("missing-metadata");
  const missing=await post("missing");
  assert.equal(missing.status,502);assert.equal(missing.body.error,"DYNAMIC_ROUTE_METADATA_MISSING");assert.equal(calls.length,1);

  console.log(JSON.stringify({ok:true,suite:"expert-resilience",tests:["dynamic-slot-chain","same-company-lane-fallback","cross-slot-company-diversity-fail-closed","forbidden-model-fail-closed","response-routing-metadata-required"]}));
}catch(error){exitCode=1;console.error(error)}
try{await server.close()}catch{}
network.close();clearTimeout(watchdog);process.exit(exitCode);
