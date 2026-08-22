import assert from "node:assert/strict";
import fs from "node:fs";

const worker=fs.readFileSync(new URL("../src/dynamic-index.js",import.meta.url),"utf8");
const entry=fs.readFileSync(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const gateway=fs.readFileSync(new URL("../src/ai-gateway.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");

// Organization layer: AI-Gateway-routed panel architect owns task-specific composition.
assert.match(worker,/dynamic_professions:true/);
assert.match(worker,/dynamic_expert_count:true/);
assert.match(worker,/dynamic_judge_count:true/);
assert.match(worker,/dynamic_rounds:true/);
assert.match(worker,/dynamic_topology:true/);
assert.match(worker,/dynamic_cost_mode:true/);
assert.match(worker,/dynamic_concurrency:true/);
assert.match(worker,/architectPlan/);
assert.match(worker,/Expert professions must be task-specific/);
assert.match(worker,/"judges":0-\$\{l\.maxJudges\}/);
assert.match(worker,/"rounds":1-\$\{l\.maxRounds\}/);
assert.match(worker,/"topology":"parallel\|serial\|hybrid"/);
assert.match(worker,/"cost_mode":"free-first\|balanced\|quality-first"/);
assert.match(worker,/function expertConcurrency\(plan,l\)/);
assert.match(worker,/plan\.topology===\"serial\"/);
assert.match(worker,/plan\.topology===\"hybrid\"/);
assert.match(worker,/plan\.experts\.length/);
assert.match(worker,/reasoning_depth==="deep"/);
assert.match(worker,/latency_priority==="fast"/);

// Dynamic cost mode is planner-owned only when the caller has not supplied an explicit valid control-plane intent.
assert.match(worker,/explicitCostMode=String\(input\?\.cost_mode\|\|\"\"\)/);
assert.match(worker,/COST_MODES\.has\(explicitCostMode\)\?explicitCostMode:normalizeCostMode\(raw\?\.cost_mode/);

// Task profiling is semantic first through an AI Gateway dynamic route, with deterministic fallback.
assert.match(entry,/semanticProfile/);
assert.match(entry,/profile_source="ai-gateway-semantic"/);
assert.match(entry,/stage:"planner",lane:"1",capability:"strategy"/);
assert.match(entry,/dynamicRouteModel\(env,metadata\)/);

// Safe runtime controls adapt to the semantic profile but remain bounded by fixed ceilings.
assert.match(entry,/adaptiveConcurrency/);
assert.match(entry,/EXPERT_INTERNAL_CONCURRENCY:String\(internal\)/);
assert.match(entry,/adaptiveTaskSeconds/);
assert.match(entry,/applyAdaptiveRuntimeControls/);
assert.match(entry,/runtime_control_source="semantic-profile-bounded"/);
assert.match(entry,/finalSynthesisCostMode/);
assert.match(entry,/finalSynthesisTimeout/);
assert.match(entry,/cost_mode:costMode/);
assert.match(entry,/delete normalized\.cost_mode/);
assert.doesNotMatch(entry,/normalized\.cost_mode="balanced"/);

// Final-answer quality is mandatory; Expert #1 may not silently become the user answer.
assert.match(entry,/gatewayFinalSynthesis/);
assert.match(entry,/final_answer_source="panel-final-judge"/);
assert.match(entry,/final_answer_source="gateway-final-synthesis"/);
assert.match(entry,/expert_one_direct_final:false/);
assert.match(entry,/stripHiddenReasoning/);

// Model execution layer belongs to AI Gateway Dynamic Routing.
assert.match(gateway,/provider:"dynamic"/);
assert.match(gateway,/model_selection:"live-catalog-ranked"/);
assert.match(gateway,/dynamic_routing:true/);
assert.match(gateway,/registry_driven_routing:true/);
assert.match(gateway,/gateway_dynamic_route_conditions:\["lane","stage","depth","capability","cost_mode"\]/);
assert.match(gateway,/cf-aig-max-attempts/);
assert.match(gateway,/cf-aig-request-timeout/);
assert.match(gateway,/cf-aig-metadata/);

// Source pools stay exactly as authorized; do not expand implicitly.
assert.match(wrangler,/"MODEL_SOURCE_CLASSES"\s*:\s*"workers-ai,openrouter,deepseek,huggingface"/);
assert.match(gateway,/allowed_model_sources:\["workers-ai","openrouter","deepseek","huggingface"\]/);

// Hard safety/governance ceilings remain outside model control.
assert.match(worker,/HARD_MAX_LANES=8/);
assert.match(worker,/HARD_MAX_EXPERTS=8/);
assert.match(worker,/HARD_MAX_JUDGES=3/);
assert.match(worker,/HARD_MAX_ROUNDS=4/);
assert.match(worker,/tools:false/);
assert.match(worker,/web:false/);
assert.match(entry,/normalized\.tools=false/);
assert.match(entry,/normalized\.web=false/);
assert.match(entry,/temperature:0\.15/);
assert.doesNotMatch(entry,/max_tokens\s*:/);

console.log(JSON.stringify({
  ok:true,
  suite:"dynamic-control-ownership-v3",
  organization_owner:"ai-gateway-routed-panel-architect-unless-explicit-caller-cost-intent",
  model_execution_owner:"cloudflare-ai-gateway-dynamic-route",
  dynamic:["semantic-task-profile","professions","roles","expert-count","judge-count","rounds","topology","cost-mode-when-unspecified","internal-concurrency","task-timeout","stage-timeout","final-synthesis-cost-mode","final-synthesis-timeout","model","provider","retry-fallback-selection"],
  explicit_control_plane:["valid-caller-cost-mode"],
  static_guardrails:["source-pool-allowlist","tools-off","web-off","lane-ceilings","participant-ceilings","round-ceilings","auth-and-resource-safety","sampling-stability"]
}));
