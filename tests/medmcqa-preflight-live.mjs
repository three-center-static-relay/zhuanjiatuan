import assert from "node:assert/strict";
const u="https://expert-worker.a15280020511.workers.dev/v1/diag/medmcqa-2f9c7e11-20260817/preflight";
const r=await fetch(u,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);
assert.equal(b?.dataset?.ok,true,`DATASET_PREFLIGHT_FAILED:${r.status}:${JSON.stringify(b)}`);
console.log(JSON.stringify({ok:true,suite:"medmcqa-dataset-preflight",http:r.status,dataset:b.dataset,openrouter_ok:b?.openrouter?.ok}));
