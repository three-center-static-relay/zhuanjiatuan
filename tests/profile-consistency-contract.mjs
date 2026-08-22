import assert from "node:assert/strict";
import {guardSemanticProfile} from "../src/profile-consistency.js";

const prompt="请比较在福州跑快递、送外卖、开网约车和当保安哪个好，综合收入、稳定性、自由度、成本、风险和长期可持续性。";
const badSemantic={task_domain:"coding",task_type:"coding",complexity:"high",reasoning_depth:"deep",context_size:"short",latency_priority:"normal",semantic_task_domains:["coding"]};
const guarded=guardSemanticProfile({prompt},badSemantic);
assert.equal(guarded.profile.task_domain,"business");
assert.equal(guarded.profile.task_type,"comparison");
assert.equal(guarded.profile.complexity,"high");
assert.equal(guarded.profile.reasoning_depth,"deep");
assert.ok(guarded.profile.semantic_task_domains.includes("business"));
assert.equal(guarded.guarded,true);
assert.ok(guarded.conflicts.length>=2);

const coding=guardSemanticProfile({prompt:"Review this Cloudflare Worker JavaScript API code and find the bug."},{task_domain:"coding",task_type:"coding",complexity:"high",reasoning_depth:"deep"});
assert.equal(coding.profile.task_domain,"coding");
assert.equal(coding.profile.task_type,"coding");
assert.equal(coding.guarded,false);

console.log("profile consistency contract: pass");
