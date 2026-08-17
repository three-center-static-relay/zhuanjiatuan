import assert from "node:assert/strict";
const u="https://expert-worker.a15280020511.workers.dev/v1/clinical-benchmark/3a9f6c2d-20260817/runtime_selftest";
const r=await fetch(u,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);
assert.equal(r.status,200,`HTTP_${r.status}:${JSON.stringify(b)}`);
console.log(JSON.stringify({ok:true,suite:"expert-runtime-selftest-http",http_status:r.status}));
