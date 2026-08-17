import assert from "node:assert/strict";
const BASE="https://expert-worker.a15280020511.workers.dev/v1/clinical-benchmark/3a9f6c2d-20260817";
const ids=["stemi","aortic_dissection","dka"];
for(const id of ids){const r=await fetch(`${BASE}/${id}`,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);assert.equal(r.status,200,`${id}:HTTP_${r.status}:${JSON.stringify(b)}`);assert.equal(b?.ok,true,`${id}:NOT_OK`);assert.equal(b?.model_count,2,`${id}:MODEL_COUNT`);assert.equal(b?.company_diverse,true,`${id}:DIVERSITY`);assert.ok(String(b?.judge_output||"").trim().length>80,`${id}:EMPTY`);assert.equal(b?.score,100,`${id}:SCORE_${b?.score}:${JSON.stringify(b?.checks)}`);assert.ok(b.checks.every(x=>x.ok===true),`${id}:CHECKS`)}
console.log(JSON.stringify({ok:true,suite:"clinical-matrix-wave-1",cases:ids,strict_all_checks:true,paid_inference:true}));
