import assert from "node:assert/strict";
import fs from "node:fs";
import {aiGatewayConfigured,aiGatewayDescriptor,aiGatewayRequestHeaders,aiGatewayRouteFamily,aiGatewayRouteForMetadata,dynamicChatEndpoint,dynamicRouteModel,routeMetadata,routeRegistry,routeShardForMetadata} from "../src/ai-gateway.js";
const env={AI_GATEWAY_ID:"test",AI_GATEWAY_ROUTE_FAMILY:"expert-panel",CLOUDFLARE_ACCOUNT_ID:"account",AI_GATEWAY_TOKEN:"test-gateway-token",MODEL_SOURCE_POLICY:"workers-ai-openrouter-deepseek-huggingface-only",WORKERS_AI_FREE_ONLY:"true"};
assert.equal(aiGatewayConfigured(env),true);
assert.equal(aiGatewayRouteFamily(env),"expert-panel");
assert.throws(()=>dynamicRouteModel(env),e=>e?.message==="AI_GATEWAY_ROUTE_METADATA_REQUIRED");
assert.equal(await dynamicChatEndpoint(env),"https://gateway.ai.cloudflare.com/v1/account/test/compat/chat/completions");

const meta={stage:"expert",lane:"3",capability:"quantitative",depth:"deep",cost_mode:"free-first"};
const headers=aiGatewayRequestHeaders(env,45000,meta);
assert.equal(headers["cf-aig-authorization"],"Bearer test-gateway-token");
assert.equal(headers["cf-aig-max-attempts"],"1");
assert.equal(headers["cf-aig-request-timeout"],"45000");
assert.deepEqual(JSON.parse(headers["cf-aig-metadata"]),meta);
assert.deepEqual(routeMetadata(env,meta),meta);
assert.deepEqual(routeMetadata(env,{stage:"expert"}),{stage:"expert"});
assert.throws(()=>routeMetadata(env,{}),e=>e?.message==="AI_GATEWAY_METADATA_LIMIT_MISMATCH");
assert.throws(()=>routeMetadata(env,{a:1,b:2,c:3,d:4,e:5,f:6}),e=>e?.message==="AI_GATEWAY_METADATA_LIMIT_MISMATCH");

const registry=routeRegistry(env);
assert.equal(registry.schema,"expert-route-registry-v4.1");
assert.equal(routeShardForMetadata({stage:"planner",capability:"coding"},registry),"plan");
assert.equal(routeShardForMetadata({stage:"judge",capability:"legal"},registry),"plan");
assert.equal(routeShardForMetadata({stage:"expert",capability:"coding"},registry),"code");
assert.equal(routeShardForMetadata({stage:"expert",capability:"quantitative"},registry),"code");
assert.equal(routeShardForMetadata({stage:"expert",capability:"medical"},registry),"regulated");
assert.equal(routeShardForMetadata({stage:"expert",capability:"evidence"},registry),"research");
assert.equal(routeShardForMetadata({stage:"expert",capability:"adversarial"},registry),"strategy");
assert.equal(routeShardForMetadata({stage:"expert",capability:"creative"},registry),"creative");
assert.equal(routeShardForMetadata({stage:"expert",capability:"domain-expert"},registry),"general");
assert.equal(aiGatewayRouteForMetadata(env,meta),"expert-panel-code-v1");
assert.equal(dynamicRouteModel(env,meta),"dynamic/expert-panel-code-v1");

const custom={schema:"custom-v1",default:"general",routes:{general:"expert-custom-general-v7",math:"expert-custom-math-v2"},rules:[{field:"capability",values:["quantitative"],route:"math"}]};
const customEnv={...env,AI_GATEWAY_ROUTE_REGISTRY:JSON.stringify(custom)};
assert.equal(aiGatewayRouteForMetadata(customEnv,meta),"expert-custom-math-v2");

const descriptor=aiGatewayDescriptor(env);
assert.equal(descriptor.custom_metadata_limit,5);
assert.equal(descriptor.dynamic_routing,true);
assert.equal(descriptor.registry_driven_routing,true);
assert.equal(descriptor.legacy_base_route_removed,true);
assert.equal(descriptor.legacy_route,false);
assert.equal(descriptor.route,null);
assert.equal(descriptor.route_family,"expert-panel");
assert.equal(descriptor.model_source_policy,"workers-ai-openrouter-deepseek-huggingface-only");
assert.deepEqual(descriptor.allowed_model_sources,["workers-ai","openrouter","deepseek","huggingface"]);
assert.deepEqual(descriptor.provider_key_sources,["openrouter","deepseek","huggingface"]);
assert.deepEqual(descriptor.keyless_model_sources,["workers-ai"]);
assert.equal(descriptor.workers_ai_free_only,true);
assert.equal(descriptor.upstream_keys,"cloudflare-byok-openrouter-deepseek-huggingface-plus-workers-ai");
assert.deepEqual(descriptor.route_shards,["plan","general","code","regulated","research","strategy","creative"]);

// Provider credentials are centralized in Cloudflare AI Gateway BYOK. The Expert
// Worker holds only the Gateway auth token; Workers AI does not require a third-party key.
const wrangler=fs.readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const docs=fs.readFileSync(new URL("../docs/expert-v4.1.md",import.meta.url),"utf8");
assert.match(wrangler,/"secrets"\s*:\s*\{\s*"required"\s*:\s*\["AI_GATEWAY_TOKEN"\]\s*\}/s);
assert.match(wrangler,/"MODEL_SOURCE_POLICY"\s*:\s*"workers-ai-openrouter-deepseek-huggingface-only"/);
assert.match(wrangler,/"WORKERS_AI_FREE_ONLY"\s*:\s*"true"/);
assert.doesNotMatch(wrangler,/OPENROUTER_API_KEY|DEEPSEEK_API_KEY|HUGGINGFACE_API_KEY|TENCENT_TOKENHUB_API_KEY/);
assert.match(docs,/Cloudflare Workers AI free models/);
assert.match(docs,/OpenRouter/);
assert.match(docs,/DeepSeek native/);
assert.match(docs,/Hugging Face/);
assert.match(docs,/Company diversity is based on the \*\*model owner\*\*/);
assert.match(docs,/fail\/fallback rather than deliberately purchase Workers AI inference/);
assert.match(docs,/No Tencent TokenHub/);

await assert.rejects(()=>dynamicChatEndpoint({AI_GATEWAY_ID:"test",AI_GATEWAY_ROUTE_FAMILY:"expert-panel",CLOUDFLARE_ACCOUNT_ID:"account"}),e=>e?.message==="AI_GATEWAY_NOT_CONFIGURED"&&e?.status===503);
assert.throws(()=>aiGatewayRequestHeaders({},1000,meta),e=>e?.message==="AI_GATEWAY_NOT_CONFIGURED");
console.log(JSON.stringify({ok:true,suite:"ai-gateway-contract-v4.1",authenticated_gateway:true,dynamic_routing:true,registry_driven:true,provider_keys_centralized_in_cloudflare:true,provider_policy:"workers-ai-openrouter-deepseek-huggingface-only",allowed_model_sources:["workers-ai","openrouter","deepseek","huggingface"],workers_ai_free_only:true,legacy_base_route_removed:true,custom_metadata_max:5}));
