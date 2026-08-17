const json=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
const text=v=>String(v??"");
const company=id=>text(id).split('/')[0].toLowerCase();
const allowed=id=>{const x=text(id).toLowerCase();return x&&!x.startsWith('openai/')&&!x.startsWith('anthropic/')&&!x.includes('claude')&&!x.includes('flash')&&!x.includes(':free')};
const nonFree=m=>{const p=m?.pricing||{};return Number(p.prompt||0)>0||Number(p.completion||0)>0||Number(p.request||0)>0};
async function fetchText(url,init={},ms=15000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{...init,signal:c.signal}),raw=await r.text();return{ok:r.ok,http:r.status,raw}}catch(e){return{ok:false,http:0,error:String(e?.name==='AbortError'?'TIMEOUT':e?.message||e),raw:''}}finally{clearTimeout(t)}}
async function fetchJson(url,init={},ms=15000){const x=await fetchText(url,init,ms);let body=null;try{body=x.raw?JSON.parse(x.raw):null}catch{}return{...x,body}}
export async function benchmarkPreflight(env){
  const data=await fetchText('https://raw.githubusercontent.com/aistairc/medLLM_QA_benchmark/main/data/en/MedMCQA/medmcqa.jsonl',{},15000);
  const lines=data.raw.split(/\r?\n/).filter(Boolean);let row=null;try{row=lines[0]?JSON.parse(lines[0]):null}catch{}
  const mu=new URL('https://openrouter.ai/api/v1/models');mu.searchParams.set('supported_parameters','reasoning');mu.searchParams.set('sort','most-popular');mu.searchParams.set('output_modalities','text');
  const modelsRaw=env.OPENROUTER_API_KEY?await fetchJson(mu,{headers:{authorization:`Bearer ${env.OPENROUTER_API_KEY}`,accept:'application/json'}},8000):{ok:false,http:0,error:'MISSING_OPENROUTER_API_KEY'};
  const eligible=(modelsRaw?.body?.data||[]).filter(m=>allowed(m?.id)&&nonFree(m));const models=[],seen=new Set();for(const m of eligible){const co=company(m.id);if(seen.has(co))continue;seen.add(co);models.push(m.id);if(models.length===2)break}
  const data_ok=data.ok===true&&lines.length>=4000&&row&&typeof row.problem_text==='string'&&Array.isArray(row.choices)&&row.choices.length===4&&Array.isArray(row.answer)&&/^[abcd]$/i.test(String(row.answer[0]||''));
  const model_ok=modelsRaw.ok===true&&models.length===2&&company(models[0])!==company(models[1]);
  return json({ok:data_ok&&model_ok,dataset:{ok:data_ok,http:data.http,bytes:data.raw.length,rows:lines.length,row_fields:row?Object.keys(row).sort():[],answer:String(row?.answer?.[0]||'').toLowerCase()},openrouter:{ok:model_ok,http:modelsRaw.http,configured:Boolean(env.OPENROUTER_API_KEY),eligible_count:eligible.length,models,companies:models.map(company),error:modelsRaw.error||null}},data_ok&&model_ok?200:503);
}
