import assert from "node:assert/strict";
import fs from "node:fs";

const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

assert.match(entry,/\/v1\/admin\/context/);
assert.match(entry,/expert\.internal/);
assert.match(entry,/admin_read_only:true/);
assert.match(entry,/CF_VERSION_METADATA/);
assert.match(entry,/active_task:gate\.active\|\|null/);
assert.match(entry,/secrets_redacted:true/);
assert.match(entry,/requestScopedPanelEnv/);
assert.match(entry,/input\?\.model_count/);
assert.match(entry,/EXPERT_MAX_LANES:String\(Math\.min\(configuredLanes,Math\.max\(2,total\)\)\)/);
assert.match(entry,/EXPERT_MAX_EXPERTS:String\(experts\)/);
assert.match(entry,/EXPERT_MAX_JUDGES:String\(judges\)/);
assert.match(entry,/SOFT_EXECUTION_POLICY/);
assert.match(entry,/Prioritize price-performance/);
assert.match(entry,/Control answer length softly/);
assert.match(entry,/Tools are forbidden/);
assert.match(entry,/delete normalized\.max_tokens/);
assert.match(entry,/normalized\.cost_priority="balanced"/);
assert.match(entry,/normalized\.cost_mode="balanced"/);
assert.match(entry,/normalized\.tools=false/);
assert.match(entry,/normalized\.web=false/);
assert.match(entry,/semanticProfile/);
assert.match(entry,/profile_source="ai-gateway-semantic"/);
assert.match(entry,/semantic_task_domains/);
assert.match(entry,/Classify the task for expert orchestration only/);
assert.match(entry,/dynamicRouteModel\(env,metadata\)/);
assert.match(entry,/stage:"planner",lane:"1",capability:"strategy"/);
assert.match(entry,/cf-aig-step/);
assert.match(entry,/req\.clone\(\)\.json\(\)/);
assert.doesNotMatch(entry,/max_tokens:8/);
assert.match(wrangler,/"main"\s*:\s*"src\/admin-entry\.js"/);
assert.match(wrangler,/"version_metadata"\s*:\s*\{\s*"binding"\s*:\s*"CF_VERSION_METADATA"\s*\}/);

console.log(JSON.stringify({ok:true,suite:"expert-admin-context-contract",read_only:true,internal_only:true,version_metadata:true,request_scoped_panel_budget:true,soft_cost_length:true,no_token_cap:true,tools_forbidden:true,semantic_profile:"ai-gateway",gateway_step_observed:true}));
