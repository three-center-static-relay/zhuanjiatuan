import core,{CenterGate as CoreCenterGate} from "./guard.js";
export class CenterGate extends CoreCenterGate {}
const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const allowed=id=>{const x=String(id||"").toLowerCase();return x&&!x.startsWith("openai/")&&!x.startsWith("anthropic/")&&!x.includes("claude")&&!x.includes("flash")&&!x.includes(":free")};
async function digest(v){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(v)));return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function extreme4(env,ctx){
  const started=Date.now(),taskId=`extreme4-${crypto.randomUUID()}`;
  const prompt="Production extreme canary. Without external facts, compare three deterministic options: A cost 40 latency 20 reliability 0.90; B cost 55 latency 12 reliability 0.96; C cost 30 latency 35 reliability 0.85. Budget 100. Choose a primary and backup. Evaluate cost, reliability, latency, failure modes, uncertainty and tradeoffs, then synthesize a final recommendation.";
  const req=new Request("https://expert.internal/v1/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({task_id:taskId,prompt,model_count:4,max_tokens:1024,timeout_seconds:300,roles:["Quantitative decision analyst","Adversarial failure reviewer","Operations research analyst"]})});
  const r=await core.fetch(req,env,ctx),body=await r.clone().json().catch(()=>null),models=Array.isArray(body?.models)?body.models:[],answers=Array.isArray(body?.answers)?body.answers:[],judge=body?.judge||null;
  const companyDiverse=models.length===4&&new Set(models.map(x=>String(x).split("/")[0].toLowerCase())).size===4;
  const modelPolicy=models.length===4&&models.every(allowed)&&companyDiverse;
  const expertsNonempty=answers.filter(a=>String(a?.content||"").trim()).length;
  const judgeNonempty=Boolean(String(judge?.content||"").trim());
  const ok=r.ok&&body?.ok===true&&body?.status==="completed"&&modelPolicy&&expertsNonempty===3&&judgeNonempty;
  const outputDigest=await digest({models,answers:answers.map(a=>a?.content||""),judge:judge?.content||""});
  return json({ok,business_e2e:true,configured:true,http_status:r.status,task_id:taskId,models,company_diverse:companyDiverse,model_policy_pass:modelPolicy,experts_nonempty:expertsNonempty,judge_nonempty:judgeNonempty,output_digest:outputDigest,content_scrubbed:true,max_tokens:1024,elapsed_ms:Date.now()-started},ok?200:503);
}
export default{async fetch(req,env,ctx){const u=new URL(req.url);if(req.method==="POST"&&u.pathname==="/v1/.canary/extreme4-20260815")return extreme4(env,ctx);return core.fetch(req,env,ctx)}};
