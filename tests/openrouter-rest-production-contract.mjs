import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const source=fs.readFileSync(path.join(root,"src/index.js"),"utf8");
const gateway=fs.readFileSync(path.join(root,"src/ai-gateway.js"),"utf8");
const relay=fs.readFileSync(path.join(root,"src/governance-relay.js"),"utf8");

assert.match(source,/network:\"openrouter-only\"/);
assert.match(source,/openrouter_rest:true/);
assert.match(source,/tools:false/);
assert.match(source,/web:false/);
assert.match(source,/https:\/\/openrouter\.ai\/api\/v1\/models/);
assert.doesNotMatch(source,/https:\/\/openrouter\.ai\/api\/v1\/chat\/completions/);
assert.doesNotMatch(relay,/https:\/\/openrouter\.ai\/api\/v1\/chat\/completions/);
assert.match(gateway,/gateway\.ai\.cloudflare\.com/);
assert.match(gateway,/gateway\.ai\.cloudflare\.com\/v1/);
assert.match(gateway,/cf-aig-authorization/);
assert.doesNotMatch(gateway,/cf-aig-skip-cache/);
assert.doesNotMatch(gateway,/cf-aig-collect-log/);
assert.match(gateway,/cf-aig-max-attempts/);
assert.doesNotMatch(source,/mcp\.openrouter\.ai\/mcp/);
assert.doesNotMatch(source,/openrouter_mcp/i);

console.log(JSON.stringify({ok:true,suite:"openrouter-rest-production-contract",transport:"cloudflare-ai-gateway-openrouter",mcp_runtime:false,tools:false,web:false,cache:"gateway-default",request_logging:"gateway-default",gateway_retries:0,dynamic_routing:false}));
