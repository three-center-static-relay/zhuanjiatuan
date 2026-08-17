import assert from "node:assert/strict";
const u="https://expert-worker.a15280020511.workers.dev/v1/clinical-benchmark/3a9f6c2d-20260817/stemi";
const r=await fetch(u,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);
assert.equal(r.status,200,`HTTP_${r.status}:${JSON.stringify(b)}`);assert.equal(b?.ok,true,JSON.stringify(b));assert.equal(b?.model_count,2,JSON.stringify(b));assert.equal(b?.company_diverse,true,JSON.stringify(b));assert.ok(String(b?.judge_output||"").trim().length>80,JSON.stringify(b));
console.log(JSON.stringify({ok:true,suite:"clinical-stemi-runtime-only",score:b.score,checks:b.checks,cached:b.cached}));
