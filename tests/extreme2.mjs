import assert from "node:assert/strict";
import { createTestHarness } from "wrangler";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const HARD_TIMEOUT_MS=90000;
const CHAT_ENDPOINT="https://gateway.ai.cloudflare.com/v1/e3aec027af13c557bbcb831d29c1e7b4/test/compat/chat/completions";
const watchdog=setTimeout(()=>{console.error("EXTREME2_WATCHDOG_TIMEOUT");process.exit(124)},HARD_TIMEOUT_MS);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const within=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`TIMEOUT:${label}`)),ms))]);
async function waves(total,width,fn,label){const out=[];for(let base=0;base<total;base+=width){const part=await within(Promise.all(Array.from({length:Math.min(width,total-base)},(_,i)=>fn(base+i))),10000,`${label}-${base}`);out.push(...part)}return out}

const routeModels={"expert-1":"google/gemini-2.5-pro","expert-2":"deepseek/deepseek-r1","expert-3":"mistralai/magistral-medium",judge:"qwen/qwen3-235b-a22b"};
let chatCalls=0,holdEnteredResolve=()=>{},holdReleaseResolve=()=>{},holdEntered=Promise.resolve(),holdRelease=Promise.resolve();
function armHold(){holdEntered=new Promise(r=>{holdEnteredResolve=r});holdRelease=new Promise(r=>{holdReleaseResolve=r})}
function letGo(){holdReleaseResolve()}
function promptOf(body){return (body?.messages||[]).map(x=>String(x?.content||"")).join("\n")}
const network=setupServer(
  http.post(CHAT_ENDPOINT,async({request})=>{
    assert.equal(request.headers.get("cf-aig-authorization"),"Bearer test-gateway-token");
    assert.equal(request.headers.get("cf-aig-skip-cache"),null);
    assert.equal(request.headers.get("cf-aig-collect-log"),null);
    assert.equal(request.headers.get("cf-aig-max-attempts"),"1");
    chatCalls++;const b=await request.json(),prompt=promptOf(b),metadata=JSON.parse(request.headers.get("cf-aig-metadata")||"{}");
    assert.equal(b.model,"dynamic/expert-panel-v1");assert.ok(routeModels[metadata.expert_slot]);
    if(prompt.includes("HOLD_CHAT")&&chatCalls===1){holdEnteredResolve();await holdRelease}
    if(prompt.includes("BAD_JSON_CHAT"))return HttpResponse.text("{bad-json",{status:200,headers:{"content-type":"application/json"}});
    const headers={"cf-aig-model":routeModels[metadata.expert_slot],"cf-aig-provider":"openrouter"};
    if(prompt.includes("EMPTY_CHAT"))return HttpResponse.json({id:`chat-${chatCalls}`,model:routeModels[metadata.expert_slot],choices:[{message:{role:"assistant",content:""}}]},{headers});
    return HttpResponse.json({id:`chat-${chatCalls}`,model:routeModels[metadata.expert_slot],choices:[{message:{role:"assistant",content:"Result OK. Independent reasoning completed."},finish_reason:"stop"}],usage:{prompt_tokens:20,completion_tokens:12,total_tokens:32}},{headers})
  })
);
network.listen({onUnhandledRequest:"error"});
const server=createTestHarness({workers:[{configPath:"./wrangler.test.jsonc"}]});
const internal=p=>`https://expert.internal${p}`,external=p=>`https://public.example${p}`;
async function post(path,body){const r=await server.fetch(internal(path),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return{status:r.status,body:await r.json().catch(()=>null)}}
async function run(id,prompt="NORMAL",modelCount=4,timeoutSeconds=300){return post("/v1/run",{task_id:id,prompt,model_count:modelCount,max_tokens:512,timeout_seconds:timeoutSeconds,roles:["Quantitative analyst","Adversarial reviewer","Decision scientist"]})}
async function reset(){await within(server.reset(),5000,"reset");chatCalls=0;holdEnteredResolve=()=>{};holdReleaseResolve=()=>{};holdEntered=Promise.resolve();holdRelease=Promise.resolve()}

let exitCode=0;
try{
  await within(server.listen(),10000,"listen");

  await reset();armHold();
  const holder=run("x2-holder","HOLD_CHAT unique-overload",4,300);
  await within(holdEntered,5000,"holder-enter");
  const unique=await within(Promise.all(Array.from({length:256},(_,i)=>run(`x2-u-${i}`,"NORMAL",4,300))),25000,"256-unique");
  assert.equal(unique.filter(x=>x.status===409&&x.body?.error==="BUSY").length,199);
  assert.equal(unique.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,57);
  assert.equal(chatCalls,1);
  letGo();assert.equal((await within(holder,10000,"holder-finish")).status,200);assert.equal(chatCalls,4);

  await reset();armHold();
  const dupHolder=run("x2-dup","HOLD_CHAT duplicate-overload",4,300);
  await within(holdEntered,5000,"dup-enter");
  const dup=await within(Promise.all(Array.from({length:512},()=>run("x2-dup","NORMAL",4,300))),30000,"512-duplicate");
  assert.equal(dup.filter(x=>x.status===409&&x.body?.error==="DUPLICATE_TASK").length,199);
  assert.equal(dup.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,313);
  assert.equal(chatCalls,1);
  letGo();assert.equal((await within(dupHolder,10000,"dup-finish")).status,200);

  await reset();
  const full=await run("x2-full-4","Solve a constrained allocation problem: rank three options under cost, reliability, latency, and uncertainty. State assumptions, compare tradeoffs, and synthesize a final choice.",4,300);
  assert.equal(full.status,200);assert.equal(full.body?.models?.length,4);assert.equal(full.body?.answers?.length,3);assert.ok(String(full.body?.judge?.content||"").length>0);assert.equal(chatCalls,4);

  await reset();
  const bad=await run("x2-bad-json","BAD_JSON_CHAT",2,300);assert.equal(bad.status,502);assert.equal(bad.body?.error,"UPSTREAM_BAD_JSON");assert.equal(chatCalls,1);
  const afterBad=await run("x2-after-bad","NORMAL",2,300);assert.equal(afterBad.status,200);

  await reset();
  const empty=await run("x2-empty","EMPTY_CHAT",2,300);
  assert.equal(empty.status,502,"empty model output must fail closed rather than report completed");
  assert.equal(empty.body?.error,"EMPTY_MODEL_OUTPUT");
  const afterEmpty=await run("x2-after-empty","NORMAL",2,300);assert.equal(afterEmpty.status,200);

  await reset();armHold();
  const leaseHolder=run("x2-lease-holder","HOLD_CHAT lease-boundary",2,120);
  await within(holdEntered,5000,"lease-enter");
  await sleep(31000);
  const late=await run("x2-late-contender","NORMAL",2,300);
  assert.equal(late.status,409,"active task lock must remain held 31s into an execution whose total deadline has not expired");
  assert.equal(late.body?.error,"BUSY");
  letGo();assert.equal((await within(leaseHolder,10000,"lease-holder-finish")).status,200);

  await reset();
  const rate=await waves(2000,128,i=>post("/v1/run",{task_id:`x2-rate-${i}`}),"rate");
  assert.equal(rate.filter(x=>x.status===400&&x.body?.error==="INVALID_REQUEST").length,200);
  assert.equal(rate.filter(x=>x.status===429&&x.body?.error==="RATE_LIMITED").length,1800);
  assert.equal(chatCalls,0);

  const health=await waves(1024,128,()=>server.fetch(external("/health")),"health");
  assert.equal(health.filter(r=>r.status===200).length,1024);

  console.log(JSON.stringify({ok:true,suite:"expert-extreme2",unique_contenders:256,unique_busy:199,unique_rate_limited:57,duplicate_contenders:512,duplicate_rejected:199,duplicate_rate_limited:313,rate_total:2000,health_total:1024,full_model_count:4,lease_boundary_seconds:31,tests:["256-rate-plus-lock","512-rate-plus-duplicate","4-model-full-chain","bad-json-recovery","empty-output-fail-closed","lease-boundary-no-overlap","2000-rate-overload","1024-health-burst"]}));
}catch(e){exitCode=1;try{server.debug()}catch{}console.error(e)}
try{await Promise.race([server.close(),new Promise(r=>setTimeout(r,2000))])}catch{}
network.close();clearTimeout(watchdog);process.exit(exitCode);
