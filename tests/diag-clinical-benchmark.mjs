import assert from "node:assert/strict";

const BASE="https://expert-worker.a15280020511.workers.dev";

async function runCase(id,prompt,role){
  const r=await fetch(`${BASE}/v1/run`,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({
      task_id:`diag-clinical-${id}-20260817-${Date.now()}`,
      prompt,
      roles:[role],
      model_count:2,
      max_tokens:650,
      timeout_seconds:150,
      model_timeout_seconds:45,
      judge_timeout_seconds:60
    })
  });
  const b=await r.json().catch(()=>null);
  assert.equal(r.status,200,`${id}:HTTP_${r.status}:${JSON.stringify(b)}`);
  assert.equal(b?.ok,true,`${id}:NOT_OK:${JSON.stringify(b)}`);
  assert.equal(b?.status,"completed",`${id}:NOT_COMPLETED`);
  assert.equal(Array.isArray(b?.models),true,`${id}:NO_MODELS`);
  assert.equal(b.models.length,2,`${id}:MODEL_COUNT`);
  assert.equal(b?.company_diverse,true,`${id}:NOT_DIVERSE`);
  const out=String(b?.judge?.content||"").toLowerCase();
  assert.ok(out.length>80,`${id}:EMPTY_JUDGE`);
  return out;
}

const aortic=await runCase(
  "aortic-dissection",
  `Synthetic clinical benchmark. A 63-year-old man has abrupt maximal-at-onset tearing chest pain radiating to the back, right arm blood pressure 185/95 and left arm 145/80, a new early diastolic murmur, and a widened mediastinum on chest radiograph. ECG has nonspecific ST-T changes; initial troponin is mildly elevated. He is currently perfusing and not in cardiac arrest. Give the single most likely diagnosis, urgency, immediate diagnostic/management steps, and dangerous treatments that should be avoided until the diagnosis is excluded. Return a compact answer; do not give generic disclaimers.`,
  "Emergency medicine and cardiovascular critical care"
);
assert.ok(aortic.includes("aortic dissection")||aortic.includes("acute aortic syndrome"),"aortic-dissection:DIAGNOSIS_MISSED");
assert.ok(aortic.includes("ct angi")||aortic.includes("cta")||aortic.includes("computed tomography angi"),"aortic-dissection:CTA_MISSED");
assert.ok(aortic.includes("beta")&&(aortic.includes("esmolol")||aortic.includes("labetalol")||aortic.includes("heart rate")),"aortic-dissection:ANTI_IMPULSE_MISSED");
assert.ok(aortic.includes("surg")||aortic.includes("cardiothoracic"),"aortic-dissection:SURGICAL_ESCALATION_MISSED");
assert.ok(aortic.includes("thrombol")||aortic.includes("fibrinol"),"aortic-dissection:THROMBOLYSIS_HARM_GUARD_MISSED");
assert.ok(aortic.includes("anticoag")||aortic.includes("heparin"),"aortic-dissection:ANTICOAG_HARM_GUARD_MISSED");

const hyperk=await runCase(
  "hyperkalemia",
  `Synthetic clinical benchmark. A 71-year-old with CKD presents with weakness and presyncope. Potassium is 7.2 mmol/L, creatinine is 3.8 mg/dL. ECG shows tall peaked T waves, PR prolongation and QRS widening. Blood glucose is 5.2 mmol/L. State the diagnosis, urgency, first actions in correct clinical priority, monitoring, and definitive potassium-removal options. Return a compact answer; do not give generic disclaimers.`,
  "Emergency medicine, nephrology and critical care"
);
assert.ok(hyperk.includes("hyperkal")||hyperk.includes("hyperkala"),"hyperkalemia:DIAGNOSIS_MISSED");
assert.ok(hyperk.includes("calcium gluconate")||hyperk.includes("calcium chloride")||hyperk.includes("iv calcium")||hyperk.includes("intravenous calcium"),"hyperkalemia:CALCIUM_MISSED");
assert.ok(hyperk.includes("insulin")&&(hyperk.includes("glucose")||hyperk.includes("dextrose")),"hyperkalemia:INSULIN_GLUCOSE_MISSED");
assert.ok(hyperk.includes("ecg")||hyperk.includes("cardiac monitor")||hyperk.includes("telemetry"),"hyperkalemia:MONITORING_MISSED");
assert.ok(hyperk.includes("dialysis")||hyperk.includes("renal replacement"),"hyperkalemia:DEFINITIVE_REMOVAL_MISSED");

console.log(JSON.stringify({ok:true,suite:"clinical-benchmark-batch-1",cases:["aortic-dissection","hyperkalemia"],case_count:2,model_count_per_case:2,paid_inference:true}));
