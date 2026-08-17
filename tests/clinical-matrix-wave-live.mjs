import assert from "node:assert/strict";
const u="https://expert-worker.a15280020511.workers.dev/health";
const r=await fetch(u,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);
assert.equal(r.status,200,`HTTP_${r.status}:${JSON.stringify(b)}`);
assert.equal(b?.ok,true,JSON.stringify(b));
assert.equal(b?.openrouter?.configured,true,JSON.stringify(b));
assert.equal(b?.openrouter?.transport,"rest-fetch",JSON.stringify(b));
console.log(JSON.stringify({ok:true,suite:"expert-runtime-openrouter-config-controlled",configured:true,transport:b.openrouter.transport,paid_call:false,controlled_branch:true}));
