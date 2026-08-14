import { OpenRouter } from "@openrouter/sdk";
const SERVICE="expert-worker",API_VERSION="2026-08-15",MAX_BODY=65536,MAX_MODELS=4;
const POLICY={fail_closed:true,single_active_task:true,network:"openrouter-only",tools:false,web:false,history_weight:0,reasoning_effort:"high",exclude_providers:["openai","anthropic"],exclude_free:true,exclude_flash:true,max_retries:0,max_models:MAX_MODELS,judge_required:true,model_selection:"reasoning+most-popular"};
const CAP={task_profiler:true,dynamic_models:true,company_diversity:true,experts:true,judge:true,openrouter_sdk:true,official_model_catalog:true,tools:false,web:false,duplicate_task_rejected:true,cancel_checked_between_calls:true,external_calls_inside_single_task_lock:true};
const now=()=>new Date().toISOString(),rid=()=>crypto.randomUUID();
const int=(v,d)=>{const n=Number(v);return Number.isFinite(n)?Math.trunc(n):d};
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const err=(c,m,s=400,d)=>json({ok:false,error:c,message:m,...(d?{details:redact(d)}:{})},s);
function redact(v){if(Array.isArray(v))return v.map(redact);if(v&&typeof v==="object"){const o={};for(const[k,x]of Object.entries(v))o[k]=/token|secret|password|authorization|cookie|api.?key/i.test(k)?"[REDACTED]":redact(x);return o}return v}
async function parse(req){const n=Number(req.headers.get("content-length")||0);if(n>MAX_BODY)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});const t=await req.text();if(new TextEncoder().encode(t).length>MAX_BODY)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});if(!t)return{};try{return JSON.parse(t)}catch{throw Object.assign(new Error("INVALID_REQUEST"),{status:400})}}
async function digest(){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({SERVICE,API_VERSION,POLICY,CAP})));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function gate(env){return env.CENTER_GATE.get(env.CENTER_GATE.idFromName("global"))}
async function gs(env,p,m="GET",b){const i={method:m,headers:{"content-type":"application/json"}};if(b!==undefined)i.body=JSON.stringify(b);const r=await gate(env).fetch(new Request(`https://gate.internal${p}`,i));return{http:r.status,...await r.json().catch(()=>({ok:false,error:"GATE_BAD_RESPONSE"}))}}
const acquire=(env,id,ttl)=>gs(env,"/acquire","POST",{task_id:id,kind:"expert",lease_seconds:ttl});
const release=(env,id)=>gs(env,"/release","POST",{task_id:id});
const save=(env,id,p)=>gs(env,`/task/${encodeURIComponent(id)}`,"POST",p);
const load=(env,id)=>gs(env,`/task/${encodeURIComponent(id)}`);
export class CenterGate{
  constructor(state){this.state=state}
  async fetch(req){const u=new URL(req.url),s=this.state.storage,j=async()=>{try{return await req.json()}catch{return{}}};const active=async()=>{const a=await s.get("active");if(a&&a.expires<=Date.now()){await s.delete("active");return null}return a||null};
    if(req.method==="GET"&&u.pathname==="/state")return json({ok:true,active:await active()});
    if(req.method==="POST"&&u.pathname==="/acquire"){const b=await j(),a=await active();if(a)return json({ok:false,error:"BUSY",active:a},409);const id=String(b.task_id||"");if(!id)return json({ok:false,error:"INVALID_REQUEST"},400);const rec={task_id:id,acquired_at:now(),expires:Date.now()+Math.max(30,Math.min(900,int(b.lease_seconds,300)))*1000};await s.put("active",rec);return json({ok:true,active:rec})}
    if(req.method==="POST"&&u.pathname==="/release"){const b=await j(),a=await active();if(!a)return json({ok:true,released:false});if(a.task_id!==b.task_id)return json({ok:false,error:"LOCK_OWNER_MISMATCH",active:a},409);await s.delete("active");return json({ok:true,released:true})}
    if(req.method==="POST"&&u.pathname==="/rate"){const b=await j(),lim=Math.max(1,Math.min(200,int(b.limit,20))),m=Math.floor(Date.now()/60000),k=`rate:${m}`,c=(await s.get(k)||0)+1;await s.put(k,c);await s.delete(`rate:${m-2}`);return c<=lim?json({ok:true,count:c,limit:lim}):json({ok:false,error:"RATE_LIMITED",count:c,limit:lim},429)}
    let m=u.pathname.match(/^\/task\/([^/]+)$/);if(m&&req.method==="GET")return json({ok:true,task:await s.get(`task:${decodeURIComponent(m[1])}`)||null});if(m&&req.method==="POST"){const id=decodeURIComponent(m[1]),old=await s.get(`task:${id}`)||{},rec={...old,...redact(await j()),task_id:id};await s.put(`task:${id}`,rec);return json({ok:true,task:rec})}
    m=u.pathname.match(/^\/task\/([^/]+)\/cancel$/);if(m&&req.method==="POST"){const id=decodeURIComponent(m[1]),k=`task:${id}`,old=await s.get(k);if(!old)return json({ok:false,error:"TASK_NOT_FOUND"},404);const rec={...old,cancel_requested:true,cancel_requested_at:now()};await s.put(k,rec);return json({ok:true,task:rec})}
    return json({ok:false,error:"NOT_FOUND"},404)
  }
}
function allowed(id){const x=String(id||"").toLowerCase();return x&&!x.startsWith("openai/")&&!x.startsWith("anthropic/")&&!x.includes("claude")&&!x.includes("flash")&&!x.includes(":free")}
function nonFree(m){const p=m?.pricing||{};return Number(p.prompt||0)>0||Number(p.completion||0)>0||Number(p.request||0)>0}
function company(id){return String(id).split("/")[0].toLowerCase()}
async function modelCatalog(env){const u=new URL("https://openrouter.ai/api/v1/models");u.searchParams.set("supported_parameters","reasoning");u.searchParams.set("sort","most-popular");u.searchParams.set("output_modalities","text");const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);try{const r=await fetch(u,{headers:{authorization:`Bearer ${env.OPENROUTER_API_KEY}`,accept:"application/json"},signal:c.signal});const x=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error("MODEL_CATALOG_UNAVAILABLE"),{status:502});return(x?.data||[]).filter(m=>allowed(m?.id)&&nonFree(m))}finally{clearTimeout(t)}}
async function selectModels(env,count,requested){const list=await modelCatalog(env),byId=new Map(list.map(m=>[m.id,m])),out=[],seen=new Set();for(const id of Array.isArray(requested)?requested:[]){const m=byId.get(String(id));if(!m)continue;const co=company(m.id);if(seen.has(co))continue;seen.add(co);out.push(m.id);if(out.length>=count)return out}for(const m of list){const co=company(m.id);if(seen.has(co))continue;seen.add(co);out.push(m.id);if(out.length>=count)break}return out}
async function call(env,model,messages,maxTokens){const client=new OpenRouter({apiKey:env.OPENROUTER_API_KEY});return client.chat.send({model,messages,reasoning:{effort:"high"},temperature:0.2,stream:false,...(maxTokens?{maxTokens}:{})})}
async function ensureNotCancelled(env,id){const t=await load(env,id);if(t.task?.cancel_requested)throw Object.assign(new Error("CANCELLED"),{status:409})}
async function run(req,env){
  if(!env.OPENROUTER_API_KEY)return err("UPSTREAM_AUTH_FAILED","OPENROUTER_API_KEY is not configured",503);
  const rate=await gs(env,"/rate","POST",{limit:int(env.RATE_LIMIT_PER_MIN,20)});if(!rate.ok)return err("RATE_LIMITED","Expert budget exceeded",429);
  const b=await parse(req);if(!b.prompt||typeof b.prompt!=="string")return err("INVALID_REQUEST","prompt required",400);
  const id=String(b.task_id||b.request_id||rid()),previous=await load(env,id);if(previous.task)return err("DUPLICATE_TASK","task_id already exists; duplicate expert execution blocked",409,{task_id:id,status:previous.task.status});
  const count=Math.max(2,Math.min(MAX_MODELS,int(b.model_count,4))),lock=await acquire(env,id,Math.min(900,int(b.timeout_seconds,300)));if(!lock.ok)return err("BUSY","Another expert task is active",409,lock.active);
  await save(env,id,{status:"selecting",created_at:now()});
  try{
    await ensureNotCancelled(env,id);
    const models=await selectModels(env,count,b.models);if(models.length<2)throw Object.assign(new Error("NOT_ENOUGH_ELIGIBLE_MODELS"),{status:502});
    const expertModels=models.slice(0,-1),judgeModel=models.at(-1);await save(env,id,{status:"running",models,expert_models:expertModels,judge_model:judgeModel});
    const answers=[];
    for(let i=0;i<expertModels.length;i++){
      await ensureNotCancelled(env,id);
      const role=Array.isArray(b.roles)&&b.roles[i]?String(b.roles[i]).slice(0,120):`Expert ${i+1}`,out=await call(env,expertModels[i],[{role:"system",content:`You are ${role}. Analyze independently. Do not use tools or web. State uncertainty and unsupported assumptions.`},{role:"user",content:b.prompt}],int(b.max_tokens,0)||undefined);
      answers.push({model:expertModels[i],role,content:out?.choices?.[0]?.message?.content||"",usage:redact(out?.usage||null)});
    }
    await ensureNotCancelled(env,id);
    const synthesis=`Question:\n${b.prompt}\n\nIndependent expert answers:\n${answers.map((a,i)=>`[${i+1}] ${a.model} (${a.role})\n${a.content}`).join("\n\n")}`,jout=await call(env,judgeModel,[{role:"system",content:"You are the final judge. Compare the independent analyses, resolve conflicts, reject unsupported claims, and return the best calibrated synthesis. Do not use tools or web."},{role:"user",content:synthesis}],int(b.max_tokens,0)||undefined);
    const rec={status:"completed",models,answers,judge:{model:judgeModel,content:jout?.choices?.[0]?.message?.content||"",usage:redact(jout?.usage||null)},finished_at:now()};await save(env,id,rec);return json({ok:true,task_id:id,...rec});
  }catch(e){
    if(e?.message==="CANCELLED"){await save(env,id,{status:"cancelled",finished_at:now()});return err("CANCELLED","Expert task cancelled",409,{task_id:id})}
    await save(env,id,{status:"failed",error:"UPSTREAM_UNAVAILABLE",message:String(e?.message||e),finished_at:now()});return err("UPSTREAM_UNAVAILABLE","OpenRouter expert execution failed",502,{task_id:id});
  }finally{await release(env,id)}
}
async function handle(req,env){const u=new URL(req.url);if(req.method==="GET"&&u.pathname==="/health")return json({ok:true,status:"ready",service:SERVICE,api_version:API_VERSION,openrouter:{configured:Boolean(env.OPENROUTER_API_KEY),sdk:"@openrouter/sdk"}});if(req.method==="GET"&&(u.pathname==="/v1/policy"||u.pathname==="/policy"))return json({ok:true,service:SERVICE,policy:POLICY});if(req.method==="GET"&&(u.pathname==="/v1/capabilities"||u.pathname==="/capabilities"))return json({ok:true,service:SERVICE,capabilities:CAP});if(req.method==="GET"&&(u.pathname==="/quota"||u.pathname==="/v1/quota"))return json({ok:true,rate_limit_per_min:int(env.RATE_LIMIT_PER_MIN,20),single_active_task:true,max_models:MAX_MODELS,max_retries:0});if(req.method==="GET"&&u.pathname==="/source")return json({ok:true,service:SERVICE,api_version:API_VERSION,source_digest:await digest(),secrets_redacted:true});if(req.method==="GET"&&u.pathname==="/v1/acceptance/latest")return json({ok:true,service:SERVICE,status:"not_verified",run_id:null,receipt_digest:null});if(req.method==="GET"&&u.pathname==="/openapi.json")return json({openapi:"3.1.0",info:{title:"Expert Center",version:API_VERSION},paths:{"/health":{get:{}},"/v1/policy":{get:{}},"/v1/capabilities":{get:{}},"/v1/run":{post:{}},"/v1/status":{post:{}},"/v1/cancel":{post:{}}}});if(req.method==="POST"&&u.pathname==="/v1/status"){const b=await parse(req);if(!b.task_id)return err("INVALID_REQUEST","task_id required",400);const x=await load(env,b.task_id);return x.task?json({ok:true,task:x.task}):err("INVALID_REQUEST","Task not found",404)}if(req.method==="POST"&&u.pathname==="/v1/cancel"){const b=await parse(req);if(!b.task_id)return err("INVALID_REQUEST","task_id required",400);const x=await gs(env,`/task/${encodeURIComponent(b.task_id)}/cancel`,"POST",{});return json({ok:x.ok,task:x.task||null,cancellation_pending:true,lock_retained:true},202)}if(req.method==="POST"&&u.pathname==="/v1/run")return run(req,env);return err("INVALID_REQUEST","Route not found",404)}
export default{async fetch(req,env){try{return await handle(req,env)}catch(e){return err(e?.message||"INTERNAL_ERROR","Request failed",e?.status||500,e?.details)}}};
