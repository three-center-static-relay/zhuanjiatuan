import base,{CenterGate} from "./index.js";
export {CenterGate};
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const CANARY_ID="prod-canary-20260815-b7e3d1";
const CANARY_PATH="/v1/.canary/20260815-b7e3d1";
const INTERNAL_ONLY=new Set(["/v1/run","/v1/status","/v1/cancel","/v1/selftest"]);
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function cancel(req,env){const b=await req.json().catch(()=>({})),id=String(b.task_id||"");if(!id)return json({ok:false,error:"INVALID_REQUEST",message:"task_id required"},400);const t=await g(env,`/task/${encodeURIComponent(id)}`);if(!t.task)return json({ok:false,error:"INVALID_REQUEST",message:"Task not found"},404);const r=await g(env,`/task/${encodeURIComponent(id)}/cancel`,"POST",{});return json({ok:r.ok,task:r.task||t.task,cancellation_pending:true,lock_retained:true,note:"The active expert execution keeps the lock until its execution path completes or the lease expires."},202)}
function modelAllowed(id){const x=String(id||"").toLowerCase();return x&&!x.startsWith("openai/")&&!x.startsWith("anthropic/")&&!x.includes("claude")&&!x.includes("flash")&&!x.includes(":free")}
async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function selftest(env,ctx,taskId=`selftest-expert-${crypto.randomUUID()}`){
  if(!env.OPENROUTER_API_KEY)return json({ok:false,error:"UPSTREAM_AUTH_FAILED",business_e2e:false,configured:false,message:"OPENROUTER_API_KEY is not configured"},503);
  const started=Date.now();
  const request=new Request("https://expert.internal/v1/run",{method:"POST",headers:{"content-type":"application/json","x-three-center-selftest":"1"},body:JSON.stringify({task_id:taskId,prompt:"Self-test only. Return exactly: 2 — 1+1=2. Do not add external facts.",model_count:2,max_tokens:512,timeout_seconds:120,roles:["Arithmetic verifier"]})});
  const r=await base.fetch(request,env,ctx),body=await r.json().catch(()=>null),models=Array.isArray(body?.models)?body.models:[],answers=Array.isArray(body?.answers)?body.answers:[],judge=body?.judge||null;
  const uniqueCompanies=new Set(models.map(x=>String(x).split("/")[0].toLowerCase())).size===models.length,modelPolicy=models.length===2&&models.every(modelAllowed)&&uniqueCompanies,expertNonempty=answers.length===1&&Boolean(String(answers[0]?.content||"").trim()),judgeNonempty=Boolean(String(judge?.content||"").trim()),completed=r.ok&&body?.ok===true&&body?.status==="completed",ok=completed&&modelPolicy&&expertNonempty&&judgeNonempty;
  const digest=await sha256(JSON.stringify({models,expert:answers[0]?.content||"",judge:judge?.content||""}));
  await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{selftest:true,status:ok?"selftest-pass":"selftest-fail",answers:null,judge:null,models,output_digest:digest,selftest_finished_at:new Date().toISOString()}).catch(()=>{});
  return json({ok,business_e2e:true,cost_class:"paid-minimal",configured:true,task_id:taskId,http_status:r.status,models,company_diverse:uniqueCompanies,model_policy_pass:modelPolicy,expert_nonempty:expertNonempty,judge_nonempty:judgeNonempty,output_digest:digest,content_scrubbed:true,max_tokens:512,elapsed_ms:Date.now()-started},ok?200:503);
}
async function prodCanary(env,ctx){
  const old=await g(env,`/task/${encodeURIComponent(CANARY_ID)}`);
  if(old.task?.canary_receipt)return json(old.task.canary_receipt,old.task.canary_receipt.ok?200:503);
  if(old.task){for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,250));const x=await g(env,`/task/${encodeURIComponent(CANARY_ID)}`);if(x.task?.canary_receipt)return json(x.task.canary_receipt,x.task.canary_receipt.ok?200:503)}return json({ok:false,error:"CANARY_IN_PROGRESS",task_id:CANARY_ID},409)}
  const r=await selftest(env,ctx,CANARY_ID),body=await r.json().catch(()=>null),receipt={...body,canary:true,canary_id:CANARY_ID,public_trigger_one_shot:true};
  await g(env,`/task/${encodeURIComponent(CANARY_ID)}`,"POST",{canary_receipt:receipt,answers:null,judge:null}).catch(()=>{});
  return json(receipt,receipt.ok?200:503);
}
export default{async fetch(req,env,ctx){try{const u=new URL(req.url);if(req.method==="POST"&&u.pathname===CANARY_PATH)return await prodCanary(env,ctx);if(req.method==="POST"&&INTERNAL_ONLY.has(u.pathname)&&u.hostname!=="expert.internal")return json({ok:false,error:"POLICY_DENIED",message:"expert execution routes are service-binding internal only"},403);if(req.method==="POST"&&u.pathname==="/v1/cancel")return await cancel(req,env);if(req.method==="POST"&&u.pathname==="/v1/selftest")return await selftest(env,ctx);return await base.fetch(req,env,ctx)}catch(e){return json({ok:false,error:e?.message||"INTERNAL_ERROR",message:"Request failed"},e?.status||500)}}};
