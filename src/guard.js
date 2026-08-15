import base,{CenterGate as BaseCenterGate} from "./index.js";
import {runGovernanceRelay} from "./governance-relay.js";

const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const INTERNAL_ONLY=new Set(["/v1/run","/v1/status","/v1/cancel","/v1/selftest","/v1/governance-assist"]);

export class CenterGate{
  constructor(state,env){this.inner=new BaseCenterGate(state,env)}
  async fetch(req){
    const u=new URL(req.url);
    if(req.method==="POST"&&u.pathname==="/acquire"){
      const b=await req.clone().json().catch(()=>({}));
      const requested=Number(b.lease_seconds||0);
      const leaseSeconds=Math.max(300,Math.min(900,Number.isFinite(requested)?Math.trunc(requested):300));
      req=new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({...b,lease_seconds:leaseSeconds})});
    }
    return this.inner.fetch(req);
  }
}

function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function g(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
async function cancel(req,env){const b=await req.json().catch(()=>({})),id=String(b.task_id||"");if(!id)return json({ok:false,error:"INVALID_REQUEST",message:"task_id required"},400);const t=await g(env,`/task/${encodeURIComponent(id)}`);if(!t.task)return json({ok:false,error:"INVALID_REQUEST",message:"Task not found"},404);const r=await g(env,`/task/${encodeURIComponent(id)}/cancel`,"POST",{});return json({ok:r.ok,task:r.task||t.task,cancellation_pending:true,lock_retained:true,note:"The active expert execution keeps the lock until its execution path completes or the bounded lease expires."},202)}
function modelAllowed(id){const x=String(id||"").toLowerCase();return x&&!x.startsWith("openai/")&&!x.startsWith("anthropic/")&&!x.includes("claude")&&!x.includes("flash")&&!x.includes(":free")}
async function sha256(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v||"")));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}

async function mapNoReplacement(body,env,status){
  if(body?.error!=="NO_REPLACEMENT_MODEL_AVAILABLE")return null;
  const id=String(body?.details?.task_id||body?.task_id||"");
  if(!id)return null;
  const t=await g(env,`/task/${encodeURIComponent(id)}`).catch(()=>null),last=String(t?.task?.last_stage_error||""),stage=String(t?.task?.last_failed_stage||"");
  if(!last)return null;
  let code=last,http=status;
  if(last==="EMPTY_MODEL_OUTPUT")code=stage==="judge"?"EMPTY_JUDGE_OUTPUT":"EMPTY_EXPERT_OUTPUT";
  if(last==="UPSTREAM_TIMEOUT")http=504;
  await g(env,`/task/${encodeURIComponent(id)}`,"POST",{status:"failed",error:code,finished_at:new Date().toISOString()}).catch(()=>{});
  return json({...body,error:code,message:last==="UPSTREAM_TIMEOUT"?"OpenRouter model stage timed out and no cross-company replacement was available":"OpenRouter returned an empty model result and no cross-company replacement was available"},http);
}

async function validateRunResponse(r,env){
  const body=await r.clone().json().catch(()=>null);
  if(!r.ok){
    const mapped=await mapNoReplacement(body,env,r.status);if(mapped)return mapped;
    if(body?.error==="EMPTY_MODEL_OUTPUT"){
      const stage=String(body?.details?.stage_details?.stage||"");
      const code=stage==="judge"?"EMPTY_JUDGE_OUTPUT":"EMPTY_EXPERT_OUTPUT";
      return json({...body,error:code},r.status);
    }
    return r;
  }
  if(body?.status!=="completed")return r;
  const answers=Array.isArray(body?.answers)?body.answers:[];
  const expertEmpty=answers.length===0||answers.some(a=>!String(a?.content||"").trim());
  const judgeEmpty=!String(body?.judge?.content||"").trim();
  if(!expertEmpty&&!judgeEmpty)return r;
  const code=expertEmpty?"EMPTY_EXPERT_OUTPUT":"EMPTY_JUDGE_OUTPUT";
  const id=String(body?.task_id||"");
  if(id)await g(env,`/task/${encodeURIComponent(id)}`,"POST",{status:"failed",error:code,answers:null,judge:null,finished_at:new Date().toISOString()}).catch(()=>{});
  return json({ok:false,error:code,message:"OpenRouter returned an empty expert result; task is not accepted as completed",task_id:id||null},502);
}

async function selftest(env,ctx){
  if(!env.OPENROUTER_API_KEY)return json({ok:false,error:"UPSTREAM_AUTH_FAILED",business_e2e:false,configured:false,message:"OPENROUTER_API_KEY is not configured"},503);
  const taskId=`selftest-expert-${crypto.randomUUID()}`,started=Date.now();
  const request=new Request("https://expert.internal/v1/run",{method:"POST",headers:{"content-type":"application/json","x-three-center-selftest":"1"},body:JSON.stringify({task_id:taskId,prompt:"Self-test only. Return exactly: 2 — 1+1=2. Do not add external facts.",model_count:2,max_tokens:512,timeout_seconds:120,roles:["Arithmetic verifier"]})});
  const raw=await base.fetch(request,env,ctx),r=await validateRunResponse(raw,env),body=await r.clone().json().catch(()=>null),models=Array.isArray(body?.models)?body.models:[],answers=Array.isArray(body?.answers)?body.answers:[],judge=body?.judge||null;
  const uniqueCompanies=new Set(models.map(x=>String(x).split("/")[0].toLowerCase())).size===models.length,modelPolicy=models.length===2&&models.every(modelAllowed)&&uniqueCompanies,expertNonempty=answers.length===1&&Boolean(String(answers[0]?.content||"").trim()),judgeNonempty=Boolean(String(judge?.content||"").trim()),completed=r.ok&&body?.ok===true&&body?.status==="completed",ok=completed&&modelPolicy&&expertNonempty&&judgeNonempty;
  const digest=await sha256(JSON.stringify({models,expert:answers[0]?.content||"",judge:judge?.content||""}));
  await g(env,`/task/${encodeURIComponent(taskId)}`,"POST",{selftest:true,status:ok?"selftest-pass":"selftest-fail",answers:null,judge:null,models,output_digest:digest,selftest_finished_at:new Date().toISOString()}).catch(()=>{});
  return json({ok,business_e2e:true,cost_class:"paid-minimal",configured:true,task_id:taskId,http_status:r.status,models,company_diverse:uniqueCompanies,model_policy_pass:modelPolicy,expert_nonempty:expertNonempty,judge_nonempty:judgeNonempty,output_digest:digest,content_scrubbed:true,max_tokens:512,elapsed_ms:Date.now()-started},ok?200:503);
}

export default{async fetch(req,env,ctx){try{
  const u=new URL(req.url);
  if(req.method==="POST"&&INTERNAL_ONLY.has(u.pathname)&&u.hostname!=="expert.internal")return json({ok:false,error:"POLICY_DENIED",message:"expert execution routes are service-binding internal only"},403);
  if(req.method==="POST"&&u.pathname==="/v1/governance-assist")return await runGovernanceRelay(req,env);
  if(req.method==="POST"&&u.pathname==="/v1/cancel")return await cancel(req,env);
  if(req.method==="POST"&&u.pathname==="/v1/selftest")return await selftest(env,ctx);
  const r=await base.fetch(req,env,ctx);
  return req.method==="POST"&&u.pathname==="/v1/run"?await validateRunResponse(r,env):r;
}catch(e){return json({ok:false,error:e?.message||"INTERNAL_ERROR",message:"Request failed"},e?.status||500)}}};
