import assert from "node:assert/strict";
import { profileExpertTask, TASK_PROFILE_SCHEMA } from "../src/task-profile.js";

const legal=profileExpertTask({prompt:"请对这份合同的民事法律风险进行深度合规分析"});
assert.equal(legal.task_domain,"legal");
assert.equal(legal.task_type,"analysis");
assert.equal(legal.reasoning_depth,"deep");
assert.equal(legal.cost_priority,"quality");

const coding=profileExpertTask({prompt:"Review this Cloudflare Worker API code and find the bug."});
assert.equal(coding.task_domain,"coding");
assert.equal(coding.task_type,"coding");

const explicit=profileExpertTask({
  prompt:"general task",
  task_domain:"finance",
  task_type:"comparison",
  complexity:"high",
  reasoning_depth:"deep",
  context_size:"long",
  latency_priority:"fast",
  cost_priority:"balanced"
});
assert.deepEqual(explicit,{
  task_domain:"finance",task_type:"comparison",complexity:"high",reasoning_depth:"deep",context_size:"long",latency_priority:"fast",cost_priority:"balanced"
});

const invalid=profileExpertTask({prompt:"hello",task_domain:"arbitrary-provider",cost_priority:"free-at-any-cost"});
assert.equal(invalid.task_domain,"general");
assert.equal(invalid.cost_priority,"quality");
assert.ok(TASK_PROFILE_SCHEMA.task_domain.includes("quantitative"));

console.log("task profile contract: pass");
