import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const RAW="https://raw.githubusercontent.com/aistairc/medLLM_QA_benchmark/main/data/en/MedMCQA/medmcqa.jsonl";
const LOADER="https://expert-worker.a15280020511.workers.dev/v1/diag/medmcqa-loader-7c1d6b4a-20260817";
const SHA="91205dc035b83fd173464aa46e0008302a0b3771";
const BLOCK=480;
const rr=await fetch(RAW,{headers:{accept:"text/plain"}});
assert.equal(rr.status,200,`RAW_HTTP_${rr.status}`);
const raw=await rr.text();
const blobSha=createHash("sha1").update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest("hex");
assert.equal(blobSha,SHA,`BLOB_SHA_${blobSha}`);
const rows=raw.split(/\r?\n/).filter(Boolean).map((line,i)=>{try{return JSON.parse(line)}catch(e){throw new Error(`BAD_JSONL_${i}`)}});
assert.equal(rows.length,4183,`ROW_COUNT_${rows.length}`);
for(let i=0;i<rows.length;i++){
  const r=rows[i];
  assert.ok(String(r?.problem_text||"").trim(),`EMPTY_QUESTION_${i}`);
  assert.ok(Array.isArray(r?.choices)&&r.choices.length===4,`CHOICES_${i}_${JSON.stringify(r?.choices)}`);
  assert.ok(r.choices.every(x=>String(x??"").trim()),`EMPTY_CHOICE_${i}`);
  assert.match(String(r?.answer?.[0]||"").trim().toUpperCase(),/^[ABCD]$/,`ANSWER_${i}_${JSON.stringify(r?.answer)}`);
}
let blocks=0;
for(let start=0;start<rows.length;start+=BLOCK){
  const part=rows.slice(start,start+BLOCK);
  const r=await fetch(`${LOADER}/block`,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({blob_sha:SHA,start,rows:part})});
  const b=await r.json().catch(()=>null);
  assert.equal(r.status,200,`BLOCK_${start}_HTTP_${r.status}:${JSON.stringify(b)}`);
  assert.equal(b?.ok,true,`BLOCK_${start}_NOT_OK:${JSON.stringify(b)}`);
  assert.equal(b?.start,start,JSON.stringify(b));
  assert.equal(b?.count,part.length,JSON.stringify(b));
  blocks++;
}
const mr=await fetch(`${LOADER}/meta`,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({blob_sha:SHA,total:rows.length,blocks})});
const mb=await mr.json().catch(()=>null);
assert.equal(mr.status,200,`META_HTTP_${mr.status}:${JSON.stringify(mb)}`);
assert.equal(mb?.ok,true,`META_NOT_OK:${JSON.stringify(mb)}`);
assert.equal(mb?.total,4183,JSON.stringify(mb));
assert.equal(mb?.data_blocks,blocks,JSON.stringify(mb));
assert.equal(mb?.chunks,Math.ceil(4183/24),JSON.stringify(mb));
console.log(JSON.stringify({ok:true,suite:"medmcqa-block-load-live",paid_call:false,total:mb.total,blocks:mb.data_blocks,chunks:mb.chunks,blob_sha:mb.blob_sha}));
