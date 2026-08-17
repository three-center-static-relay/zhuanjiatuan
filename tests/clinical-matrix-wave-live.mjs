import assert from "node:assert/strict";
const BASE="https://expert-worker.a15280020511.workers.dev";
const BENCH="/v1/clinical-benchmark/3a9f6c2d-20260817";
const r=await fetch(`${BASE}${BENCH}/aortic_dissection`,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);
assert.equal(r.status,200,`HTTP_${r.status}:${JSON.stringify(b)}`);
assert.equal(b?.ok,true,`NOT_OK:${JSON.stringify(b)}`);
assert.ok(Number.isFinite(Number(b?.score)),`NO_SCORE:${JSON.stringify(b)}`);
assert.ok(String(b?.judge_output||"").length>80,`EMPTY_JUDGE:${JSON.stringify(b)}`);
console.log(JSON.stringify({ok:true,suite:"aortic-clinical-runtime-isolation",cached:Boolean(b.cached),score:Number(b.score),model_count:b.model_count,company_diverse:b.company_diverse,judge_model:b.judge_model,checks:b.checks}));
