const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
export default{
  async fetch(req,env){
    const u=new URL(req.url);
    if(req.method!=="GET"||u.pathname!=="/probe")return json({ok:false,error:"NOT_FOUND"},404);
    if(!env.EXPERT_CENTER?.fetch)return json({ok:false,error:"EXPERT_BINDING_UNAVAILABLE"},503);
    const r=await env.EXPERT_CENTER.fetch(new Request("https://expert.internal/health",{method:"GET",headers:{accept:"application/json"}}));
    const b=await r.json().catch(()=>null);
    return json({ok:r.ok&&b?.ok===true,http_status:r.status,service:b?.service||null,source:"fixed-clinical-benchmark-relay",arbitrary_prompt:false,paid_inference:false},r.ok&&b?.ok===true?200:503);
  }
};
