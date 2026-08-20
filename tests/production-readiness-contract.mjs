import assert from "node:assert/strict";
import { classifyExpertFailure } from "../src/error-policy.js";

assert.equal(classifyExpertFailure({error:"AI_GATEWAY_NOT_CONFIGURED"}).action,"quarantine");
assert.equal(classifyExpertFailure({error:"UPSTREAM_UNAVAILABLE"}).retry,false);
assert.equal(classifyExpertFailure({error:"TIMEOUT"}).action,"fail-closed");
console.log(JSON.stringify({ok:true,suite:"production-readiness-contract"}));
