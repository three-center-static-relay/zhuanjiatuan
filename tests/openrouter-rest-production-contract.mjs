import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const source=fs.readFileSync(path.join(root,"src/index.js"),"utf8");
const gateway=fs.readFileSync(path.join(root,"src/ai-gateway.js"),"utf8");
const relay=fs.readFileSync(path.join(root,"src/governance-relay.js"),"utf8");
const wrangler=fs.readFileSync(path.join(root,"wrangler.jsonc"),"utf8");

assert.match(source,/network:"cloudflare-ai-gateway-only"/);
assert.match(source,/dynamic_route:true/);
assert.match(source,/tools:false/);
assert.match(source,/web:false/);
assert.doesNotMatch(source,/https:\/\/openrouter\.ai\/api\/v1\/models/);
assert.doesNotMatch(source,/OPENROUTER_API_KEY/);
assert.doesNotMatch(relay,/OPENROUTER_API_KEY/);
assert.match(gateway,/\/compat\/chat\/completions/);
assert.match(gateway,/dynamic\//);
assert.match(gateway,/cf-aig-authorization/);
assert.match(source,/expert_slot/);
assert.match(source,/cf-aig-model/);
assert.match(source,/cf-aig-provider/);
assert.match(wrangler,/"AI_GATEWAY_ROUTE"\s*:\s*"expert-panel-v1"/);
assert.doesNotMatch(gateway,/cf-aig-skip-cache/);
assert.doesNotMatch(gateway,/cf-aig-collect-log/);
assert.doesNotMatch(source,/mcp\.openrouter\.ai\/mcp/);

console.log(JSON.stringify({ok:true,suite:"openrouter-rest-production-contract",transport:"cloudflare-ai-gateway-dynamic-route",byok:true,mcp_runtime:false,tools:false,web:false,cache:"gateway-default",request_logging:"gateway-default",worker_retries:0,dynamic_routing:true}));
