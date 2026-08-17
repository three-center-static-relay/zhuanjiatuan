import assert from "node:assert/strict";
import {BENCHMARK_META} from "../src/benchmark-medmcqa.js";
assert.equal(BENCHMARK_META.run,"medmcqa-validation-4183-v1-20260817");
assert.equal(BENCHMARK_META.total,4183);
assert.equal(BENCHMARK_META.chunk,24);
assert.equal(BENCHMARK_META.dataset,"openlifescienceai/medmcqa");
assert.equal(BENCHMARK_META.split,"validation");
console.log(JSON.stringify({ok:true,suite:"medmcqa-benchmark-contract",paid_call:false,...BENCHMARK_META}));
