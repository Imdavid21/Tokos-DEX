import type {ServerEnv} from "@tokos-data/config";
import {dbPool} from "@tokos-data/db";

const METHODOLOGY="risk-v1";
const asSeverity=(dimension:string,value:number|null)=>{
  if(value==null)return null;
  if(dimension==="liquidity"){
    if(value<100_000)return "high"; if(value<500_000)return "elevated"; if(value<2_000_000)return "moderate"; return "low";
  }
  if(dimension==="utilization"){
    if(value>=.95)return "high"; if(value>=.9)return "elevated"; if(value>=.8)return "moderate"; return "low";
  }
  if(dimension==="rate_volatility"){
    if(value>=.25)return "high"; if(value>=.12)return "elevated"; if(value>=.05)return "moderate"; return "low";
  }
  if(dimension==="price_impact"){
    if(value>=200)return "high"; if(value>=100)return "elevated"; if(value>=50)return "moderate"; return "low";
  }
  return null;
};

export async function materializeRiskIntelligence(env:ServerEnv){
  const db=dbPool(env.DATABASE_URL);
  const observedAt=new Date().toISOString();
  await db.query("BEGIN");
  try{
    // Canonical graph edges already implied by normalized market dimensions.
    await db.query(`
      INSERT INTO entity_dependencies(source_type,source_id,relationship,target_type,target_id,source,methodology_version,observed_at,stale,metadata)
      SELECT 'market',id,'uses_asset','asset',asset_id,'tokos-normalized','dependency-v1',$1,stale,jsonb_build_object('provider',provider)
      FROM mv_latest_markets WHERE status='active' AND asset_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `,[observedAt]);
    await db.query(`
      INSERT INTO entity_dependencies(source_type,source_id,relationship,target_type,target_id,source,methodology_version,observed_at,stale,metadata)
      SELECT 'market',id,'operated_by','protocol',protocol_id,'tokos-normalized','dependency-v1',$1,stale,jsonb_build_object('provider',provider)
      FROM mv_latest_markets WHERE status='active' AND protocol_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `,[observedAt]);
    await db.query(`
      INSERT INTO entity_dependencies(source_type,source_id,relationship,target_type,target_id,source,methodology_version,observed_at,stale,metadata)
      SELECT 'market',id,'deployed_on','chain',chain_id,'tokos-normalized','dependency-v1',$1,stale,jsonb_build_object('provider',provider)
      FROM mv_latest_markets WHERE status='active' AND chain_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `,[observedAt]);

    const markets=await db.query(`
      SELECT lm.id,lm.liquidity_usd,lm.utilization,lm.stale,lm.provider,
        (SELECT stddev_samp(COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr))
         FROM cagg_market_daily d WHERE d.market_id=lm.id AND d.bucket>=now()-interval '30 days') rate_volatility,
        (SELECT x.price_impact_bps FROM execution_depth_snapshots x
         WHERE x.market_id=lm.id AND x.price_impact_bps IS NOT NULL
         ORDER BY x.observed_at DESC,x.notional_usd DESC LIMIT 1) price_impact_bps
      FROM mv_latest_markets lm WHERE lm.status='active'
    `);
    let observations=0;
    for(const m of markets.rows){
      const defs=[
        {dimension:"liquidity",metric:"available_liquidity_usd",value:m.liquidity_usd==null?null:Number(m.liquidity_usd),unit:"USD",direction:"higher_is_better"},
        {dimension:"utilization",metric:"utilization",value:m.utilization==null?null:Number(m.utilization),unit:"ratio",direction:"lower_is_better"},
        {dimension:"rate_volatility",metric:"rate_volatility_30d",value:m.rate_volatility==null?null:Number(m.rate_volatility),unit:"ratio",direction:"lower_is_better"},
        {dimension:"price_impact",metric:"latest_price_impact_bps",value:m.price_impact_bps==null?null:Number(m.price_impact_bps),unit:"bps",direction:"lower_is_better"}
      ] as const;
      for(const d of defs){
        if(d.value==null||!Number.isFinite(d.value))continue;
        await db.query(`
          INSERT INTO risk_observations(entity_type,entity_id,dimension,metric_key,value,unit,direction,severity,confidence,source,observed_at,methodology_version,assumptions,stale,metadata)
          VALUES('market',$1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,'[]',$11,$12)
          ON CONFLICT DO NOTHING
        `,[m.id,d.dimension,d.metric,d.value,d.unit,d.direction,asSeverity(d.dimension,d.value),m.provider,observedAt,METHODOLOGY,Boolean(m.stale),JSON.stringify({derivation:d.dimension==="rate_volatility"?"30d sample standard deviation":"latest normalized observation"})]);
        observations++;
      }
    }

    // Propagate observed market risk to parent entities without inventing new credit probabilities.
    for(const kind of ["asset","protocol","chain"] as const){
      const col=kind+"_id";
      const rows=await db.query(`
        WITH latest AS(
          SELECT DISTINCT ON(entity_id,metric_key) entity_id,metric_key,value,unit,direction,severity
          FROM risk_observations WHERE entity_type='market' ORDER BY entity_id,metric_key,observed_at DESC
        )
        SELECT lm.${col} entity_id,l.metric_key,l.unit,l.direction,avg(l.value) value,count(*) markets
        FROM mv_latest_markets lm JOIN latest l ON l.entity_id=lm.id
        WHERE lm.status='active' AND lm.${col} IS NOT NULL
        GROUP BY lm.${col},l.metric_key,l.unit,l.direction
      `);
      for(const r of rows.rows){
        const value=Number(r.value); if(!Number.isFinite(value))continue;
        await db.query(`
          INSERT INTO risk_observations(entity_type,entity_id,dimension,metric_key,value,unit,direction,severity,confidence,source,observed_at,methodology_version,assumptions,stale,metadata)
          VALUES($1,$2,'market_exposure',$3,$4,$5,$6,NULL,.8,'tokos-derived',$5,$6,'["Mean of observed child-market metric; not a credit rating"]',false,$7)
          ON CONFLICT DO NOTHING
        `,[kind,r.entity_id,'mean_'+r.metric_key,value,r.unit,r.direction,observedAt,METHODOLOGY,JSON.stringify({markets:Number(r.markets)})]);
        observations++;
      }
    }

    // Entity concentration: HHI of tracked deposits/TVL by market, preserving missingness.
    for(const kind of ["asset","protocol","chain"] as const){
      const col=kind+"_id";
      const rows=await db.query(`
        WITH x AS(
          SELECT ${col} entity_id,id,COALESCE(deposits_usd,tvl_usd) value
          FROM mv_latest_markets WHERE status='active' AND ${col} IS NOT NULL AND COALESCE(deposits_usd,tvl_usd)>0
        ), t AS(SELECT entity_id,sum(value) total FROM x GROUP BY entity_id)
        SELECT x.entity_id,sum(power(x.value/t.total,2)) hhi,count(*) markets
        FROM x JOIN t USING(entity_id) GROUP BY x.entity_id
      `);
      for(const r of rows.rows){
        const hhi=Number(r.hhi);
        await db.query(`
          INSERT INTO risk_observations(entity_type,entity_id,dimension,metric_key,value,unit,direction,severity,confidence,source,observed_at,methodology_version,assumptions,stale,metadata)
          VALUES($1,$2,'concentration','market_concentration_hhi',$3,'ratio','lower_is_better',$4,1,'tokos-derived',$5,$6,'["Based on tracked deposits/TVL only"]',false,$7)
          ON CONFLICT DO NOTHING
        `,[kind,r.entity_id,hhi,hhi>=.5?"high":hhi>=.25?"elevated":hhi>=.15?"moderate":"low",observedAt,METHODOLOGY,JSON.stringify({markets:Number(r.markets)})]);
        observations++;
      }
    }
    await db.query("COMMIT");
    return {markets:markets.rowCount??0,observations,observedAt};
  }catch(error){await db.query("ROLLBACK");throw error}
}
