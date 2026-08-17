import assert from "node:assert/strict";
const BASE="https://expert-worker.a15280020511.workers.dev/v1/clinical-benchmark/8c43af0e-20260817";
const ids=["stemi","aortic_dissection","dka"];
const rows=[];
for(const id of ids){
  const r=await fetch(`${BASE}/${id}`,{headers:{accept:"application/json"}});
  const b=await r.json().catch(()=>null);
  assert.equal(r.status,200,`${id}:HTTP_${r.status}:${JSON.stringify(b)}`);
  assert.equal(b?.ok,true,`${id}:not-ok`);
  assert.equal(b?.model_count,2,`${id}:model-count`);
  assert.equal(b?.company_diverse,true,`${id}:company-diversity`);
  assert.ok(String(b?.judge_output||"").trim(),`${id}:empty-judge`);
  assert.ok(b?.parsed_json&&typeof b.parsed_json==="object",`${id}:judge-not-json`);
  assert.equal(b?.score,100,`${id}:score:${b?.score}:${JSON.stringify(b?.checks)}`);
  assert.ok(Array.isArray(b?.checks)&&b.checks.every(x=>x.ok===true),`${id}:check-failure`);
  rows.push({id,score:b.score,models:b.models,judge_model:b.judge_model,cached:b.cached,elapsed_ms:b.elapsed_ms});
}
console.log(JSON.stringify({ok:true,suite:"clinical-benchmark-pilot-live",case_count:rows.length,all_scores_100:true,company_diverse:true,structured_judge:true,rows}));
