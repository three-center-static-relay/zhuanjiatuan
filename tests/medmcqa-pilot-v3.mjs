import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const RAW="https://raw.githubusercontent.com/aistairc/medLLM_QA_benchmark/main/data/en/MedMCQA/medmcqa.jsonl";
const BASE="https://expert-worker.a15280020511.workers.dev/v1/diag/medmcqa-batch-7f2d9a31-20260817";
const SHA="91205dc035b83fd173464aa46e0008302a0b3771";
const NONCE="b4e8476c8e574c2db71aa49dcf86d291";
const d=await fetch(RAW,{headers:{accept:"text/plain"}});const bytes=Buffer.from(await d.arrayBuffer());assert.equal(d.status,200,`RAW_HTTP_${d.status}`);
const h=createHash("sha1");h.update(Buffer.from(`blob ${bytes.length}\0`));h.update(bytes);assert.equal(h.digest("hex"),SHA,"DATASET_SHA_MISMATCH");
const all=bytes.toString("utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse);assert.ok(all.length>=4000,"DATASET_TOO_SMALL");
const rows=all.slice(0,10).map((x,i)=>({id:String(x.problem_id||i),question:String(x.problem_text),choices:x.choices.map(String),gold:String(x.answer?.[0]||"").toUpperCase()}));
const sr=await fetch(`${BASE}/session/start`,{method:"POST",headers:{"x-benchmark-nonce":NONCE,accept:"application/json"}});const s=await sr.json().catch(()=>null);assert.equal(sr.status,200,`SESSION_HTTP_${sr.status}:${JSON.stringify(s)}`);assert.equal(s?.ok,true,JSON.stringify(s));assert.equal(s?.dataset_blob_sha,SHA,JSON.stringify(s));assert.ok(String(s?.token||"").length>40,"NO_TOKEN");
const token=s.token,batchId="pilot-v3b-0000",waveId="pilot-v3b";
const br=await fetch(`${BASE}/batch`,{method:"POST",headers:{"content-type":"application/json","x-benchmark-token":token,accept:"application/json"},body:JSON.stringify({dataset_blob_sha:SHA,wave_id:waveId,batch_id:batchId,rows})});const b=await br.json().catch(()=>null);
if(!(br.status===200&&b?.ok===true)){
  const fr=await fetch(`${BASE}/batch/failure`,{method:"POST",headers:{"content-type":"application/json","x-benchmark-token":token,accept:"application/json"},body:JSON.stringify({dataset_blob_sha:SHA,wave_id:waveId,batch_id:batchId,n:10,reason:`HTTP_${br.status}_${b?.error||"BATCH_FAILED"}`})});const f=await fr.json().catch(()=>null);assert.equal(fr.status,200,`FAIL_RECORD_HTTP_${fr.status}:${JSON.stringify(f)}`);
}else{
  assert.equal(b.n,10,JSON.stringify(b));assert.ok(Array.isArray(b.primary_models)&&b.primary_models.length===2,JSON.stringify(b));assert.notEqual(String(b.primary_models[0]).split('/')[0].toLowerCase(),String(b.primary_models[1]).split('/')[0].toLowerCase(),JSON.stringify(b));
}
const cr=await fetch(`${BASE}/wave/commit`,{method:"POST",headers:{"content-type":"application/json","x-benchmark-token":token,accept:"application/json"},body:JSON.stringify({wave_id:waveId,batch_ids:[batchId]})});const c=await cr.json().catch(()=>null);assert.equal(cr.status,200,`COMMIT_HTTP_${cr.status}:${JSON.stringify(c)}`);assert.equal(c?.ok,true,JSON.stringify(c));assert.equal(c?.n,10,JSON.stringify(c));assert.ok(Number(c.completed)>=8,`LOW_COMPLETION:${JSON.stringify(c)}`);assert.ok(Number(c.parsed)>=8,`LOW_PARSE:${JSON.stringify(c)}`);
console.log(JSON.stringify({ok:true,suite:"medmcqa-pilot-v3b",paid_call:true,n:c.n,correct:c.correct,completed:c.completed,parsed:c.parsed,cost:c.cost,whole_batch_failures:c.whole_batch_failures,dataset_rows:all.length}));
