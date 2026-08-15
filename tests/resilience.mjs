import assert from "node:assert/strict";
import { createTestHarness } from "wrangler";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";

const watchdog=setTimeout(()=>{console.error("RESILIENCE_WATCHDOG_TIMEOUT");process.exit(124)},40000);
let catalogMode="full",calls=[];
const fullCatalog=[
  {id:"google/gemini-a",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"google/gemini-b",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"deepseek/r1",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"mistralai/magistral",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"qwen/qwen3",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"x-ai/grok",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"cohere/command",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"meta-llama/llama",pricing:{prompt:"0.000001",completion:"0.000001"}}
];
const network=setupServer(
  http.get("https://openrouter.ai/api/v1/models",()=>HttpResponse.json({data:catalogMode==="short"?fullCatalog.slice(0,3):fullCatalog})),
  http.post("https://openrouter.ai/api/v1/chat/completions",async({request})=>{
    const b=await request.json();
    const text=(b.messages||[]).map(x=>String(x?.content||"")).join("\n");
    const isJudge=text.includes("You are the final judge")||text.includes("Independent expert answers:");
    calls.push({model:b.model,isJudge});
    if(text.includes("SLOW_PRIMARY")&&b.model==="google/gemini-a"){await delay(1500);return HttpResponse.json({choices:[{message:{content:"late"}}]})}
    if(text.includes("SLOW_JUDGE")&&isJudge&&b.model==="qwen/qwen3"){await delay(1500);return HttpResponse.json({choices:[{message:{content:"late judge"}}]})}
    return HttpResponse.json({choices:[{message:{content:isJudge?"judge ok":"expert ok"}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})
  })
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
async function post(body){const r=await server.fetch("https://expert.internal/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function reset(){await server.reset();catalogMode="full";calls=[]}
let exitCode=0;
try{
  await server.listen();
  await reset();
  const same=await post({task_id:"same-company",prompt:"NORMAL",model_count:4,models:["google/gemini-a","google/gemini-b","deepseek/r1","mistralai/magistral","qwen/qwen3"],timeout_seconds:30,max_tokens:64});
  assert.equal(same.status,200);assert.equal(same.body.models.length,4);assert.equal(new Set(same.body.models.map(x=>x.split("/")[0])).size,4);assert.equal(same.body.models.filter(x=>x.startsWith("google/")).length,1);

  await reset();
  const slow=await post({task_id:"slow-primary",prompt:"SLOW_PRIMARY",model_count:4,models:["google/gemini-a","deepseek/r1","mistralai/magistral","qwen/qwen3"],model_timeout_seconds:1,judge_timeout_seconds:2,timeout_seconds:20,max_tokens:64});
  assert.equal(slow.status,200);assert.equal(slow.body.models.length,4);assert.equal(new Set(slow.body.models.map(x=>x.split("/")[0])).size,4);assert.equal(slow.body.execution_receipt[0].replaced,true);assert.equal(slow.body.execution_receipt[0].attempts[0].error,"UPSTREAM_TIMEOUT");assert.notEqual(slow.body.execution_receipt[0].final_model,"google/gemini-a");

  await reset();
  const judge=await post({task_id:"slow-judge",prompt:"SLOW_JUDGE",model_count:4,models:["google/gemini-a","deepseek/r1","mistralai/magistral","qwen/qwen3"],model_timeout_seconds:2,judge_timeout_seconds:1,timeout_seconds:20,max_tokens:64});
  assert.equal(judge.status,200);assert.equal(judge.body.execution_receipt.at(-1).stage,"judge");assert.equal(judge.body.execution_receipt.at(-1).replaced,true);assert.equal(judge.body.execution_receipt.at(-1).attempts[0].error,"UPSTREAM_TIMEOUT");assert.notEqual(judge.body.judge.model,"qwen/qwen3");assert.equal(new Set(judge.body.models.map(x=>x.split("/")[0])).size,4);

  await reset();catalogMode="short";
  const short=await post({task_id:"not-enough",prompt:"NORMAL",model_count:4,timeout_seconds:20,max_tokens:64});
  assert.equal(short.status,502);assert.equal(short.body.error,"NOT_ENOUGH_UNIQUE_MODEL_COMPANIES");

  console.log(JSON.stringify({ok:true,suite:"expert-resilience",tests:["same-company-skip-and-fill","exact-4-company-panel","slow-expert-replacement","slow-judge-replacement","fail-if-unique-company-count-insufficient"]}));
}catch(e){exitCode=1;console.error(e)}
try{await server.close()}catch{}
network.close();clearTimeout(watchdog);process.exit(exitCode);