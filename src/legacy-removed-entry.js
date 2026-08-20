const SERVICE="expert-worker";
const API_VERSION="2026-08-20.legacy-retired";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const retired={ok:false,status:"retired",service:SERVICE,api_version:API_VERSION,legacy_expert_panel_removed:true,replacement:"expert-v4.1-pending",fail_closed:true};
export default{
  async fetch(request){
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/health")return json({ok:true,status:"retired",service:SERVICE,api_version:API_VERSION,legacy_expert_panel_removed:true,accepting_tasks:false,replacement:"expert-v4.1-pending"});
    if(request.method==="GET"&&url.pathname==="/source")return json({ok:true,service:SERVICE,api_version:API_VERSION,source:"legacy-panel-retired",legacy_expert_panel_removed:true});
    if(request.method==="GET"&&url.pathname==="/v1/admin/context")return json({ok:false,status:"retired",service:SERVICE,admin_read_only:true,active_task:null,active_state_verified:true,legacy_expert_panel_removed:true,replacement:"expert-v4.1-pending",secrets_redacted:true},503);
    if(["/v1/run","/v1/selftest","/v1/governance-assist","/v1/cancel"].includes(url.pathname))return json({...retired,error:"LEGACY_EXPERT_PANEL_REMOVED",message:"Legacy expert execution has been removed. Requests remain fail-closed until Expert V4.1 is promoted."},410);
    if(request.method==="GET"&&url.pathname==="/v1/policy")return json({ok:true,service:SERVICE,api_version:API_VERSION,policy:{legacy_expert_panel_removed:true,accepting_tasks:false,fail_closed:true,replacement:"expert-v4.1-pending"}});
    if(request.method==="GET"&&url.pathname==="/v1/capabilities")return json({ok:true,service:SERVICE,api_version:API_VERSION,capabilities:{legacy_expert_panel:false,expert_v4_1:false,accepting_tasks:false}});
    return json({...retired,error:"NOT_FOUND"},404);
  }
};
