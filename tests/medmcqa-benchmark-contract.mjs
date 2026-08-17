import assert from "node:assert/strict";
import {BENCHMARK_META} from "../src/benchmark-medmcqa.js";
assert.equal(BENCHMARK_META.run,"medmcqa-gold-mirror-v3-20260817");
assert.equal(BENCHMARK_META.chunk,24);
assert.equal(BENCHMARK_META.data_block_rows,480);
assert.equal(BENCHMARK_META.summary_page_chunks,40);
assert.equal(BENCHMARK_META.dataset,"aistairc/medLLM_QA_benchmark:data/en/MedMCQA/medmcqa.jsonl");
assert.equal(BENCHMARK_META.expected_blob_sha,"91205dc035b83fd173464aa46e0008302a0b3771");
console.log(JSON.stringify({ok:true,suite:"medmcqa-benchmark-contract",paid_call:false,...BENCHMARK_META}));
