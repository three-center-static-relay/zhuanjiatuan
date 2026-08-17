import app,{CenterGate} from "./guard.js";
import {CASES,BENCHMARK_VERSION} from "./clinical-benchmark-fixed.js";
export {CenterGate};

const ORIGIN="https://expert.internal";
const SERVICE="expert-worker";
const BENCH_PATH="/v1/clinical-benchmark/3a9f6c2d-20260817";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

async function readApp(path,env,ctx){
  const response=await app.fetch(new Request(`${ORIGIN}${path}`,{method:"GET"}),env,ctx);
  const body=await response.json().catch(()=>({ok:false,error:"ADMIN_BAD_JSON"}));
  return {http_status:response.status,body};
}

async function readGate(env){
  if(!env.CENTER_GATE?.get||!env.CENTER_GATE?.idFromName)return {ok:false,error:"CENTER_GATE_UNAVAILABLE",active:null};
  const gate=env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"));
  const response=await gate.fetch(new Request("https://gate.internal/state",{method:"GET"}));
  const body=await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}));
  return {http_status:response.status,...body};
}
function gateBinding(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function store(env,id,method="GET",body){const init={method,headers:{"content-type":"application/json"}};if(body!==undefined)init.body=JSON.stringify(body);const r=await gateBinding(env).fetch(new Request(`https://gate.internal/task/${encodeURIComponent(id)}`,init));return{http_status:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
function score(def,text){const checks=def.checks.map(([name,re])=>({name,ok:re.test(String(text||""))}));return{score:Math.round(100*checks.filter(x=>x.ok).length/checks.length),checks}}
async function runtimeSelftest(env,ctx){
  const cacheId=`${BENCHMARK_VERSION}-runtime-selftest`,cached=await store(env,cacheId);
  if(cached?.task?.benchmark_result)return json({...cached.task.benchmark_result,cached:true});
  const r=await app.fetch(new Request(`${ORIGIN}/v1/selftest`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"}),env,ctx),body=await r.json().catch(()=>null);
  const result={ok:r.ok&&body?.ok===true,runtime_selftest:true,http_status:r.status,error:body?.error||null,business_e2e:body?.business_e2e===true,configured:body?.configured===true,model_policy_pass:body?.model_policy_pass===true,company_diverse:body?.company_diverse===true,expert_nonempty:body?.expert_nonempty===true,judge_nonempty:body?.judge_nonempty===true,models:body?.models||[],elapsed_ms:body?.elapsed_ms||null};
  if(result.ok)await store(env,cacheId,"POST",{status:"benchmark-completed",benchmark_result:result,answers:null,judge:null}).catch(()=>{});
  return json(result,r.status||500);
}
async function benchmark(caseId,env,ctx){
  if(caseId==="runtime_selftest")return runtimeSelftest(env,ctx);
  const def=CASES[caseId];if(!def)return json({ok:false,error:"BENCHMARK_CASE_NOT_FOUND"},404);
  const cacheId=`${BENCHMARK_VERSION}-${caseId}`,cached=await store(env,cacheId);
  if(cached?.task?.benchmark_result)return json({...cached.task.benchmark_result,cached:true});
  const taskId=`clinical-matrix-${caseId}-${crypto.randomUUID()}`;
  const r=await app.fetch(new Request(`${ORIGIN}/v1/run`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:taskId,prompt:def.prompt,model_count:2,max_tokens:650,timeout_seconds:150,model_timeout_seconds:45,judge_timeout_seconds:60,roles:[def.role]})}),env,ctx),body=await r.json().catch(()=>null);
  if(!r.ok||body?.status!=="completed")return json({ok:false,case_id:caseId,http_status:r.status,error:body?.error||"BENCHMARK_RUN_FAILED",details:body?.details||null},r.status||502);
  const judge=String(body?.judge?.content||""),scored=score(def,judge);
  const result={ok:true,benchmark_version:BENCHMARK_VERSION,case_id:caseId,cached:false,score:scored.score,checks:scored.checks,model_count:Array.isArray(body?.models)?body.models.length:0,models:body?.models||[],company_diverse:body?.company_diverse===true,judge_model:body?.judge?.model||null,judge_output:judge,elapsed_ms:body?.elapsed_ms||null};
  await store(env,cacheId,"POST",{status:"benchmark-completed",benchmark_result:result,answers:null,judge:null}).catch(()=>{});
  return json(result);
}

async function adminContext(env,ctx){
  const health=await readApp("/health",env,ctx);
  const source=await readApp("/source",env,ctx);
  const acceptance=await readApp("/v1/acceptance/latest",env,ctx);
  const gate=await readGate(env);
  const version=env.CF_VERSION_METADATA||{};
  const ok=health.http_status===200&&health.body?.ok===true&&source.http_status===200&&source.body?.ok===true&&gate.ok===true;
  return json({
    ok,
    service:SERVICE,
    admin_read_only:true,
    observed_at:new Date().toISOString(),
    runtime_version:{id:version.id||null,tag:version.tag||null,timestamp:version.timestamp||null},
    health:health.body,
    source:source.body,
    acceptance:acceptance.body,
    active_task:gate.active||null,
    active_state_verified:gate.ok===true,
    secrets_redacted:true
  },ok?200:503);
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/v1/admin/context"){
      if(url.hostname!=="expert.internal")return json({ok:false,error:"POLICY_DENIED",message:"admin context is service-binding internal only"},403);
      return adminContext(env,ctx);
    }
    if(req.method==="GET"&&url.pathname.startsWith(`${BENCH_PATH}/`))return benchmark(url.pathname.slice(BENCH_PATH.length+1),env,ctx);
    return app.fetch(req,env,ctx);
  }
};
