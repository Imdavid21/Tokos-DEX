import{loadServerEnv}from"@tokos-data/config";import{closeDb,dbPool,Repository}from"@tokos-data/db";import{normalizeOneDeltaMarket,payloadHash}from"@tokos-data/providers";import{backfillPendleHistory,ingestPendleMarkets,markStale,services}from"./ingest.js";

const env=loadServerEnv();
const db=dbPool(env.DATABASE_URL),repo=new Repository(db);
const fail=(message:string):never=>{throw new Error(`live validation failed: ${message}`)};

async function ingestOneDeltaSample(){
 const{oneDelta}=services(env),chains=await oneDelta.chains(),chain=chains.find(c=>c.chainId==="1")??chains[0];if(!chain)fail("1delta returned no chains");
 const lenders=await oneDelta.lenders([chain.chainId]),keys=[...new Set(lenders.map(r=>r.lenderInfo.key))].slice(0,12);let markets=0,successfulLenders=0;const failedLenders:string[]=[];
 for(const key of keys){try{const response=await oneDelta.latest([chain.chainId],[key],{terms:"digest",attempts:2});await repo.insertProviderObservation({provider:"1delta",endpoint:"/data/lending/latest",requestFingerprint:`live-validation:${chain.chainId}:${key}`,httpStatus:response.status,success:true,payload:response.raw,payloadHash:payloadHash(response.raw)});let lenderMarkets=0;for(const item of response.parsed.data.items)for(const source of item.markets){const n=normalizeOneDeltaMarket(item,source,chain.name);await repo.transaction(async c=>{await repo.upsertChain(n.chain,c);await repo.upsertAsset(n.asset,c);await repo.upsertProtocol(n.protocol,c);await repo.upsertMarket(n.market,{termSheet:source.termSheet??null},c);await repo.insertSnapshot(n.snapshot,c)});markets++;lenderMarkets++;}if(lenderMarkets>0)successfulLenders++;if(successfulLenders>=4&&markets>=8)break;}catch(error){failedLenders.push(key);const payload={error:error instanceof Error?error.message:String(error),lender:key};await repo.insertProviderObservation({provider:"1delta",endpoint:"/data/lending/latest",requestFingerprint:`live-validation:${chain.chainId}:${key}`,httpStatus:0,success:false,payload,payloadHash:payloadHash(payload),errorCode:null});}}
 if(markets<1)fail(`1delta sample produced no normalized markets; failed lenders=${failedLenders.join(",")}`);return{chain:chain.chainId,lendersTried:successfulLenders+failedLenders.length,successfulLenders,failedLenders,markets};
}

try{
 const oneDelta=await ingestOneDeltaSample();
 const pendle=await ingestPendleMarkets(env);if(pendle.markets<1)fail("Pendle returned no normalized markets");
 await markStale(env);

 const counts=await db.query(`SELECT provider,count(*)::int markets FROM markets GROUP BY provider ORDER BY provider`),byProvider=Object.fromEntries(counts.rows.map(r=>[String(r.provider),Number(r.markets)]));
 if((byProvider["1delta"]??0)<1||(byProvider.pendle??0)<1)fail(`provider market counts invalid: ${JSON.stringify(byProvider)}`);

 const snapshots=await db.query(`SELECT m.provider,count(*)::int snapshots FROM market_snapshots s JOIN markets m ON m.id=s.market_id GROUP BY m.provider ORDER BY m.provider`),snapshotCounts=Object.fromEntries(snapshots.rows.map(r=>[String(r.provider),Number(r.snapshots)]));
 if((snapshotCounts["1delta"]??0)<1||(snapshotCounts.pendle??0)<1)fail(`provider snapshot counts invalid: ${JSON.stringify(snapshotCounts)}`);

 const badIds=await db.query(`SELECT count(*)::int n FROM markets WHERE (provider='1delta' AND id NOT LIKE '1delta:%') OR (provider='pendle' AND id NOT LIKE 'pendle:%')`);if(Number(badIds.rows[0]?.n??0)>0)fail("canonical provider-prefixed market IDs are inconsistent");
 const duplicateProviderIds=await db.query(`SELECT provider,provider_market_id,count(*) FROM markets GROUP BY provider,provider_market_id HAVING count(*)>1 LIMIT 1`);if(duplicateProviderIds.rowCount)fail("duplicate provider market identifiers found");
 const badUtil=await db.query(`SELECT count(*)::int n FROM market_snapshots WHERE utilization IS NOT NULL AND (utilization<0 OR utilization>1.000001)`);if(Number(badUtil.rows[0]?.n??0)>0)fail("utilization escaped decimal [0,1] convention");
 const badRates=await db.query(`SELECT count(*)::int n FROM market_snapshots WHERE COALESCE(supply_apr,borrow_apr,fixed_apy,implied_apy,underlying_apy) IS NOT NULL AND abs(COALESCE(supply_apr,borrow_apr,fixed_apy,implied_apy,underlying_apy))>20`);if(Number(badRates.rows[0]?.n??0)>0)fail("rate unit sanity check failed");
 const badMaturity=await db.query(`SELECT count(*)::int n FROM markets WHERE provider='pendle' AND ((status='active' AND maturity<=now()) OR (status='matured' AND maturity>now()))`);if(Number(badMaturity.rows[0]?.n??0)>0)fail("Pendle maturity/status mapping is inconsistent");

 const historyCandidate=await db.query(`SELECT id FROM markets WHERE provider='pendle' AND status='active' AND market_address IS NOT NULL ORDER BY maturity ASC NULLS LAST LIMIT 1`);let history:{markets:number|null;points:number}={markets:0,points:0};if(historyCandidate.rowCount){history=await backfillPendleHistory(env,String(historyCandidate.rows[0].id));if(history.points<2)fail("Pendle historical backfill returned fewer than two points");}

 const oneDeltaChain=await db.query(`SELECT chain_id FROM markets WHERE provider='1delta' AND status='active' ORDER BY chain_id LIMIT 1`),assetGroup=await db.query(`SELECT a.asset_group FROM markets m JOIN assets a ON a.id=m.asset_id WHERE m.provider='1delta' AND m.status='active' AND a.asset_group IS NOT NULL ORDER BY m.updated_at DESC LIMIT 1`);let comparableItems=0;
 if(oneDeltaChain.rowCount&&assetGroup.rowCount){const{oneDelta:client}=services(env),response=await client.comparables({chainIds:String(oneDeltaChain.rows[0].chain_id),collateralGroups:String(assetGroup.rows[0].asset_group),amountUsd:100000,horizonDays:90,side:"supply",rateType:"all",limit:25,includeStale:false,includeIlliquid:false});comparableItems=response.parsed.data.items.length;for(const item of response.parsed.data.items){for(const value of[item.aprPct,item.aprAtAmountPct,item.effectiveAprPct])if(value!=null&&!Number.isFinite(value))fail("1delta comparable returned non-finite rate");}}

 const stale=await db.query(`SELECT m.provider,count(*) FILTER(WHERE s.stale)::int stale,count(*)::int total FROM market_snapshots s JOIN markets m ON m.id=s.market_id WHERE s.observed_at=(SELECT max(s2.observed_at) FROM market_snapshots s2 WHERE s2.market_id=s.market_id) GROUP BY m.provider ORDER BY m.provider`);
 console.log(JSON.stringify({ok:true,oneDelta,pendle,markets:byProvider,snapshots:snapshotCounts,history,comparableItems,staleness:stale.rows},null,2));
}finally{await closeDb();}
