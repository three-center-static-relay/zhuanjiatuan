import assert from "node:assert/strict";
const BASE="https://expert-worker.a15280020511.workers.dev";
const h=await fetch(`${BASE}/health`,{headers:{accept:"application/json"}});const hb=await h.json().catch(()=>null);
assert.equal(h.status,200,`HEALTH_HTTP_${h.status}:${JSON.stringify(hb)}`);assert.equal(hb?.ok,true);
const c=await fetch(`${BASE}/v1/capabilities`,{headers:{accept:"application/json"}});const cb=await c.json().catch(()=>null);
assert.equal(c.status,200,`CAP_HTTP_${c.status}:${JSON.stringify(cb)}`);assert.equal(cb?.ok,true);
const cap=cb?.capabilities||cb?.capability||{};
assert.equal(cap.tools,false);assert.equal(cap.web,false);assert.equal(cap.experts,true);assert.equal(cap.judge,true);assert.equal(cap.company_diversity,true);assert.equal(cap.dynamic_models,true);
console.log(JSON.stringify({ok:true,suite:"top-hospital-expert-fresh",tools:false,web:false,experts:true,judge:true,company_diversity:true,dynamic_models:true}));