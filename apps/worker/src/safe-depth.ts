import{METHODOLOGY_VERSION}from"@tokos-data/analytics";import type{ServerEnv}from"@tokos-data/config";import{pctToDecimal,ProviderError}from"@tokos-data/providers";import{services}from"./ingest.js";
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function ingestOneDeltaDepthBounded(env:ServerEnv,notionalUsd=100000,maxMarkets=60){
 const{repo,oneDelta}=services(env);
 const result=await repo.pool.query(`SELECT m.id,m.provider_market_id FROM markets m JOIN mv_latest_markets l ON l.id=m.id WHERE m.provider='1delta' AND m.status='active' AND NOT l.stale ORDER BY l.liquidity_usd DESC NULLS LAST,m.updated_at DESC LIMIT $1`,[maxMarkets]);
 const map=new Map<string,string>();for(const r of result.rows as{id:string;provider_market_id:string}[])map.set(r.provider_market_id,r.id);
 const uids=[...map.keys()];let points=0,batches=0,failedBatches=0,throttled=false,calls=0;const maxCalls=Number(process.env.ONEDELTA_DEPTH_MAX_CALLS??40);
 const run=async(batch:string[]):Promise<void>=>{
  if(throttled||calls>=maxCalls||!batch.length)return;
  calls++;
  try{const response=await oneDelta.depth(batch,notionalUsd,"supply"),at=new Date().toISOString();batches++;for(const item of response.parsed.data.items){const marketId=map.get(item.marketUid);if(!marketId)continue;for(const p of item.rateAtAmount??[]){await repo.upsertExecutionDepth({marketId,observedAt:at,side:p.side,notionalUsd:p.amountUsd??notionalUsd,horizonDays:null,headlineApr:pctToDecimal(p.depositAprPct),aprAtAmount:pctToDecimal(p.depositAprPct),effectiveApr:pctToDecimal(p.depositAprPct),effectiveApy:null,costPct:null,priceImpactBps:null,feeUsd:null,fillable:p.fillable??null,capped:p.capped??null,quoteBasis:"provider-simulated",locked:false,priceRisk:false,assumptions:["Amount-specific post-action rate from 1delta depth endpoint"],methodologyVersion:METHODOLOGY_VERSION});points++;}}}
  catch(error){
   if(error instanceof ProviderError&&error.status===429){throttled=true;return;}
   failedBatches++;console.error(JSON.stringify({level:"error",event:"onedelta-depth-batch-failed",size:batch.length,status:error instanceof ProviderError?error.status:null,message:error instanceof Error?error.message.slice(0,300):String(error).slice(0,300)}));
   // A provider 5xx on one market can fail the whole batch: split and retry so the healthy markets still get depth.
   if(batch.length>1){const mid=Math.ceil(batch.length/2);await wait(2000);await run(batch.slice(0,mid));await wait(2000);await run(batch.slice(mid));}
  }
 };
 for(let i=0;i<uids.length;i+=20){await run(uids.slice(i,i+20));if(i+20<uids.length)await wait(4000);}
 return{markets:uids.length,points,batches,failedBatches,calls,throttled,notionalUsd};
}
