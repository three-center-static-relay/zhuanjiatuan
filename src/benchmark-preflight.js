const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const text=v=>String(v??"");
const company=id=>text(id).split('/')[0].toLowerCase();
const allowed=id=>{const x=text(id).toLowerCase();return x&&!x.startsWith('openai/')&&!x.startsWith('anthropic/')&&!x.includes('claude')&&!x.includes('flash')&&!x.includes(':free')};
const nonFree=m=>{const p=m?.pricing||{};return Number(p.prompt||0)>0||Number(p.completion||0)>0||Number(p.request||0)>0};
async function fetchJson(url,init={},ms=15000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{...init,signal:c.signal}),raw=await r.text();let b=null;try{b=raw?JSON.parse(raw):null}catch{}if(!r.ok)return{ok:false,http:r.status,body:b};return{ok:true,http:r.status,body:b}}catch(e){return{ok:false,http:0,error:String(e?.name==='AbortError'?'TIMEOUT':e?.message||e)}}finally{clearTimeout(t)}}
export async function benchmarkPreflight(env){
  const du=new URL('https://datasets-server.huggingface.co/rows');du.searchParams.set('dataset','openlifescienceai/medmcqa');du.searchParams.set('config','default');du.searchParams.set('split','validation');du.searchParams.set('offset','0');du.searchParams.set('length','1');
  const data=await fetchJson(du);
  const row=data?.body?.rows?.[0]?.row||null;
  const mu=new URL('https://openrouter.ai/api/v1/models');mu.searchParams.set('supported_parameters','reasoning');mu.searchParams.set('sort','most-popular');mu.searchParams.set('output_modalities','text');
  const modelsRaw=env.OPENROUTER_API_KEY?await fetchJson(mu,{headers:{authorization:`Bearer ${env.OPENROUTER_API_KEY}`,accept:'application/json'}},8000):{ok:false,http:0,error:'MISSING_OPENROUTER_API_KEY'};
  const eligible=(modelsRaw?.body?.data||[]).filter(m=>allowed(m?.id)&&nonFree(m));const models=[],seen=new Set();for(const m of eligible){const co=company(m.id);if(seen.has(co))continue;seen.add(co);models.push(m.id);if(models.length===2)break}
  const data_ok=data.ok===true&&row&&typeof row.question==='string'&&['number','string'].includes(typeof row.cop);
  const model_ok=modelsRaw.ok===true&&models.length===2&&company(models[0])!==company(models[1]);
  return json({ok:data_ok&&model_ok,dataset:{ok:data_ok,http:data.http,row_fields:row?Object.keys(row).sort():[],cop_type:row?typeof row.cop:null},openrouter:{ok:model_ok,http:modelsRaw.http,configured:Boolean(env.OPENROUTER_API_KEY),eligible_count:eligible.length,models,companies:models.map(company),error:modelsRaw.error||null}},data_ok&&model_ok?200:503);
}
