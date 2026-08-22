import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const config=fs.readFileSync(path.join(root,"wrangler.jsonc"),"utf8");
assert.match(config,/"MODEL_SOURCE_CLASSES":\s*"workers-ai,openrouter,huggingface"/);
assert.match(config,/"MODEL_SOURCE_POLICY":\s*"three-source-cloudflare-free-first"/);
assert.match(config,/"WORKERS_AI_FREE_ONLY":\s*"true"/);
assert.doesNotMatch(config,/workers-ai,openrouter,deepseek,huggingface/);

const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())walk(full);else if(/\.(?:js|mjs|json|jsonc)$/.test(item.name))files.push(full)}}
walk(path.join(root,"src"));
files.push(path.join(root,"wrangler.jsonc"));
const text=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const forbidden=[
  /https:\/\/api\.deepseek\.com/i,
  /DEEPSEEK_API_KEY/,
  /https:\/\/dashscope\./i,
  /DASHSCOPE_API_KEY/,
  /https:\/\/qianfan\./i,
  /HUNYUAN_API_KEY/,
  /SILICONFLOW_API_KEY/,
  /ZHIPU_API_KEY/
];
for(const pattern of forbidden)assert.doesNotMatch(text,pattern,`direct model vendor source forbidden: ${pattern}`);
console.log(JSON.stringify({ok:true,suite:"model-source-policy-contract",approved_sources:["workers-ai","openrouter","huggingface"],workers_ai_free_only:true,direct_vendor_sources:false}));
