import assert from "node:assert/strict";
const BASE="https://expert-worker.a15280020511.workers.dev";
const BENCH="/v1/clinical-benchmark/3a9f6c2d-20260817";
const h=await fetch(`${BASE}/health`,{headers:{accept:"application/json"}});const hb=await h.json().catch(()=>null);
assert.equal(h.status,200,`HEALTH_HTTP_${h.status}:${JSON.stringify(hb)}`);
assert.equal(hb?.ok,true,JSON.stringify(hb));
assert.equal(hb?.openrouter?.configured,true,JSON.stringify(hb));
assert.equal(hb?.openrouter?.transport,"rest-fetch",JSON.stringify(hb));
const ids=["aortic_dissection","hyperkalemia","ectopic_rupture","asymptomatic_bacteriuria"];
const results=[];
for(const id of ids){
  const r=await fetch(`${BASE}${BENCH}/${id}`,{headers:{accept:"application/json"}});const b=await r.json().catch(()=>null);
  assert.equal(r.status,200,`${id}:HTTP_${r.status}:${JSON.stringify(b)}`);
  assert.equal(b?.ok,true,`${id}:NOT_OK:${JSON.stringify(b)}`);
  assert.ok(Number.isFinite(Number(b?.score)),`${id}:NO_SCORE:${JSON.stringify(b)}`);
  assert.ok(Number(b.score)>=80,`${id}:SCORE_${b.score}:${JSON.stringify(b)}`);
  assert.equal(b?.model_count,2,`${id}:MODEL_COUNT:${JSON.stringify(b)}`);
  assert.equal(b?.company_diverse,true,`${id}:NOT_COMPANY_DIVERSE:${JSON.stringify(b)}`);
  assert.ok(String(b?.judge_output||"").length>80,`${id}:EMPTY_JUDGE`);
  results.push({id,score:Number(b.score),cached:Boolean(b.cached)});
}
const mean=results.reduce((s,x)=>s+x.score,0)/results.length;
assert.ok(mean>=85,`MEAN_SCORE_${mean}:${JSON.stringify(results)}`);
console.log(JSON.stringify({ok:true,suite:"clinical-sentinel-wave-live",paid_call:true,case_count:results.length,minimum_case_score:80,minimum_mean_score:85,mean_score:mean,results}));
