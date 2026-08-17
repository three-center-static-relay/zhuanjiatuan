import assert from "node:assert/strict";
const url="https://expert-clinical-benchmark-20260817.a15280020511.workers.dev/probe";
let last=null;
for(let i=0;i<8;i++){
  try{
    const r=await fetch(url,{headers:{accept:"application/json"}});
    const b=await r.json().catch(()=>null);
    last={status:r.status,body:b};
    if(r.status===200&&b?.ok===true){
      assert.equal(b.service,"expert-worker");
      assert.equal(b.arbitrary_prompt,false);
      assert.equal(b.paid_inference,false);
      console.log(JSON.stringify({ok:true,suite:"clinical-benchmark-relay-probe",service_binding:true,paid_inference:false}));
      process.exit(0);
    }
  }catch(e){last={error:String(e?.message||e)}}
  await new Promise(r=>setTimeout(r,1000));
}
throw new Error(`BENCHMARK_RELAY_PROBE_FAILED:${JSON.stringify(last)}`);
