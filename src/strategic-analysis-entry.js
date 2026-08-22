import app,{CenterGate} from "./admin-entry.js";
import {buildStrategicPrompt,normalizeStrategicMode,strategicTradecraftMeta} from "./strategic-analytic-tradecraft.js";
export {CenterGate};
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="GET"&&url.pathname==="/v1/strategic-analysis/meta")return json({ok:true,...strategicTradecraftMeta()});
    if(req.method==="POST"&&url.pathname==="/v1/strategic-analysis/run"){
      if(url.hostname!=="expert.internal")return json({ok:false,error:"POLICY_DENIED",message:"strategic analysis is service-binding internal only"},403);
      const body=await req.json().catch(()=>null);if(!body||typeof body.prompt!=="string"||!body.prompt.trim())return json({ok:false,error:"INVALID_REQUEST",message:"prompt required"},400);
      const mode=normalizeStrategicMode(body.analysis_mode);let prompt;try{prompt=buildStrategicPrompt(body.prompt,mode)}catch(error){return json({ok:false,error:String(error?.message||error)},400)}
      const forwarded={...body,prompt,analysis_mode:mode,strategic_tradecraft:true,tools:false,web:false};delete forwarded.max_tokens;delete forwarded.max_output_tokens;delete forwarded.token_budget;
      if(body.reasoning_depth==null&&["forecast","scenario","policy-game","decision"].includes(mode))forwarded.reasoning_depth="deep";
      if(body.complexity==null&&["scenario","policy-game","decision"].includes(mode))forwarded.complexity="high";
      const response=await app.fetch(new Request("https://expert.internal/v1/run",{method:"POST",headers:{"content-type":"application/json","x-strategic-tradecraft":"1"},body:JSON.stringify(forwarded)}),env,ctx);
      const payload=await response.json().catch(()=>({ok:false,error:"STRATEGIC_ANALYSIS_BAD_RESPONSE"}));
      return json({...payload,strategic_tradecraft:{version:strategicTradecraftMeta().version,analysis_mode:mode,probability_calibration_requested:true,alternative_hypotheses_required:true,signposts_required:true}},response.status)
    }
    return app.fetch(req,env,ctx);
  },
  async scheduled(controller,env,ctx){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)}
};
