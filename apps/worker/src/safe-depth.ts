import{METHODOLOGY_VERSION}from"@tokos-data/analytics";import type{ServerEnv}from"@tokos-data/config";import{pctToDecimal,ProviderError}from"@tokos-data/providers";import{services}from"./ingest.js";
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function ingestOneDeltaDepthBounded(env:ServerEnv,notionalUsd=100000,maxMarkets=60){
 const{repo,oneDelta}=services(env);
 const result=await repo.pool.query(`SELECT m.id,m.provider_market_id FROM markets m JOIN mv_latest_markets l ON l.id=m.id WHERE m.provider='1delta' AND m.status='active' AND NOT l.stale ORDER BY l.liquidity_usd DESC NULLS LAST,m.updated_at DESC LIMIT $1`,[maxMarkets]);
 const map=new Map<string,string>();for(const r of result.rows as{id:string;provider_market_id:string}[])map.set(r.provider_market_id,r.id);
 const uids=[...map.keys()];let points=0,batches=0,failedBatches=0,throttled=false;
 for(let i=0;i<uids.length;i+=20){const batch=uids.slice(i,i+20);try{const response=await oneDelta.depth(batch,notionalUsd,"supply"),at=new Date().toISOString();batches++;for(const item of response.parsed.data.items){const marketId=map.get(item.marketUid);if(!marketId)continue;for(const p of item.rateAtAmount??[]){await repo.upsertExecutionDepth({marketId,observedAt:at,side:p.side,notionalUsd:p.amountUsd??notionalUsd,horizonDays:null,headlineApr:pctToDecimal(p.depositAprPct),aprAtAmount:pctToDecimal(p.depositAprPct),effectiveApr:pctToDecimal(p.depositAprPct),effectiveApy:null,costPct:null,priceImpactBps:null,feeUsd:null,fillable:p.fillable??null,capped:p.capped??null,quoteBasis:"provider-simulated",locked:false,priceRisk:false,assumptions:["Amount-specific post-action rate from 1delta depth endpoint"],methodologyVersion:METHODOLOGY_VERSION});points++;}}}catch(error){failedBatches++;if(error instanceof ProviderError&&error.status===429){throttled=true;break;}}if(i+20<uids.length)await wait(4000);}
 return{markets:uids.length,points,batches,failedBatches,throttled,notionalUsd};
}
