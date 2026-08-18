import assert from "node:assert/strict";
import {aiGatewayConfigured,aiGatewayDescriptor,aiGatewayRequestHeaders,aiGatewayRoute,aiGatewayRouteFamily,aiGatewayRouteForMetadata,dynamicChatEndpoint,dynamicRouteModel,routeMetadata,routeShardForMetadata} from "../src/ai-gateway.js";
const env={AI_GATEWAY_ID:"test",AI_GATEWAY_ROUTE:"expert-panel-v1",CLOUDFLARE_ACCOUNT_ID:"account",AI_GATEWAY_TOKEN:"test-gateway-token"};
assert.equal(aiGatewayConfigured(env),true);
assert.equal(aiGatewayRoute(env),"expert-panel-v1");
assert.equal(aiGatewayRouteFamily(env),"expert-panel");
assert.equal(dynamicRouteModel(env),"dynamic/expert-panel-v1");
assert.equal(await dynamicChatEndpoint(env),"https://gateway.ai.cloudflare.com/v1/account/test/compat/chat/completions");

const meta={stage:"expert",lane:"3",capability:"quantitative",depth:"deep",cost_mode:"free-first"};
const headers=aiGatewayRequestHeaders(env,45000,meta);
assert.equal(headers["cf-aig-authorization"],"Bearer test-gateway-token");
assert.equal(headers["cf-aig-max-attempts"],"1");
assert.equal(headers["cf-aig-request-timeout"],"45000");
assert.deepEqual(JSON.parse(headers["cf-aig-metadata"]),meta);
assert.equal(Object.keys(JSON.parse(headers["cf-aig-metadata"])).length,5);
assert.deepEqual(routeMetadata(env,meta),meta);
assert.throws(()=>routeMetadata(env,{stage:"expert"}),e=>e?.message==="AI_GATEWAY_METADATA_LIMIT_MISMATCH");
assert.throws(()=>routeMetadata(env,{a:1,b:2,c:3,d:4,e:5,f:6}),e=>e?.message==="AI_GATEWAY_METADATA_LIMIT_MISMATCH");

assert.equal(routeShardForMetadata({stage:"planner",capability:"coding"}),"plan");
assert.equal(routeShardForMetadata({stage:"judge",capability:"legal"}),"plan");
assert.equal(routeShardForMetadata({stage:"expert",capability:"coding"}),"code");
assert.equal(routeShardForMetadata({stage:"expert",capability:"quantitative"}),"code");
assert.equal(routeShardForMetadata({stage:"expert",capability:"medical"}),"regulated");
assert.equal(routeShardForMetadata({stage:"expert",capability:"evidence"}),"research");
assert.equal(routeShardForMetadata({stage:"expert",capability:"adversarial"}),"strategy");
assert.equal(routeShardForMetadata({stage:"expert",capability:"creative"}),"creative");
assert.equal(routeShardForMetadata({stage:"expert",capability:"domain-expert"}),"general");
assert.equal(aiGatewayRouteForMetadata(env,meta),"expert-panel-code-v1");
assert.equal(dynamicRouteModel(env,meta),"dynamic/expert-panel-code-v1");

const descriptor=aiGatewayDescriptor(env);
assert.equal(descriptor.custom_metadata_limit,5);
assert.deepEqual(descriptor.routed_metadata,["stage","lane","capability","depth","cost_mode"]);
assert.equal(descriptor.dynamic_routing,true);
assert.equal(descriptor.sharded_dynamic_routing,true);
assert.equal(descriptor.route_family,"expert-panel");
assert.deepEqual(descriptor.route_shards,["plan","general","code","regulated","research","strategy","creative"]);

await assert.rejects(()=>dynamicChatEndpoint({AI_GATEWAY_ID:"test",AI_GATEWAY_ROUTE:"expert-panel-v1",CLOUDFLARE_ACCOUNT_ID:"account"}),e=>e?.message==="AI_GATEWAY_NOT_CONFIGURED"&&e?.status===503);
assert.throws(()=>aiGatewayRequestHeaders({},1000,meta),e=>e?.message==="AI_GATEWAY_NOT_CONFIGURED");
console.log(JSON.stringify({ok:true,suite:"ai-gateway-contract",authenticated_gateway:true,dynamic_routing:true,sharded_dynamic_routing:true,custom_metadata_limit:5,metadata:Object.keys(meta)}));
