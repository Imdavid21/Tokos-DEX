import{createHash}from"node:crypto";import{basisBps,METHODOLOGY_VERSION}from"@tokos-data/analytics";import type{ServerEnv}from"@tokos-data/config";import{chainAllowlist,rateAssetGroups,rateHorizonGrid,rateNotionalGrid}from"@tokos-data/config";import{dbPool,Repository}from"@tokos-data/db";import{OneDeltaClient,PendleClient,chunkLenders,normalizeOneDeltaMarket,normalizePendleHistoryPoint,normalizePendleMarket,payloadHash,pctToDecimal}from"@tokos-data/providers";
const fingerprint=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type PendleTokenMeta={address?:string;decimals?:number;price?:{usd?:number|null};};
type PendleMarketMeta={underlyingAsset?:PendleTokenMeta;sy?:PendleTokenMeta;pt?:PendleTokenMeta;};

export function services(env:ServerEnv){const repo=new Repository(dbPool(env.DATABASE_URL)),oneDelta=new OneDeltaClient({baseUrl:env.ONEDELTA_API_BASE_URL,apiKey:env.ONEDELTA_API_KEY}),pendle=new PendleClient({baseUrl:env.PENDLE_API_BASE_URL,apiKey:env.PENDLE_API_KEY});return{repo,oneDelta,pendle};}
async function refresh(repo:Repository){for(const n of["mv_latest_markets","mv_asset_summary","mv_protocol_summary","mv_chain_summary","mv_rate_movers"])await repo.pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${n}`);}
export async function ingestOneDeltaLatest(env:ServerEnv){
 const{repo,oneDelta}=services(env);try{
  const discovered=await oneDelta.chains(),allow=chainAllowlist(env),chains=allow?discovered.filter(c=>allow.includes(c.chainId)):discovered,ids=chains.map(c=>c.chainId),names=new Map(chains.map(c=>[c.chainId,c.name]));
  const lenderRows=await oneDelta.lenders(ids),keys=[...new Set(lenderRows.map(r=>r.lenderInfo.key))];let count=0;
  for(const batch of chunkLenders(keys,20)){const response=await oneDelta.latest(ids,batch,{terms:"digest"});await repo.insertProviderObservation({provider:"1delta",endpoint:"/data/lending/latest",requestFingerprint:fingerprint({chains:ids,lenders:batch}),httpStatus:response.status,success:true,payload:response.raw,payloadHash:payloadHash(response.raw)});
   for(const item of response.parsed.data.items)for(const source of item.markets){const n=normalizeOneDeltaMarket(item,source,names.get(item.chainId)??"");await repo.transaction(async c=>{await repo.upsertChain(n.chain,c);await repo.upsertAsset(n.asset,c);await repo.upsertProtocol(n.protocol,c);await repo.upsertMarket(n.market,{termSheet:source.termSheet??null},c);await repo.insertSnapshot(n.snapshot,c)});count++;}
  }
  await repo.markProviderHealth("1delta",true);await refresh(repo);return{markets:count,chains:chains.length,lenders:keys.length};
 }catch(e){await repo.markProviderHealth("1delta",false,e instanceof Error?e.message:String(e));throw e}
}
export async function ingestPendleMarkets(env:ServerEnv){
 const{repo,pendle}=services(env);try{const{markets,rawPages}=await pendle.allMarkets();for(const raw of rawPages)await repo.insertProviderObservation({provider:"pendle",endpoint:"/v2/markets/all",requestFingerprint:fingerprint({pageHash:payloadHash(raw)}),httpStatus:200,success:true,payload:raw,payloadHash:payloadHash(raw)});let count=0;
 for(const source of markets){const n=normalizePendleMarket(source);await repo.transaction(async c=>{await repo.upsertChain(n.chain,c);await repo.upsertAsset(n.asset,c);await repo.upsertProtocol(n.protocol,c);await repo.upsertMarket(n.market,source,c);await repo.insertSnapshot(n.snapshot,c)});count++;}
 await repo.markProviderHealth("pendle",true);await refresh(repo);return{markets:count};}catch(e){await repo.markProviderHealth("pendle",false,e instanceof Error?e.message:String(e));throw e}
}
export async function backfillPendleHistory(env:ServerEnv,marketId?:string){
 const{repo,pendle}=services(env);const params:unknown[]=[];let where="provider='pendle' AND market_address IS NOT NULL";if(marketId){params.push(marketId);where+=` AND id=$${params.length}`};const result=await repo.pool.query(`SELECT id,chain_id,market_address FROM markets WHERE ${where} ORDER BY updated_at DESC LIMIT 250`,params);let points=0;
 for(const row of result.rows as{id:string;chain_id:string;market_address:string}[]){const response=await pendle.historicalData(row.chain_id,row.market_address),hash=payloadHash(response.raw);await repo.insertProviderObservation({provider:"pendle",endpoint:`/v3/${row.chain_id}/markets/${row.market_address}/historical-data`,requestFingerprint:fingerprint({market:row.id}),httpStatus:response.status,success:true,payload:response.raw,payloadHash:hash});for(const p of response.points){await repo.insertSnapshot(normalizePendleHistoryPoint(row.id,p,hash));points++;}}
 await refresh(repo);return{markets:result.rowCount,points};
}
export async function ingestOneDeltaDepth(env:ServerEnv,notionalUsd=100000){
 const{repo,oneDelta}=services(env);const result=await repo.pool.query(`SELECT id,provider_market_id FROM markets WHERE provider='1delta' AND status='active' ORDER BY updated_at DESC LIMIT 500`),map=new Map<string,string>();for(const r of result.rows as{id:string;provider_market_id:string}[])map.set(r.provider_market_id,r.id);const uids=[...map.keys()];let count=0;
 for(let i=0;i<uids.length;i+=20){const batch=uids.slice(i,i+20),response=await oneDelta.depth(batch,notionalUsd,"supply"),at=new Date().toISOString();for(const item of response.parsed.data.items){const marketId=map.get(item.marketUid);if(!marketId)continue;for(const p of item.rateAtAmount??[]){await repo.upsertExecutionDepth({marketId,observedAt:at,side:p.side,notionalUsd:p.amountUsd??notionalUsd,horizonDays:null,headlineApr:pctToDecimal(p.depositAprPct),aprAtAmount:pctToDecimal(p.depositAprPct),effectiveApr:pctToDecimal(p.depositAprPct),effectiveApy:null,costPct:null,priceImpactBps:null,feeUsd:null,fillable:p.fillable??null,capped:p.capped??null,quoteBasis:"provider-simulated",locked:false,priceRisk:false,assumptions:["Amount-specific post-action rate from 1delta depth endpoint"],methodologyVersion:METHODOLOGY_VERSION});count++;}}}
 return{points:count,notionalUsd};
}
export async function markStale(env:ServerEnv){const{repo}=services(env);await repo.pool.query("SELECT set_snapshot_staleness($1,$2)",[env.STALE_LENDING_SECONDS,env.STALE_PENDLE_SECONDS]);await refresh(repo);}

export async function ingestOneDeltaComparables(env:ServerEnv){
 const{repo,oneDelta}=services(env),groups=rateAssetGroups(env),notionals=rateNotionalGrid(env),horizons=rateHorizonGrid(env);
 const chainRows=await repo.pool.query(`SELECT DISTINCT chain_id FROM markets WHERE provider='1delta' AND status='active' ORDER BY chain_id`),chainIds=chainRows.rows.map(r=>String(r.chain_id)).join(",");
 if(!chainIds)return{points:0,basis:0};let points=0,basisCount=0;
 for(const group of groups)for(const notionalUsd of notionals)for(const horizonDays of horizons){
  const response=await oneDelta.comparables({chainIds,collateralGroups:group,amountUsd:notionalUsd,horizonDays,side:"supply",rateType:"all",limit:25});
  await repo.insertProviderObservation({provider:"1delta",endpoint:"/data/lending/comparables",requestFingerprint:fingerprint({group,notionalUsd,horizonDays,chainIds}),httpStatus:response.status,success:true,payload:response.raw,payloadHash:payloadHash(response.raw)});
  const at=new Date().toISOString(),stored:Array<{marketId:string;rate:number;locked:boolean}>=[];
  for(const item of response.parsed.data.items){const marketId=`1delta:${item.marketUid}`,exists=await repo.pool.query("SELECT asset_id FROM markets WHERE id=$1",[marketId]);if(!exists.rowCount)continue;const headline=pctToDecimal(item.aprPct),atAmount=pctToDecimal(item.aprAtAmountPct),effective=pctToDecimal(item.effectiveAprPct);await repo.upsertExecutionDepth({marketId,observedAt:at,side:"supply",notionalUsd,horizonDays,headlineApr:headline,aprAtAmount:atAmount,effectiveApr:effective,effectiveApy:null,costPct:pctToDecimal(item.costPct),priceImpactBps:null,feeUsd:null,fillable:item.depth?.fillable??null,capped:item.depth?.capped??null,quoteBasis:item.horizon.basis,locked:item.horizon.locked,priceRisk:item.horizon.priceRisk,assumptions:item.horizon.assumptions,methodologyVersion:METHODOLOGY_VERSION});const rate=effective??atAmount??headline;if(rate!==null)stored.push({marketId,rate,locked:item.horizon.locked});points++;}
  const floating=stored.filter(x=>!x.locked).sort((a,b)=>b.rate-a.rate)[0],fixed=stored.filter(x=>x.locked).sort((a,b)=>b.rate-a.rate)[0];if(floating&&fixed){const a=await repo.pool.query("SELECT asset_id FROM markets WHERE id=$1",[fixed.marketId]);if(a.rowCount){await repo.upsertBasis({assetId:a.rows[0].asset_id,observedAt:at,horizonDays,notionalUsd,fixedMarketId:fixed.marketId,floatingMarketId:floating.marketId,fixedRate:fixed.rate,floatingRate:floating.rate,basisBps:basisBps(fixed.rate,floating.rate)??0,methodologyVersion:METHODOLOGY_VERSION});basisCount++;}}
 }
 return{points,basis:basisCount};
}

function usdToRaw(notionalUsd:number,priceUsd:number,decimals:number){
 if(!(notionalUsd>0)||!(priceUsd>0)||!Number.isInteger(decimals)||decimals<0||decimals>36)return null;
 const scale=100_000_000,usdScaled=BigInt(Math.round(notionalUsd*scale)),priceScaled=BigInt(Math.round(priceUsd*scale));if(priceScaled<=0n)return null;
 return(usdScaled*(10n**BigInt(decimals))/priceScaled).toString();
}
export async function ingestPendleDepth(env:ServerEnv){
 const{repo,pendle}=services(env),notionals=rateNotionalGrid(env),rows=await repo.pool.query(`SELECT m.id,m.chain_id,m.market_address,m.maturity,m.metadata,l.liquidity_usd FROM markets m JOIN mv_latest_markets l ON l.id=m.id WHERE m.provider='pendle' AND m.status='active' AND m.market_address IS NOT NULL ORDER BY l.liquidity_usd DESC NULLS LAST LIMIT 40`);let points=0,markets=0;
 for(const row of rows.rows as Array<{id:string;chain_id:string;market_address:string;maturity:string|null;metadata:unknown}>){const meta=(row.metadata&&typeof row.metadata==="object"?row.metadata:{})as PendleMarketMeta,underlying=meta.underlyingAsset??meta.sy,pt=meta.pt;if(!underlying?.address||!pt?.address||underlying?.decimals==null||!underlying?.price?.usd)continue;let tokens;try{tokens=await pendle.marketTokens(row.chain_id,row.market_address)}catch{continue}const allowed=new Set(tokens.parsed.tokensIn.map((x:string)=>x.toLowerCase()));if(!allowed.has(String(underlying.address).toLowerCase()))continue;const tenorDays=row.maturity?Math.max(0,Math.round((new Date(row.maturity).getTime()-Date.now())/86400000)):null;if(!tenorDays)continue;markets++;
  for(const notionalUsd of notionals){const raw=usdToRaw(notionalUsd,Number(underlying.price.usd),Number(underlying.decimals));if(!raw)continue;try{const response=await pendle.convertV3(row.chain_id,{receiver:"0x000000000000000000000000000000000000dEaD",slippage:0.005,enableAggregator:false,inputs:[{token:underlying.address,amount:raw}],outputs:[pt.address],redeemRewards:false,needScale:false,additionalData:"impliedApy,effectiveApy",useLimitOrder:true});await repo.insertProviderObservation({provider:"pendle",endpoint:`/v3/sdk/${row.chain_id}/convert`,requestFingerprint:fingerprint({market:row.id,notionalUsd}),httpStatus:response.status,success:true,payload:response.raw,payloadHash:payloadHash(response.raw)});const route=response.parsed.routes[0],data=route?.data;if(data?.effectiveApy==null)continue;await repo.upsertExecutionDepth({marketId:row.id,observedAt:new Date().toISOString(),side:"supply",notionalUsd,horizonDays:tenorDays,headlineApr:null,aprAtAmount:null,effectiveApr:null,effectiveApy:data.effectiveApy,costPct:null,priceImpactBps:data.priceImpact==null?null:data.priceImpact*10000,feeUsd:data.fee?.usd??null,fillable:notionalUsd,capped:false,quoteBasis:"held-to-maturity",locked:true,priceRisk:false,assumptions:["Pendle v3 Convert quote for buying PT with the market underlying token","Held to stated maturity; no transaction submitted"],methodologyVersion:METHODOLOGY_VERSION});points++;}catch(e){break}}
 }
 return{markets,points};
}
