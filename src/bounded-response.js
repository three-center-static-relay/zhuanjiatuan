export async function readTextBounded(response,maxBytes,errorCode="UPSTREAM_RESPONSE_TOO_LARGE"){
  const declared=Number(response.headers.get("content-length")||0);
  if(Number.isFinite(declared)&&declared>maxBytes){
    await response.body?.cancel?.().catch(()=>{});
    throw Object.assign(new Error(errorCode),{status:502});
  }
  if(!response.body)return "";
  const reader=response.body.getReader(),chunks=[];
  let total=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(!value)continue;
      total+=value.byteLength;
      if(total>maxBytes){
        await reader.cancel().catch(()=>{});
        throw Object.assign(new Error(errorCode),{status:502});
      }
      chunks.push(value);
    }
  }finally{
    try{reader.releaseLock()}catch{}
  }
  const joined=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder().decode(joined);
}
