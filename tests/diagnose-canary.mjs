const url="https://expert-worker.a15280020511.workers.dev/v1/.canary/20260815-a9f7c2";
const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
const body=await r.json().catch(()=>null);
const s=Number(body?.http_status||0);
console.log(JSON.stringify({diagnostic:"request-contract",endpoint_status:r.status,canary_http_status:s,error:body?.error||null}));
process.exit([400,404,413,422].includes(s)?0:1);
