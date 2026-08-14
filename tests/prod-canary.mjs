import assert from "node:assert/strict";
const url="https://expert-worker.a15280020511.workers.dev/v1/.canary/20260815-a9f7c2";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let last=null;
for(let i=0;i<18;i++){
  try{
    const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json","user-agent":"three-center-prod-canary/2026-08-15"},body:"{}"});
    const body=await r.json().catch(()=>null);last={status:r.status,body};
    if(r.status===409){await sleep(1000);continue}
    assert.equal(r.status,200,`production canary HTTP ${r.status}: ${JSON.stringify(body)}`);
    assert.equal(body?.ok,true,"production canary must pass");
    assert.equal(body?.business_e2e,true,"production canary must be real business E2E");
    assert.equal(body?.configured,true,"OPENROUTER_API_KEY must be configured");
    assert.equal(body?.model_policy_pass,true,"selected models must satisfy policy");
    assert.equal(body?.company_diverse,true,"models must come from different companies");
    assert.equal(body?.expert_nonempty,true,"expert output must be non-empty");
    assert.equal(body?.judge_nonempty,true,"judge output must be non-empty");
    assert.equal(body?.content_scrubbed,true,"test content must be scrubbed from operational storage");
    assert.equal(Array.isArray(body?.models)&&body.models.length,2,"canary must use exactly two models");
    console.log(JSON.stringify({ok:true,suite:"expert-production-canary",business_e2e:true,models:body.models,output_digest:body.output_digest,elapsed_ms:body.elapsed_ms}));
    process.exit(0);
  }catch(e){last={error:String(e?.stack||e)};if(i<17){await sleep(1000);continue}}
}
console.error(JSON.stringify({ok:false,suite:"expert-production-canary",last}));
process.exit(1);
