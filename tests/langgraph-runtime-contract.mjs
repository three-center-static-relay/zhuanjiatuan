// Exact-main Cloudflare production receipt trigger for shared supervisor validation runtime.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const TestState = Annotation.Root({value:Annotation(),trace:Annotation({reducer:(left,right)=>[...(Array.isArray(left)?left:[]),...(Array.isArray(right)?right:[])],default:()=>[]})});
const graph=new StateGraph(TestState).addNode("increment",async state=>({value:Number(state.value||0)+1,trace:["increment"]})).addEdge(START,"increment").addEdge("increment",END).compile();
const result=await graph.invoke({value:1,trace:[]});
assert.equal(result.value,2);assert.deepEqual(result.trace,["increment"]);

const runtimeSource=await readFile(new URL("../src/langgraph-runtime.js",import.meta.url),"utf8");
const brainSource=await readFile(new URL("../src/langgraph-brain.js",import.meta.url),"utf8");
const adminSource=await readFile(new URL("../src/admin-entry.js",import.meta.url),"utf8");
const wrangler=await readFile(new URL("../wrangler.jsonc",import.meta.url),"utf8");
const pkg=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));

assert.equal(pkg.dependencies?.["@langchain/langgraph"],"1.4.10");
assert.equal(pkg.dependencies?.["@langchain/core"],"1.2.6");
assert.match(runtimeSource,/from "@langchain\/langgraph"/);
assert.match(runtimeSource,/new StateGraph\(/);
assert.match(runtimeSource,/https:\/\/expert\.internal\/v1\/run/);
assert.match(runtimeSource,/buildSupervisorValidationGraph/);
assert.match(runtimeSource,/supervisor-validate/);
assert.match(runtimeSource,/brain-advisory/);
assert.match(runtimeSource,/runLangGraphBrain/);
assert.match(runtimeSource,/brain_mode/);
assert.match(runtimeSource,/model_invoked\s*:\s*false/);
assert.match(brainSource,/@cf\/zai-org\/glm-4\.7-flash/);
assert.match(brainSource,/@cf\/nvidia\/nemotron-3-120b-a12b/);
assert.match(brainSource,/intelligence-high-to-low/);
assert.match(brainSource,/PAID_FALLBACK_DISALLOWED_BY_BUDGET/);
assert.match(brainSource,/cf-aig-collect-log-payload/);
assert.match(adminSource,/\/v1\/langgraph\/run/);
assert.match(adminSource,/service-binding internal only/);
assert.match(wrangler,/"ai"\s*:\s*\{\s*"binding"\s*:\s*"AI"/);

console.log("langgraph-runtime-contract: PASS");
