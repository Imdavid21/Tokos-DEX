export class ProviderError extends Error{
 constructor(message:string,public readonly provider:string,public readonly status:number|null,public readonly code:string|null,public readonly retryable:boolean){super(message);this.name="ProviderError";}
}
export async function fetchJson<T>(provider:string,url:string,init:RequestInit={},attempts=5):Promise<{data:T;status:number}>{
 let delay=2000,lastError:unknown;
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const response=await fetch(url,{...init,headers:{accept:"application/json",...init.headers},signal:AbortSignal.timeout(30000)});
   const text=await response.text();let body:unknown;
   try{body=text?JSON.parse(text):null}catch{throw new ProviderError("Provider returned malformed JSON",provider,response.status,"MALFORMED_JSON",false)}
   const top=body as {success?:boolean;error?:{code?:string;message?:string}}|null;
   if(!response.ok||top?.success===false){
    const code=top?.error?.code??null,retryable=response.status===429||response.status>=500||code==="ORIGIN_FAILED";
    const error=new ProviderError(top?.error?.message??`${provider} request failed with HTTP ${response.status}`,provider,response.status,code,retryable);
    if(!retryable||attempt===attempts)throw error;
    const h=response.headers.get("retry-after"),hinted=h?Number(h)*1000:NaN,jitter=.8+Math.random()*.4;
    await new Promise(r=>setTimeout(r,Number.isFinite(hinted)?hinted:delay*jitter));delay=Math.min(delay*2,120000);continue;
   }
   return{data:body as T,status:response.status};
  }catch(error){
   lastError=error;if(error instanceof ProviderError&&!error.retryable)throw error;if(attempt===attempts)throw error;
   await new Promise(r=>setTimeout(r,delay*(.8+Math.random()*.4)));delay=Math.min(delay*2,120000);
  }
 }
 throw lastError instanceof Error?lastError:new Error("Provider request failed");
}
