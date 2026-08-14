import assert from "node:assert/strict";
import { createTestHarness } from "wrangler";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
const HARD_TIMEOUT_MS=50000;
const watchdog=setTimeout(()=>{console.error("STRESS_WATCHDOG_TIMEOUT");process.exit(124)},HARD_TIMEOUT_MS);
const within=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${label}`)),ms))]);
const catalog=[
  {id:"openai/gpt-5",pricing:{prompt:"0.00001",completion:"0.00001"}},
  {id:"anthropic/claude-opus",pricing:{prompt:"0.00001",completion:"0.00001"}},
  {id:"google/gemini-2.5-flash",pricing:{prompt:"0.00001",completion:"0.00001"}},
  {id:"meta-llama/llama-4:free",pricing:{prompt:"0",completion:"0"}},
  {id:"google/gemini-2.5-pro",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"deepseek/deepseek-r1",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"mistralai/magistral-medium",pricing:{prompt:"0.000001",completion:"0.000001"}},
  {id:"qwen/qwen3-235b-a22b",pricing:{prompt:"0.000001",completion:"0.000001"}}
];
let chatCalls=0,catalogCalls=0,holdEnteredResolve=()=>{},holdReleaseResolve=()=>{},holdEntered=Promise.resolve(),holdRelease=Promise.resolve();
function armHold(){holdEntered=new Promise(r=>{holdEnteredResolve=r});holdRelease=new Promise(r=>{holdReleaseResolve=r})}
function letGo(){holdReleaseResolve()}
function promptOf(body){return (body?.messages||[]).map(x=>String(x?.content||"")).join("\n")}
const network=setupServer(
  http.get("https://openrouter.ai/api/v1/models",()=>{catalogCalls++;return HttpResponse.json({data:catalog})}),
  http.post("https://openrouter.ai/api/v1/chat/completions",async({request})=>{chatCalls++;const b=await request.json(),prompt=promptOf(b);if(prompt.includes("FAIL_CHAT"))return HttpResponse.json({error:{message:"synthetic chat failure"}},{status:503});if(prompt.includes("OVERSIZE_CHAT"))return HttpResponse.json({choices:[{message:{role:"assistant",content:"x".repeat(1600000)}}]});if(prompt.includes("HOLD_CHAT")&&chatCalls===1){holdEnteredResolve();await holdRelease}return HttpResponse.json({id:`chat-${chatCalls}`,model:b.model,choices:[{index:0,message:{role:"assistant",content:"2. 1+1=2."},finish_reason:"stop"}],usage:{prompt_tokens:8,completion_tokens:5,total_tokens:13}})})
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
async function post(path,body){const r=await server.fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function run(id,prompt="NORMAL",modelCount=2){return post("/v1/run",{task_id:id,prompt,model_count:modelCount,max_tokens:64,timeout_seconds:60,roles:["Verifier","Risk reviewer","Independent analyst"]})}
async function reset(){await within(server.reset(),5000,"reset");chatCalls=0;catalogCalls=0;holdEnteredResolve=()=>{};holdReleaseResolve=()=>{};holdEntered=Promise.resolve();holdRelease=Promise.resolve()}
const banned=id=>{const x=String(id).toLowerCase();return x.startsWith("openai/")||x.startsWith("anthropic/")||x.includes("claude")||x.includes("flash")||x.includes(":free")};
let exitCode=0;
try{
  await within(server.listen(),10000,"listen");
  await reset();armHold();const first=run("expert-holder","HOLD_CHAT load test",2);await within(holdEntered,5000,"holder-chat-entry");const contenders=await within(Promise.all(Array.from({length:64},(_,i)=>run(`expert-contender-${i}`,"NORMAL",2))),12000,"unique-contenders");assert.equal(contenders.filter(x=>x.status===409&&x.body?.error==="BUSY").length,64);assert.equal(catalogCalls,1);assert.equal(chatCalls,1);letGo();assert.equal((await within(first,8000,"holder-finish")).status,200);assert.equal(chatCalls,2);
  await reset();armHold();const dupFirst=run("expert-duplicate","HOLD_CHAT duplicate test",2);await within(holdEntered,5000,"dup-chat-entry");const dup=await within(Promise.all(Array.from({length:64},()=>run("expert-duplicate","NORMAL",2))),10000,"duplicate-contenders");assert.equal(dup.filter(x=>x.status===409&&x.body?.error==="DUPLICATE_TASK").length,64);assert.equal(catalogCalls,1);assert.equal(chatCalls,1);letGo();assert.equal((await within(dupFirst,8000,"dup-finish")).status,200);
  await reset();armHold();const cancelRun=run("expert-cancel","HOLD_CHAT cancellation test",2);await within(holdEntered,5000,"cancel-chat-entry");assert.equal((await post("/v1/cancel",{task_id:"expert-cancel"})).status,202);letGo();const cancelled=await within(cancelRun,8000,"cancel-finish");assert.equal(cancelled.status,409);assert.equal(cancelled.body?.error,"CANCELLED");assert.equal(chatCalls,1,"judge must not run after cancellation");assert.equal((await run("after-cancel","NORMAL",2)).status,200);
  await reset();const failed=await run("chat-fail","FAIL_CHAT",2);assert.equal(failed.status,503);assert.equal(failed.body?.error,"UPSTREAM_UNAVAILABLE");assert.equal(chatCalls,1,"failed paid chat must not retry");assert.equal((await run("after-chat-fail","NORMAL",2)).status,200);
  await reset();const oversized=await run("chat-oversize","OVERSIZE_CHAT",2);assert.equal(oversized.status,502);assert.equal(oversized.body?.error,"UPSTREAM_RESPONSE_TOO_LARGE");assert.equal(chatCalls,1);assert.equal((await run("after-chat-oversize","NORMAL",2)).status,200);
  await reset();const filtered=await run("filter-clamp","NORMAL",99);assert.equal(filtered.status,200);const models=filtered.body?.models||[];assert.equal(models.length,4);assert.equal(models.some(banned),false);assert.equal(new Set(models.map(x=>String(x).split("/")[0])).size,4);assert.equal(catalogCalls,1);assert.equal(chatCalls,4);
  await reset();const burst=await within(Promise.all(Array.from({length:220},(_,i)=>post("/v1/run",{task_id:`rate-${i}`}))),15000,"rate-burst");assert.equal(burst.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,20);assert.equal(burst.filter(x=>x.status===400&&x.body?.error==="INVALID_REQUEST").length,200);assert.equal(catalogCalls,0);assert.equal(chatCalls,0);
  await reset();const hr=await server.fetch("/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:"huge",prompt:"x".repeat(70000)})});assert.equal(hr.status,413);assert.equal(catalogCalls,0);assert.equal(chatCalls,0);
  const health=await within(Promise.all(Array.from({length:256},()=>server.fetch("/health"))),10000,"health-burst");assert.equal(health.filter(r=>r.status===200).length,256);
  console.log(JSON.stringify({ok:true,suite:"expert-stress",concurrency_contenders:64,duplicate_contenders:64,rate_burst:220,health_burst:256,tests:["single-catalog-path","single-paid-path","duplicate-id","cancel-before-judge","no-retry","failure-release","response-size-cap","model-filter","company-diversity","model-clamp","rate-no-external-call","body-limit","read-burst"]}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await Promise.race([server.close(),new Promise(r=>setTimeout(r,2000))])}catch{}
network.close();clearTimeout(watchdog);process.exit(exitCode);
