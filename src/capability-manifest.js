export const CAPABILITY_ABI_VERSION="capability-abi-v1";

const capability=(input,observedAt,configured)=>({
  id:input.id,type:input.type||"atomic",domain:input.domain,operations:input.operations,input_schema:input.input_schema||{type:"object"},output_schema:input.output_schema||{type:"object"},
  provider:"expert-worker",protocol:"cloudflare-ai-gateway-dynamic-route-via-service-binding",version:"1.1.0",auth_scope:"service-binding",permission_scope:"compute",network_scope:"cloudflare-ai-gateway-only",write_scope:"none",
  dependencies:input.dependencies||[],substitutes:input.substitutes||[],compatible_with:input.compatible_with||[],conflicts_with:["tools","web","openai-models","anthropic-models","free-models"],
  cost:{class:"paid-provider",currency:"USD",unit_cost:null,estimate_status:"unknown"},latency:{class:"bounded-deliberation",timeout_ms:300000},throughput:{class:"single-active-task",max_concurrency:1},
  reliability:{score:0,basis:"unverified-no-bound-runtime-receipt"},accuracy:{score:0,basis:"unverified-no-bound-runtime-receipt"},freshness:{observed_at:observedAt,ttl_seconds:1800},
  health:{status:configured?"configured-unverified":"unavailable",checked_at:observedAt},fitness:{quality:0,reliability:0,cost:0,latency:0,security:0,adaptability:0,complexity:0},
  trust:{level:"T0",status:configured?"unverified":"quarantined"},verification:{status:configured?"configured-unverified":"unconfigured",scope:"configuration-only",verified_at:null,receipt_digest:null,sample_size:0},
  license:"provider-specific",jurisdiction:["global"],first_seen:"2026-08-18T00:00:00.000Z",last_verified:null
});

export function expertCapabilityManifest({configured=false}={}){
  const observedAt=new Date().toISOString();
  const capabilities=[
    capability({id:"expert.deliberation",type:"composite",domain:"expert",operations:["expert.assess","multi-model.deliberate","uncertainty.calibrate"]},observedAt,configured),
    capability({id:"expert.judgment",type:"composite",domain:"expert",operations:["judgment.synthesize","conflict.resolve","evidence.critique"],dependencies:["expert.deliberation"]},observedAt,configured),
    capability({id:"expert.reasoning",domain:"reasoning",operations:["llm.reasoning","decision.review","assumption.audit"],compatible_with:["intelligence.provider-query","compute.simulation"]},observedAt,configured)
  ];
  return{abi_version:CAPABILITY_ABI_VERSION,center:"expert",generated_at:observedAt,provider_summary:{configured,runtime_verified:0},capabilities,ecology:[
    {from:"expert.judgment",relation:"REQUIRES",to:"expert.deliberation"},
    {from:"expert.reasoning",relation:"COMPLEMENTS",to:"intelligence.provider-query"},
    {from:"expert.reasoning",relation:"COMPLEMENTS",to:"compute.simulation"}
  ]};
}
