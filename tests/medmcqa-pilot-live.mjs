import assert from "node:assert/strict";
const BASE="https://expert-worker.a15280020511.workers.dev/v1/diag/medmcqa-2f9c7e11-20260817";
const r=await fetch(`${BASE}/chunk?offset=0&length=24`,{headers:{accept:"application/json"}});
const b=await r.json().catch(()=>null);
assert.equal(r.status,200,`HTTP_${r.status}:${JSON.stringify(b)}`);
assert.equal(b?.ok,true,JSON.stringify(b));
assert.equal(b?.n,24,JSON.stringify(b));
assert.ok(Array.isArray(b?.models)&&b.models.length===2,JSON.stringify(b));
console.log(JSON.stringify({ok:true,suite:"medmcqa-pilot-transport",n:b.n,correct:b.correct,completed:b.completed,parsed:b.parsed,cost:b.cost,models:b.models,cached:b.cached}));
