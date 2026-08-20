import assert from "node:assert/strict";
import {aiGatewayConfigured,aiGatewayDescriptor,aiGatewayRequestHeaders,aiGatewayRouteFamily,aiGatewayRouteForMetadata,dynamicChatEndpoint,dynamicRouteModel,routeMetadata,routeRegistry,routeShardForMetadata} from "../src/ai-gateway.js";
const env={AI_GATEWAY_ID:"test",AI_GATEWAY_ROUTE_FAMILY:"expert-panel",CLOUDFLARE_ACCOUNT_ID:"account",AI_GATEWAY_TOKEN:"test-gateway-token"};
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
assert.deepEqual(descriptor.route_shards,["plan","general","code","regulated","research","strategy","creative"]);

await assert.rejects(()=>dynamicChatEndpoint({AI_GATEWAY_ID:"test",AI_GATEWAY_ROUTE_FAMILY:"expert-panel",CLOUDFLARE_ACCOUNT_ID:"account"}),e=>e?.message==="AI_GATEWAY_NOT_CONFIGURED"&&e?.status===503);
assert.throws(()=>aiGatewayRequestHeaders({},1000,meta),e=>e?.message==="AI_GATEWAY_NOT_CONFIGURED");
console.log(JSON.stringify({ok:true,suite:"ai-gateway-contract-v4.1",authenticated_gateway:true,dynamic_routing:true,registry_driven:true,legacy_base_route_removed:true,custom_metadata_max:5}));
