import assert from "node:assert/strict";
const BASE="https://expert-worker.a15280020511.workers.dev/v1/clinical-benchmark/3a9f6c2d-20260817";
const r=await fetch(`${BASE}/stemi`,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);
assert.equal(r.status,200,`HTTP_${r.status}:${JSON.stringify(b)}`);assert.equal(b?.ok,true);assert.equal(b?.model_count,2);assert.equal(b?.company_diverse,true);
const m=Object.fromEntries((b?.checks||[]).map(x=>[x.name,x.ok]));assert.equal(m.dx,true,JSON.stringify(b?.checks));assert.equal(m.reperfusion,true,JSON.stringify(b?.checks));assert.equal(m.antiplatelet,true,JSON.stringify(b?.checks));
console.log(JSON.stringify({ok:true,suite:"clinical-stemi-core",score:b.score,checks:b.checks,cached:b.cached}));
