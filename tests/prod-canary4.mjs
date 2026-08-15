import assert from "node:assert/strict";
const url="https://expert-worker.a15280020511.workers.dev/v1/.canary/extreme4-20260815";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let last=null;
for(let i=0;i<30;i++){
  try{
    const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json","user-agent":"three-center-prod-extreme4/2026-08-15"},body:"{}"});
    const body=await r.json().catch(()=>null);last={status:r.status,body};
    if(r.status===409){await sleep(1000);continue}
    assert.equal(r.status,200,`production extreme4 HTTP ${r.status}: ${JSON.stringify(body)}`);
    assert.equal(body?.ok,true);
    assert.equal(body?.business_e2e,true);
    assert.equal(body?.configured,true);
    assert.equal(body?.model_policy_pass,true);
    assert.equal(body?.company_diverse,true);
    assert.equal(body?.experts_nonempty,3);
    assert.equal(body?.judge_nonempty,true);
    assert.equal(body?.content_scrubbed,true);
    assert.equal(body?.max_tokens,1024);
    assert.equal(Array.isArray(body?.models)&&body.models.length,4,true);
    assert.ok(String(body?.output_digest||"").length===64);
    console.log(JSON.stringify({ok:true,suite:"expert-production-extreme4",business_e2e:true,models:body.models,experts_nonempty:body.experts_nonempty,judge_nonempty:body.judge_nonempty,output_digest:body.output_digest,elapsed_ms:body.elapsed_ms}));
    process.exit(0);
  }catch(e){last={error:String(e?.stack||e),previous:last};if(i<29){await sleep(1000);continue}}
}
console.error(JSON.stringify({ok:false,suite:"expert-production-extreme4",last}));
process.exit(1);
