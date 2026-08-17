import app,{CenterGate} from "./guard.js";
export {CenterGate};

const ORIGIN="https://expert.internal";
const SERVICE="expert-worker";
const BENCH_PATH="/v1/clinical-benchmark/8c43af0e-20260817";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});

const PILOT_CASES={
  stemi:{
    role:"Emergency cardiology physician",
    prompt:`Clinical benchmark case. A 58-year-old man has 45 minutes of crushing substernal chest pressure, diaphoresis and nausea. BP 138/86, HR 96. ECG shows 2-3 mm ST elevation in II, III and aVF with reciprocal ST depression in I and aVL. No active bleeding and no known aspirin allergy. Return ONLY valid JSON with keys primary_diagnosis, must_not_miss, immediate_actions, key_tests, treatment, uncertainty. Prioritize time-critical management and do not invent unavailable data.`,
    checks:[
      ["diagnosis",/STEMI|ST[- ]?elevation myocardial infarction|inferior myocardial infarction/i],
      ["reperfusion",/PCI|percutaneous coronary|cath(?:eterization)? lab|reperfusion/i],
      ["antiplatelet",/aspirin|antiplatelet/i],
      ["monitoring",/ECG|electrocardiogram|troponin|cardiac monitor/i]
    ]
  },
  aortic_dissection:{
    role:"Emergency cardiovascular physician",
    prompt:`Clinical benchmark case. A 64-year-old man with long-standing hypertension develops abrupt maximal-at-onset tearing chest pain radiating to the back. Right arm BP is 178/96 and left arm BP is 146/82. The right radial pulse is weaker. A new early diastolic murmur is heard. ECG has nonspecific ST-T changes. Return ONLY valid JSON with keys primary_diagnosis, must_not_miss, immediate_actions, key_tests, treatment, uncertainty. Explicitly address the dangerous ACS mimic and time-critical management.`,
    checks:[
      ["diagnosis",/aortic dissection|acute aortic syndrome|type A dissection/i],
      ["imaging",/CT angi|CTA|transesophageal|TEE/i],
      ["antiimpulse",/beta[- ]?block|esmolol|labetalol|heart rate|blood pressure/i],
      ["surgery",/surg|cardiothoracic|aortic (?:team|center)|operative/i]
    ]
  },
  dka:{
    role:"Endocrine emergency physician",
    prompt:`Clinical benchmark case. A 24-year-old with type 1 diabetes missed insulin for 24 hours and has vomiting, abdominal pain, polyuria and deep rapid breathing. Glucose 468 mg/dL, beta-hydroxybutyrate 6.2 mmol/L, venous pH 7.18, bicarbonate 11 mmol/L, sodium 132 mmol/L, potassium 5.6 mmol/L, creatinine 1.4 mg/dL. Return ONLY valid JSON with keys primary_diagnosis, must_not_miss, immediate_actions, key_tests, treatment, uncertainty. Include fluid, insulin and electrolyte logic and avoid unsupported treatment.`,
    checks:[
      ["diagnosis",/diabetic ketoacidosis|\bDKA\b/i],
      ["fluids",/fluid|crystalloid|saline/i],
      ["insulin",/insulin/i],
      ["electrolytes",/potassium|electrolyte|beta[- ]?hydroxybutyrate|venous pH|ketone/i]
    ]
  }
};

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

function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function benchStore(env,id,method="GET",body){
  const init={method,headers:{"content-type":"application/json"}};if(body!==undefined)init.body=JSON.stringify(body);
  const r=await gate(env).fetch(new Request(`https://gate.internal/task/${encodeURIComponent(id)}`,init));
  return {http_status:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))};
}
function parseJsonLoose(text){
  const s=String(text||"").trim();if(!s)return null;
  const candidates=[s,s.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"")];
  for(const c of candidates){try{return JSON.parse(c)}catch{}}
  const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
  return null;
}
function scoreCase(def,text,parsed){
  const hay=JSON.stringify(parsed||{})+"\n"+String(text||"");
  const checks=def.checks.map(([name,re])=>({name,ok:re.test(hay)}));
  return {score:Math.round(100*checks.filter(x=>x.ok).length/checks.length),checks};
}
async function clinicalBenchmark(caseId,env,ctx){
  const def=PILOT_CASES[caseId];if(!def)return json({ok:false,error:"BENCHMARK_CASE_NOT_FOUND"},404);
  const cacheId=`diag-clinical-benchmark-20260817-${caseId}`;
  const cached=await benchStore(env,cacheId);
  if(cached?.task?.benchmark_result)return json({...cached.task.benchmark_result,cached:true});
  const taskId=`clinical-benchmark-${caseId}-${crypto.randomUUID()}`;
  const request=new Request(`${ORIGIN}/v1/run`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:taskId,prompt:def.prompt,model_count:2,max_tokens:700,timeout_seconds:150,model_timeout_seconds:45,judge_timeout_seconds:60,roles:[def.role]})});
  const response=await app.fetch(request,env,ctx),body=await response.json().catch(()=>null);
  if(!response.ok||body?.status!=="completed")return json({ok:false,case_id:caseId,http_status:response.status,error:body?.error||"BENCHMARK_RUN_FAILED",details:body?.details||null},response.status||502);
  const judgeText=String(body?.judge?.content||"");const parsed=parseJsonLoose(judgeText),scored=scoreCase(def,judgeText,parsed);
  const result={ok:true,case_id:caseId,cached:false,model_count:Array.isArray(body?.models)?body.models.length:0,models:body?.models||[],company_diverse:body?.company_diverse===true,judge_model:body?.judge?.model||null,judge_output:judgeText,parsed_json:parsed,score:scored.score,checks:scored.checks,elapsed_ms:body?.elapsed_ms||null};
  await benchStore(env,cacheId,"POST",{status:"benchmark-completed",benchmark_result:result,answers:null,judge:null}).catch(()=>{});
  return json(result);
}

async function adminContext(env,ctx){
  const health=await readApp("/health",env,ctx);
  const source=await readApp("/source",env,ctx);
  const acceptance=await readApp("/v1/acceptance/latest",env,ctx);
  const gateState=await readGate(env);
  const version=env.CF_VERSION_METADATA||{};
  const ok=health.http_status===200&&health.body?.ok===true&&source.http_status===200&&source.body?.ok===true&&gateState.ok===true;
  return json({
    ok,
    service:SERVICE,
    admin_read_only:true,
    observed_at:new Date().toISOString(),
    runtime_version:{id:version.id||null,tag:version.tag||null,timestamp:version.timestamp||null},
    health:health.body,
    source:source.body,
    acceptance:acceptance.body,
    active_task:gateState.active||null,
    active_state_verified:gateState.ok===true,
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
    if(req.method==="GET"&&url.pathname.startsWith(`${BENCH_PATH}/`)){
      const caseId=url.pathname.slice(BENCH_PATH.length+1);
      return clinicalBenchmark(caseId,env,ctx);
    }
    return app.fetch(req,env,ctx);
  }
};
