import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/apply-expert-panel-route.mjs", import.meta.url), "utf8");

assert.match(source, /intelligence-high-to-low/);
assert.match(source, /supported_parameters=reasoning/);
assert.match(source, /output_modalities=text/);
assert.match(source, /exclude_openai|bannedCompany/);
assert.match(source, /anthropic/);
assert.match(source, /claude/);
assert.match(source, /:free/);
assert.match(source, /flash/);
assert.match(source, /companyOrder\.slice\(0, 4\)/);
assert.match(source, /metadata\.expert_slot/);
assert.match(source, /metadata\.reasoning_depth/);
assert.match(source, /metadata\.task_domain/);
assert.match(source, /provider:\s*"openrouter"/);
assert.match(source, /retries:\s*0/);
assert.match(source, /CLOUDFLARE_AI_GATEWAY_API_TOKEN/);
assert.match(source, /\/ai-gateway\/gateways\//);
assert.match(source, /\/versions/);
assert.match(source, /\/deployments/);
assert.match(source, /--dry-run/);
assert.match(source, /--no-deploy/);
assert.doesNotMatch(source, /console\.(log|error)\([^\n]*API_TOKEN/);
assert.doesNotMatch(source, /CLOUDFLARE_BUILDS_API_TOKEN/);

console.log(JSON.stringify({ok:true,suite:"dynamic-route-writer-contract",one_command_writer:true,secrets_redacted:true}));
