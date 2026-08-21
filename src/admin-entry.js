import app,{CenterGate} from "./guard.js";
import {LANGGRAPH_RUNTIME,probeLangGraphRuntime,runLangGraphRequest} from "./langgraph-runtime.js";
import {dynamicChatEndpoint,dynamicRouteModel,aiGatewayRequestHeaders} from "./ai-gateway.js";
export {CenterGate};

const ORIGIN="https://expert.internal";
const SERVICE="expert-worker";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const int=(v,d)=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):d};
const clamp=(v,lo,hi,d)=>Math.max(lo,Math.min(hi,int(v,d)));

async function readApp(path,env,ctx){
  const response=await app.fetch(new Request(`${ORIGIN}${path}`,{method:"GET"}),env,ctx);
  const body=await response.json().catch(()=>({ok:false,error:"ADMIN_BAD_JSON"}));
  return {http_status:response.status,body};
}

async function readGate(env){
  if(!env.CENTER_GATE?.get||!env.CENTER_GATE?.idFromName)return {ok:false,error:"CENTER_GATE_UNAVAILABLE",active:null};
  const gate=env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"));
  const response=await gate.fetch(new Request("https://gate.internal/state",{method:"GET"}));
  const body=await response.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}));
  return {http_status:response.status,...body};
}

async function adminContext(env,ctx){
  const health=await readApp("/health",env,ctx);
  const source=await readApp("/source",env,ctx);
  const acceptance=await readApp("/v1/acceptance/latest",env,ctx);
  const gate=await readGate(env);
  const version=env.CF_VERSION_METADATA||{};
  const ok=health.http_status===200&&health.body?.ok===true&&source.http_status===200&&source.body?.ok===true&&gate.ok===true;
  return json({
    ok,
    service:SERVICE,
    admin_read_only:true,
    observed_at:new Date().toISOString(),
    runtime_version:{id:version.id||null,tag:version.tag||null,timestamp:version.timestamp||null},
    langgraph:{runtime:LANGGRAPH_RUNTIME,mode:"internal-canary",endpoint:"/v1/langgraph/run",health_endpoint:"/v1/langgraph/health",service_binding_only:true},
    health:health.body,
    source:source.body,
    acceptance:acceptance.body,
    active_task:gate.active||null,
    active_state_verified:gate.ok===true,
    secrets_redacted:true
  },ok?200:503);
}

function internalOnly(url){return url.hostname==="expert.internal"}
function cleanHeader(v){return String(v||"").trim().replace(/[^0-9A-Za-z@._:/-]/g,"_").slice(0,180)}
function requestScopedPanelEnv(input,env){
  const raw=Number(input?.model_count);
  if(!Number.isFinite(raw))return env;
  const total=clamp(raw,1,8,8);
  const configuredLanes=clamp(env.EXPERT_MAX_LANES,2,8,8);
  const configuredExperts=clamp(env.EXPERT_MAX_EXPERTS,1,8,8);
  const configuredJudges=clamp(env.EXPERT_MAX_JUDGES,0,3,2);
  const judges=Math.min(configuredJudges,Math.max(0,total-1));
  const experts=Math.max(1,Math.min(configuredExperts,total-judges));
  return {...env,EXPERT_MAX_LANES:String(Math.min(configuredLanes,Math.max(2,total))),EXPERT_MAX_EXPERTS:String(experts),EXPERT_MAX_JUDGES:String(judges)};
}

async function routeProbe(req,env){
  const input=await req.json().catch(()=>null);
  const lane=Math.trunc(Number(input?.lane));
  if(!Number.isInteger(lane)||lane<1||lane>8)return json({ok:false,error:"INVALID_LANE",secrets_redacted:true},400);
  const metadata={stage:"route-probe",lane:String(lane),capability:"general",depth:"standard",cost_mode:"balanced"};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
    const endpoint=await dynamicChatEndpoint(env);
    const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",accept:"application/json",...aiGatewayRequestHeaders(env,30000,metadata)},body:JSON.stringify({model:dynamicRouteModel(env,metadata),messages:[{role:"user",content:"Return exactly OK."}],temperature:0,stream:false,max_tokens:8}),signal:controller.signal});
    const provider=cleanHeader(response.headers.get("cf-aig-provider"));
    const model=cleanHeader(response.headers.get("cf-aig-model"));
    const ok=response.status===200&&Boolean(provider)&&Boolean(model);
    return json({ok,probe:"expert-dynamic-route-v1",lane,gateway_http_status:response.status,provider:model?provider:null,model:model||null,content_scrubbed:true,request_fixed:true,tools_used:false,web_used:false,secrets_redacted:true,error_code:ok?null:`GATEWAY_HTTP_${response.status}`},ok?200:502);
  }catch(error){return json({ok:false,probe:"expert-dynamic-route-v1",lane,error_code:error?.name==="AbortError"?"GATEWAY_TIMEOUT":"GATEWAY_REQUEST_FAILED",content_scrubbed:true,request_fixed:true,tools_used:false,web_used:false,secrets_redacted:true},502)}finally{clearTimeout(timer)}
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/v1/admin/context"){
      if(!internalOnly(url))return json({ok:false,error:"POLICY_DENIED",message:"admin context is service-binding internal only"},403);
      return adminContext(env,ctx);
    }
    if(req.method==="POST"&&url.pathname==="/v1/admin/route-probe"){
      if(!internalOnly(url))return json({ok:false,error:"POLICY_DENIED",message:"route probe is service-binding internal only"},403);
      return routeProbe(req,env);
    }
    if(req.method==="GET"&&url.pathname==="/v1/langgraph/health"){
      if(!internalOnly(url))return json({ok:false,error:"POLICY_DENIED",message:"LangGraph runtime is service-binding internal only"},403);
      const probe=await probeLangGraphRuntime().catch(error=>({ok:false,runtime:LANGGRAPH_RUNTIME,error:String(error?.message||error)}));
      return json(probe,probe.ok?200:503);
    }
    if(req.method==="POST"&&url.pathname==="/v1/langgraph/run"){
      if(!internalOnly(url))return json({ok:false,error:"POLICY_DENIED",message:"LangGraph runtime is service-binding internal only"},403);
      const input=await req.json().catch(()=>null);
      if(!input)return json({ok:false,error:"INVALID_JSON"},400);
      const result=await runLangGraphRequest(input,env,ctx).catch(error=>({ok:false,runtime:LANGGRAPH_RUNTIME,status:"failed",error:String(error?.message||error)}));
      return json(result,result.ok?200:result.status==="rejected"?400:502);
    }
    if(req.method==="POST"&&url.pathname==="/v1/run"){
      const input=await req.clone().json().catch(()=>null);
      return app.fetch(req,input?requestScopedPanelEnv(input,env):env,ctx);
    }
    return app.fetch(req,env,ctx);
  }
};
