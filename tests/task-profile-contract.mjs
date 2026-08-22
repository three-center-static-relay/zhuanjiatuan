import assert from "node:assert/strict";
import { profileExpertTask, TASK_PROFILE_SCHEMA } from "../src/task-profile.js";

const legal=profileExpertTask({prompt:"请对这份合同的民事法律风险进行深度合规分析"});
assert.equal(legal.task_domain,"legal");
assert.equal(legal.task_type,"analysis");
assert.equal(legal.reasoning_depth,"deep");
assert.equal(legal.cost_priority,"balanced");

const coding=profileExpertTask({prompt:"Review this Cloudflare Worker API code and find the bug."});
assert.equal(coding.task_domain,"coding");
assert.equal(coding.task_type,"coding");

const occupation=profileExpertTask({prompt:"请比较在福州跑快递、送外卖、开网约车和当保安哪个好，综合收入、稳定性、自由度、成本、风险和长期可持续性。"});
assert.equal(occupation.task_domain,"business");
assert.equal(occupation.task_type,"comparison");
assert.notEqual(occupation.task_domain,"coding");
assert.notEqual(occupation.task_type,"coding");

const explicit=profileExpertTask({
  prompt:"general task",
  task_domain:"finance",
  task_type:"comparison",
  complexity:"high",
  reasoning_depth:"deep",
  context_size:"long",
  latency_priority:"fast",
  cost_priority:"quality"
});
assert.deepEqual(explicit,{
  task_domain:"finance",task_type:"comparison",complexity:"high",reasoning_depth:"deep",context_size:"long",latency_priority:"fast",cost_priority:"quality"
});

const invalid=profileExpertTask({prompt:"hello",task_domain:"arbitrary-provider",cost_priority:"free-at-any-cost"});
assert.equal(invalid.task_domain,"general");
assert.equal(invalid.cost_priority,"balanced");
assert.ok(TASK_PROFILE_SCHEMA.task_domain.includes("quantitative"));

console.log("task profile contract: pass");
