import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const source=fs.readFileSync(path.join(root,"src/index.js"),"utf8");

assert.match(source,/network:\"openrouter-only\"/);
assert.match(source,/openrouter_rest:true/);
assert.match(source,/tools:false/);
assert.match(source,/web:false/);
assert.match(source,/https:\/\/openrouter\.ai\/api\/v1\/models/);
assert.match(source,/https:\/\/openrouter\.ai\/api\/v1\/chat\/completions/);
assert.doesNotMatch(source,/mcp\.openrouter\.ai\/mcp/);
assert.doesNotMatch(source,/openrouter_mcp/i);

console.log(JSON.stringify({ok:true,suite:"openrouter-rest-production-contract",transport:"openrouter-rest",mcp_runtime:false,tools:false,web:false}));
