const url="https://expert-worker.a15280020511.workers.dev/v1/.canary/20260815-a9f7c2";
const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
const body=await r.json().catch(()=>null);
const s=Number(body?.http_status||0);
console.log(JSON.stringify({diagnostic:"http200-validation-failure",endpoint_status:r.status,canary_http_status:s,error:body?.error||null}));
process.exit(s===200&&body?.ok===false?0:1);
