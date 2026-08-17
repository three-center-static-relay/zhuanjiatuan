import assert from "node:assert/strict";
import {DIAG_META} from "../src/diag-medmcqa-direct.js";
assert.equal(DIAG_META.run,"medmcqa-direct-blind-v1-20260817");
assert.equal(DIAG_META.total,4183);
assert.equal(DIAG_META.chunk,22);
assert.deepEqual(DIAG_META.allowed_offsets,[0]);
assert.equal(DIAG_META.source_commit,"614599e5042052a374fca74590a2dd95c80a56b3");
assert.equal(DIAG_META.source_blob_sha,"91205dc035b83fd173464aa46e0008302a0b3771");
console.log(JSON.stringify({ok:true,suite:"medmcqa-direct-contract",paid_call:false,...DIAG_META}));
