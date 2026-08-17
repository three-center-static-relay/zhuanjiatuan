import assert from "node:assert/strict";
import {BLOCK_LOADER_META} from "../src/benchmark-medmcqa-block-loader.js";
assert.equal(BLOCK_LOADER_META.run,"medmcqa-gold-mirror-v3-20260817");
assert.equal(BLOCK_LOADER_META.expected_blob_sha,"91205dc035b83fd173464aa46e0008302a0b3771");
assert.equal(BLOCK_LOADER_META.block_rows,480);
console.log(JSON.stringify({ok:true,suite:"medmcqa-block-loader-contract",paid_call:false,...BLOCK_LOADER_META}));
