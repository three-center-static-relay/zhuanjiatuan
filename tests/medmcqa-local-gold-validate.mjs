import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const RAW="https://raw.githubusercontent.com/aistairc/medLLM_QA_benchmark/main/data/en/MedMCQA/medmcqa.jsonl";
const SHA="91205dc035b83fd173464aa46e0008302a0b3771";
const rr=await fetch(RAW,{headers:{accept:"text/plain"}});
assert.equal(rr.status,200,`RAW_HTTP_${rr.status}`);
const raw=await rr.text();
const blobSha=createHash("sha1").update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest("hex");
assert.equal(blobSha,SHA,`BLOB_SHA_${blobSha}`);
const rows=raw.split(/\r?\n/).filter(Boolean).map((line,i)=>{try{return JSON.parse(line)}catch{throw new Error(`BAD_JSONL_${i}`)}});
assert.equal(rows.length,4183,`ROW_COUNT_${rows.length}`);
let emptyQuestion=0,badChoices=0,emptyChoice=0,badAnswer=0;
const choiceLens={};
const answerShapes={};
for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(!String(r?.problem_text||"").trim())emptyQuestion++;
  const len=Array.isArray(r?.choices)?r.choices.length:-1;choiceLens[len]=(choiceLens[len]||0)+1;
  if(len!==4)badChoices++;
  if(Array.isArray(r?.choices)&&r.choices.some(x=>!String(x??"").trim()))emptyChoice++;
  const a=String(r?.answer?.[0]||"").trim().toUpperCase();answerShapes[a||"<empty>"]=(answerShapes[a||"<empty>"]||0)+1;
  if(!/^[ABCD]$/.test(a))badAnswer++;
}
assert.equal(emptyQuestion,0,`EMPTY_QUESTION_COUNT_${emptyQuestion}`);
assert.equal(badChoices,0,`BAD_CHOICES_COUNT_${badChoices}:${JSON.stringify(choiceLens)}`);
assert.equal(emptyChoice,0,`EMPTY_CHOICE_COUNT_${emptyChoice}`);
assert.equal(badAnswer,0,`BAD_ANSWER_COUNT_${badAnswer}:${JSON.stringify(answerShapes)}`);
console.log(JSON.stringify({ok:true,suite:"medmcqa-local-gold-validate",paid_call:false,total:rows.length,bytes:Buffer.byteLength(raw),blob_sha:blobSha,choice_lengths:choiceLens,answer_shapes:answerShapes}));
