import type {ServerEnv} from "@tokos-data/config";
import {dbPool} from "@tokos-data/db";
import {classifyAsset,notchDelta,rateMarket,METHODOLOGY_VERSION,type Grade,type MarketFacts,type Outlook} from "@tokos-data/ratings";

const num=(v:unknown)=>{const n=typeof v==="number"?v:v==null?NaN:Number(v);return Number.isFinite(n)?n:null};
const pick=(meta:Record<string,unknown>,keys:string[])=>{for(const k of keys){const v=num(meta[k]);if(v!=null)return v}const src=meta.source;if(src&&typeof src==="object")for(const k of keys){const v=num((src as Record<string,unknown>)[k]);if(v!=null)return v}return null};

/**
 * Pooled lending reserves (1delta) expose the loan asset but not the collateral mix. Until position data is
 * ingested, the representative collateral is the dominant collateral family for that loan asset class.
 */
function representativeCollateral(loanSymbol:string|null,assetGroup:string|null){
  const a=classifyAsset(loanSymbol,{assetGroup});
  if(a==="stable-fiat"||a==="stable-synthetic"||a==="principal-token")return "WETH";
  if(a==="major"||a==="lst"||a==="lrt")return "wstETH";
  if(a==="wrapped-btc")return "WBTC";
  return "WETH";
}

export async function materializeRatings(env:ServerEnv,options:{paths?:number;driverPaths?:number;limit?:number}={}){
  const db=dbPool(env.DATABASE_URL);
  const paths=options.paths??Number(process.env.RATINGS_PATHS??10000);
  const driverPaths=options.driverPaths??Number(process.env.RATINGS_DRIVER_PATHS??2000);
  const markets=await db.query(`
    SELECT lm.id,lm.market_name,lm.provider,lm.protocol_slug,lm.market_type,lm.asset_symbol,lm.asset_group,
      lm.supply_apr,lm.fixed_apy,lm.implied_apy,lm.deposits_usd,lm.tvl_usd,lm.liquidity_usd,lm.utilization,lm.stale,
      m.metadata,
      (SELECT stddev_samp(COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr)) FROM cagg_market_daily d WHERE d.market_id=lm.id AND d.bucket>=now()-interval '30 days') rate_volatility,
      x.price_impact_bps,x.notional_usd depth_notional_usd
    FROM mv_latest_markets lm JOIN markets m ON m.id=lm.id
    LEFT JOIN LATERAL(SELECT price_impact_bps,notional_usd FROM execution_depth_snapshots e WHERE e.market_id=lm.id AND e.price_impact_bps IS NOT NULL ORDER BY e.observed_at DESC,e.notional_usd DESC LIMIT 1) x ON TRUE
    WHERE lm.status='active' AND NOT lm.stale
    ORDER BY COALESCE(lm.deposits_usd,lm.tvl_usd,0) DESC NULLS LAST
    ${options.limit?`LIMIT ${Math.max(1,Math.floor(options.limit))}`:""}
  `);
  const previous=new Map<string,{grade:Grade;psl:number;outlook:Outlook}>();
  for(const r of (await db.query(`SELECT entity_id,grade,psl,outlook FROM ratings_latest WHERE entity_type='market' AND methodology_version=$1`,[METHODOLOGY_VERSION])).rows)previous.set(r.entity_id,{grade:r.grade,psl:Number(r.psl),outlook:r.outlook});
  let rated=0,actions=0;const started=Date.now();
  for(const m of markets.rows){
    const meta=(m.metadata&&typeof m.metadata==="object"?m.metadata:{}) as Record<string,unknown>;
    const loanSymbol=m.asset_symbol??null;
    const isPendle=m.provider==="pendle";
    const facts:MarketFacts={
      marketId:m.id,marketName:m.market_name,provider:m.provider,protocolSlug:m.protocol_slug,
      loanSymbol:isPendle?"USDC":loanSymbol,loanAssetGroup:isPendle?"usd":m.asset_group,
      collateralSymbol:isPendle?`PT-${loanSymbol??"asset"}`:representativeCollateral(loanSymbol,m.asset_group),
      collateralAssetGroup:m.asset_group,marketType:m.market_type,
      supplyUsd:num(m.deposits_usd)??num(m.tvl_usd),utilization:isPendle?null:num(m.utilization),
      lltv:pick(meta,["ltv","liquidationThreshold","liquidation_threshold","collateralFactor","lltv"]),
      liquidationBonus:pick(meta,["liquidationBonus","liquidation_bonus","liquidationPenalty"]),
      observedVol:null,
      priceImpact:num(m.price_impact_bps)==null?null:Number(m.price_impact_bps)/10000,
      depthNotionalUsd:num(m.depth_notional_usd),
      liquidityUsd:num(m.liquidity_usd),
      rateVolatility30d:num(m.rate_volatility),
      oracleLagDays:null,protocolPd:null,
      supplyApy:num(m.supply_apr)??num(m.fixed_apy)??num(m.implied_apy)
    };
    const prev=previous.get(m.id)??null;
    const t=Date.now();
    const out=rateMarket(facts,{paths,driverPaths,previous:prev?{grade:prev.grade,psl:prev.psl,outlook:prev.outlook}:null});
    const run=await db.query(`
      INSERT INTO rating_runs(entity_type,entity_id,methodology_version,grade,outlook,psl,psl_low,psl_high,lgd,expected_loss,supply_apy,risk_adjusted_apy,coverage,seed,paths,inputs_hash,inputs,drivers,simulation,limitations,duration_ms)
      VALUES('market',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20) RETURNING id,computed_at
    `,[m.id,out.methodologyVersion,out.grade,out.outlook,out.psl,out.pslLow,out.pslHigh,out.lgd,out.expectedLoss,facts.supplyApy,out.riskAdjustedApy,out.coverage,out.seed,out.paths,out.inputsHash,
      JSON.stringify({records:out.inputs,archetypes:out.archetypes,facts}),JSON.stringify(out.drivers),
      JSON.stringify({psl:out.psl,pslLow:out.pslLow,pslHigh:out.pslHigh,lgd:out.lgd,expectedLoss:out.expectedLoss,quantiles:out.simulation.quantiles,histogram:out.simulation.histogram,channels:out.simulation.channels,samplePaths:out.simulation.samplePaths,band:out.band}),
      JSON.stringify(out.limitations),Date.now()-t]);
    const runId=run.rows[0].id,computedAt=run.rows[0].computed_at;
    await db.query(`
      INSERT INTO ratings_latest(entity_type,entity_id,run_id,methodology_version,grade,outlook,psl,psl_low,psl_high,lgd,expected_loss,supply_apy,risk_adjusted_apy,coverage,top_driver,computed_at)
      VALUES('market',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT(entity_type,entity_id) DO UPDATE SET run_id=EXCLUDED.run_id,methodology_version=EXCLUDED.methodology_version,grade=EXCLUDED.grade,outlook=EXCLUDED.outlook,psl=EXCLUDED.psl,psl_low=EXCLUDED.psl_low,psl_high=EXCLUDED.psl_high,lgd=EXCLUDED.lgd,expected_loss=EXCLUDED.expected_loss,supply_apy=EXCLUDED.supply_apy,risk_adjusted_apy=EXCLUDED.risk_adjusted_apy,coverage=EXCLUDED.coverage,top_driver=EXCLUDED.top_driver,computed_at=EXCLUDED.computed_at
    `,[m.id,runId,out.methodologyVersion,out.grade,out.outlook,out.psl,out.pslLow,out.pslHigh,out.lgd,out.expectedLoss,facts.supplyApy,out.riskAdjustedApy,out.coverage,out.drivers[0]?.label??null,computedAt]);
    let action:string|null=null,reason="";const notches=prev?notchDelta(prev.grade,out.grade):0;
    if(!prev){action="initiate";reason=`Initial ${out.grade} rating, PSL ${(out.psl*100).toFixed(2)}%, top driver ${out.drivers[0]?.label??"n/a"}`}
    else if(prev.grade!=="NR"&&out.grade==="NR"){action="withdraw";reason="Coverage fell below the published floor"}
    else if(prev.grade!==out.grade){action=notches>0?"upgrade":"downgrade";reason=`${prev.grade} to ${out.grade} (${Math.abs(notches)} notch${Math.abs(notches)===1?"":"es"}), PSL ${(prev.psl*100).toFixed(2)}% to ${(out.psl*100).toFixed(2)}%, driver ${out.drivers[0]?.label??"n/a"}`}
    else if(prev.outlook!==out.outlook){action="outlook";reason=`Outlook ${prev.outlook} to ${out.outlook}, PSL ${(out.psl*100).toFixed(2)}%`}
    if(action){await db.query(`INSERT INTO rating_actions(entity_type,entity_id,action,from_grade,to_grade,from_psl,to_psl,from_outlook,to_outlook,notches,reason,run_id,methodology_version,observed_at) VALUES('market',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[m.id,action,prev?.grade??null,out.grade,prev?.psl??null,out.psl,prev?.outlook??null,out.outlook,notches,reason,runId,out.methodologyVersion,computedAt]);actions++}
    rated++;
    if(rated%25===0)await new Promise(r=>setImmediate(r));
  }
  return{rated,actions,paths,driverPaths,durationMs:Date.now()-started};
}
