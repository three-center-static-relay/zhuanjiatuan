import assert from "node:assert/strict";
import {BENCHMARK_META} from "../src/benchmark-medmcqa-batch.js";
assert.equal(BENCHMARK_META.run,"medmcqa-blind-batch-v3-20260817");
assert.equal(BENCHMARK_META.dataset_blob_sha,"91205dc035b83fd173464aa46e0008302a0b3771");
assert.equal(BENCHMARK_META.max_rows,10);
assert.match(BENCHMARK_META.nonce,/^[a-f0-9]{32}$/);
console.log(JSON.stringify({ok:true,suite:"medmcqa-batch-contract",paid_call:false,run:BENCHMARK_META.run,max_rows:BENCHMARK_META.max_rows,dataset_blob_sha:BENCHMARK_META.dataset_blob_sha}));
