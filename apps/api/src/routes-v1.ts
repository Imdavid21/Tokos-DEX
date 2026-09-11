import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {METHODOLOGY_VERSION} from "@tokos-data/analytics";
import {dbPool} from "@tokos-data/db";
import type {ServerEnv} from "@tokos-data/config";
import {envelope,finiteOrNull,mapMarketRow} from "./lib.js";

const currentRate=`COALESCE(fixed_apy,implied_apy,supply_apr)`;
const canonicalNotionals=[10000,50000,100000,250000,500000,1000000,2500000,5000000,10000000];
const asNumber=(value:unknown)=>finiteOrNull(value);
const text=(value:unknown)=>value==null?null:String(value);

export async function registerV1AnalyticsRoutes(app:FastifyInstance,env:ServerEnv){
  const db=dbPool(env.DATABASE_URL);

  app.get("/v1/analytics/overview",async request=>{
    const parsed=z.object({days:z.coerce.number().int().min(7).max(365).default(30)}).safeParse(request.query);
    const days=parsed.success?parsed.data.days:30;
    const [summary,history,byProtocol,byChain,byAsset,heatmap,landscape,movers]=await Promise.all([
      db.query(`SELECT
        sum(COALESCE(tvl_usd,deposits_usd,0)) FILTER(WHERE status='active') tracked_tvl,
        sum(COALESCE(debt_usd,0)) FILTER(WHERE status='active') total_debt,
        sum(COALESCE(liquidity_usd,0)) FILTER(WHERE status='active') liquidity,
        percentile_cont(.5) WITHIN GROUP(ORDER BY ${currentRate}) FILTER(WHERE status='active' AND NOT stale AND ${currentRate} IS NOT NULL) median_yield,
        CASE WHEN sum(COALESCE(tvl_usd,deposits_usd,0)) FILTER(WHERE status='active' AND NOT stale AND ${currentRate} IS NOT NULL)>0
          THEN sum(${currentRate}*COALESCE(tvl_usd,deposits_usd,0)) FILTER(WHERE status='active' AND NOT stale AND ${currentRate} IS NOT NULL)
             /sum(COALESCE(tvl_usd,deposits_usd,0)) FILTER(WHERE status='active' AND NOT stale AND ${currentRate} IS NOT NULL)
          ELSE NULL END weighted_yield,
        max(${currentRate}) FILTER(WHERE status='active' AND NOT stale) best_yield,
        count(*) FILTER(WHERE status='active') active_markets,
        count(DISTINCT asset_id) FILTER(WHERE status='active') assets,
        count(DISTINCT protocol_id) FILTER(WHERE status='active') protocols,
        count(DISTINCT chain_id) FILTER(WHERE status='active') chains,
        max(observed_at) as_of,bool_or(stale) any_stale
      FROM mv_latest_markets`),
      db.query(`WITH points AS(
        SELECT d.bucket,m.rate_type,
          COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr) rate,
          d.borrow_apr,d.tvl_usd,d.liquidity_usd,d.utilization
        FROM cagg_market_daily d JOIN markets m ON m.id=d.market_id
        WHERE d.bucket>=now()-($1::int*interval '1 day') AND m.status='active'
      )SELECT bucket,
        percentile_cont(.5)WITHIN GROUP(ORDER BY rate)FILTER(WHERE rate IS NOT NULL) median_yield,
        CASE WHEN sum(COALESCE(tvl_usd,0))FILTER(WHERE rate IS NOT NULL)>0 THEN sum(rate*COALESCE(tvl_usd,0))FILTER(WHERE rate IS NOT NULL)/sum(COALESCE(tvl_usd,0))FILTER(WHERE rate IS NOT NULL) ELSE NULL END weighted_yield,
        percentile_cont(.5)WITHIN GROUP(ORDER BY rate)FILTER(WHERE rate_type IN('fixed','hybrid') AND rate IS NOT NULL) fixed_yield,
        percentile_cont(.5)WITHIN GROUP(ORDER BY rate)FILTER(WHERE rate_type IN('floating','hybrid') AND rate IS NOT NULL) floating_yield,
        percentile_cont(.5)WITHIN GROUP(ORDER BY borrow_apr)FILTER(WHERE borrow_apr IS NOT NULL) borrow_rate,
        sum(COALESCE(tvl_usd,0)) tvl_usd,sum(COALESCE(liquidity_usd,0)) liquidity_usd,
        avg(utilization)FILTER(WHERE utilization IS NOT NULL) utilization
      FROM points GROUP BY bucket ORDER BY bucket`,[days]),
      db.query(`SELECT protocol_id,protocol_name,sum(COALESCE(tvl_usd,deposits_usd,0)) value,count(*) markets FROM mv_latest_markets WHERE status='active' GROUP BY protocol_id,protocol_name ORDER BY value DESC LIMIT 12`),
      db.query(`SELECT chain_id,chain_name,sum(COALESCE(tvl_usd,deposits_usd,0)) value,count(*) markets FROM mv_latest_markets WHERE status='active' GROUP BY chain_id,chain_name ORDER BY value DESC LIMIT 12`),
      db.query(`SELECT asset_group,max(asset_symbol) asset_symbol,sum(COALESCE(tvl_usd,deposits_usd,0)) value,count(*) markets FROM mv_latest_markets WHERE status='active' GROUP BY asset_group ORDER BY value DESC LIMIT 12`),
      db.query(`SELECT COALESCE(asset_group,asset_symbol,asset_id) asset,protocol_id,max(protocol_name) protocol,
        percentile_cont(.5)WITHIN GROUP(ORDER BY ${currentRate})FILTER(WHERE ${currentRate} IS NOT NULL AND NOT stale) rate,
        sum(COALESCE(liquidity_usd,0)) liquidity_usd,sum(COALESCE(tvl_usd,deposits_usd,0)) tvl_usd,max(observed_at) as_of
        FROM mv_latest_markets WHERE status='active' GROUP BY COALESCE(asset_group,asset_symbol,asset_id),protocol_id ORDER BY tvl_usd DESC LIMIT 120`),
      db.query(`SELECT id,market_name,protocol_id,protocol_name,chain_id,chain_name,asset_symbol,asset_group,maturity,${currentRate} rate,liquidity_usd,tvl_usd,rate_type,observed_at
        FROM mv_latest_markets WHERE status='active' AND NOT stale AND ${currentRate} IS NOT NULL ORDER BY liquidity_usd DESC NULLS LAST LIMIT 160`),
      db.query(`WITH p7 AS(
        SELECT DISTINCT ON(market_id)market_id,rate FROM rate_snapshots WHERE observed_at<=now()-interval '7 days' AND observed_at>=now()-interval '8 days' AND rate IS NOT NULL ORDER BY market_id,observed_at DESC
      )SELECT lm.*,CASE WHEN p7.rate IS NULL OR ${currentRate} IS NULL THEN NULL ELSE (${currentRate}-p7.rate)*10000 END change_7d_bps
        FROM mv_latest_markets lm LEFT JOIN p7 ON p7.market_id=lm.id
        WHERE lm.status='active' AND NOT lm.stale AND lm.change_24h_bps IS NOT NULL
        ORDER BY abs(lm.change_24h_bps) DESC NULLS LAST LIMIT 12`)
    ]);
    const s=summary.rows[0]??{};
    return envelope(request,{
      summary:{trackedTvl:asNumber(s.tracked_tvl),totalDebt:asNumber(s.total_debt),liquidity:asNumber(s.liquidity),medianYield:asNumber(s.median_yield),weightedYield:asNumber(s.weighted_yield),bestYield:asNumber(s.best_yield),activeMarkets:Number(s.active_markets??0),assets:Number(s.assets??0),protocols:Number(s.protocols??0),chains:Number(s.chains??0)},
      history:history.rows.map(r=>({observedAt:r.bucket,medianYield:asNumber(r.median_yield),weightedYield:asNumber(r.weighted_yield),fixedYield:asNumber(r.fixed_yield),floatingYield:asNumber(r.floating_yield),borrowRate:asNumber(r.borrow_rate),tvlUsd:asNumber(r.tvl_usd),liquidityUsd:asNumber(r.liquidity_usd),utilization:asNumber(r.utilization)})),
      structure:{protocols:byProtocol.rows,chains:byChain.rows,assets:byAsset.rows},heatmap:heatmap.rows.map(r=>({...r,rate:asNumber(r.rate),liquidity_usd:asNumber(r.liquidity_usd),tvl_usd:asNumber(r.tvl_usd)})),
      landscape:landscape.rows.map(r=>({...r,rate:asNumber(r.rate),liquidity_usd:asNumber(r.liquidity_usd),tvl_usd:asNumber(r.tvl_usd)})),
      movers:movers.rows.map(r=>({...mapMarketRow(r),change7dBps:asNumber(r.change_7d_bps)}))
    },{stale:Boolean(s.any_stale),asOf:s.as_of??null});
  });

  app.get("/v1/analytics/markets",async request=>{
    const q=z.object({limit:z.coerce.number().int().min(1).max(250).default(100)}).parse(request.query);
    const result=await db.query(`WITH h AS(
      SELECT market_id,
        min(rate)FILTER(WHERE observed_at>=now()-interval '7 days') low_7d,max(rate)FILTER(WHERE observed_at>=now()-interval '7 days') high_7d,
        min(rate)FILTER(WHERE observed_at>=now()-interval '30 days') low_30d,max(rate)FILTER(WHERE observed_at>=now()-interval '30 days') high_30d,
        avg(rate)FILTER(WHERE observed_at>=now()-interval '30 days') mean_30d,
        percentile_cont(.5)WITHIN GROUP(ORDER BY rate)FILTER(WHERE observed_at>=now()-interval '30 days') median_30d,
        stddev_samp(rate)FILTER(WHERE observed_at>=now()-interval '30 days') volatility_30d,
        min(observed_at) first_observed,count(*)FILTER(WHERE observed_at>=now()-interval '30 days') observations_30d
      FROM rate_snapshots WHERE rate IS NOT NULL GROUP BY market_id
    ),p7 AS(SELECT DISTINCT ON(market_id)market_id,rate FROM rate_snapshots WHERE observed_at<=now()-interval '7 days' AND observed_at>=now()-interval '8 days' AND rate IS NOT NULL ORDER BY market_id,observed_at DESC),
      p30 AS(SELECT DISTINCT ON(market_id)market_id,rate FROM rate_snapshots WHERE observed_at<=now()-interval '30 days' AND observed_at>=now()-interval '32 days' AND rate IS NOT NULL ORDER BY market_id,observed_at DESC)
    SELECT lm.*,h.*,CASE WHEN p7.rate IS NULL OR ${currentRate} IS NULL THEN NULL ELSE (${currentRate}-p7.rate)*10000 END change_7d_bps,
      CASE WHEN p30.rate IS NULL OR ${currentRate} IS NULL THEN NULL ELSE (${currentRate}-p30.rate)*10000 END change_30d_bps,
      CASE WHEN h.observations_30d<5 OR ${currentRate} IS NULL THEN NULL ELSE(SELECT count(*)::float/NULLIF(h.observations_30d,0) FROM rate_snapshots rs WHERE rs.market_id=lm.id AND rs.observed_at>=now()-interval '30 days' AND rs.rate IS NOT NULL AND rs.rate<=${currentRate})END rate_percentile,
      CASE WHEN lm.maturity IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM(lm.maturity-now()))/86400 END days_to_maturity
    FROM mv_latest_markets lm LEFT JOIN h ON h.market_id=lm.id LEFT JOIN p7 ON p7.market_id=lm.id LEFT JOIN p30 ON p30.market_id=lm.id
    WHERE lm.status='active' ORDER BY lm.liquidity_usd DESC NULLS LAST LIMIT $1`,[q.limit]);
    const rows=result.rows.map(r=>({...mapMarketRow(r),change7dBps:asNumber(r.change_7d_bps),change30dBps:asNumber(r.change_30d_bps),low7d:asNumber(r.low_7d),high7d:asNumber(r.high_7d),low30d:asNumber(r.low_30d),high30d:asNumber(r.high_30d),mean30d:asNumber(r.mean_30d),median30d:asNumber(r.median_30d),volatility30d:asNumber(r.volatility_30d),ratePercentile:asNumber(r.rate_percentile),observations30d:Number(r.observations_30d??0),marketAgeDays:r.first_observed?Math.max(0,Math.floor((Date.now()-new Date(r.first_observed).getTime())/86400000)):null,daysToMaturity:asNumber(r.days_to_maturity)}));
    return envelope(request,rows,{stale:result.rows.some(r=>r.stale),asOf:result.rows.map(r=>r.observed_at).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/analytics/markets/:id",async(request,reply)=>{
    const{id}=z.object({id:z.string().min(1)}).parse(request.params);
    const current=await db.query(`SELECT * FROM mv_latest_markets WHERE id=$1`,[id]);
    if(!current.rowCount)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Market not found",requestId:request.id}});
    const row=current.rows[0],rate=asNumber(row.fixed_apy??row.implied_apy??row.supply_apr);
    const [stats,history,depth,basis]=await Promise.all([
      db.query(`SELECT count(*)FILTER(WHERE rate IS NOT NULL) observations,min(observed_at) first_observed,min(rate) low,max(rate) high,avg(rate) mean,percentile_cont(.5)WITHIN GROUP(ORDER BY rate)FILTER(WHERE rate IS NOT NULL) median,stddev_samp(rate)FILTER(WHERE rate IS NOT NULL) volatility,
        min(rate)FILTER(WHERE observed_at>=now()-interval '7 days') low_7d,max(rate)FILTER(WHERE observed_at>=now()-interval '7 days') high_7d,min(rate)FILTER(WHERE observed_at>=now()-interval '30 days') low_30d,max(rate)FILTER(WHERE observed_at>=now()-interval '30 days') high_30d,
        count(*)FILTER(WHERE rate IS NOT NULL AND rate<=$2 AND observed_at>=now()-interval '30 days') below_current_30d,count(*)FILTER(WHERE rate IS NOT NULL AND observed_at>=now()-interval '30 days') observations_30d
        FROM rate_snapshots WHERE market_id=$1`,[id,rate]),
      db.query(`SELECT observed_at,rate,borrow_apr,reward_apr,apr_ex_rewards,liquidity_usd,tvl_usd,utilization,stale FROM rate_snapshots WHERE market_id=$1 AND observed_at>=now()-interval '365 days' ORDER BY observed_at LIMIT 8000`,[id]),
      db.query(`SELECT DISTINCT ON(notional_usd,side)notional_usd,side,headline_apr,apr_at_amount,effective_apr,effective_apy,cost_pct,price_impact_bps,total_fee_usd,fillable,capped,locked,price_risk,assumptions,methodology_version,observed_at FROM execution_depth_snapshots WHERE market_id=$1 AND observed_at>=now()-($2::int*interval '1 second') ORDER BY notional_usd,side,observed_at DESC`,[id,env.STALE_DEPTH_SECONDS]),
      db.query(`SELECT observed_at,asset_group,horizon_days,notional_usd,fixed_market_id,floating_market_id,fixed_rate,floating_rate,basis_bps,assumptions,methodology_version FROM basis_snapshots WHERE fixed_market_id=$1 OR floating_market_id=$1 ORDER BY observed_at DESC LIMIT 500`,[id])
    ]);
    const st=stats.rows[0]??{},obs30=Number(st.observations_30d??0),below=Number(st.below_current_30d??0);
    return envelope(request,{
      market:mapMarketRow(row),
      statistics:{observations:Number(st.observations??0),low:asNumber(st.low),high:asNumber(st.high),mean:asNumber(st.mean),median:asNumber(st.median),volatility:asNumber(st.volatility),low7d:asNumber(st.low_7d),high7d:asNumber(st.high_7d),low30d:asNumber(st.low_30d),high30d:asNumber(st.high_30d),percentile30d:obs30>=5?below/obs30:null,marketAgeDays:st.first_observed?Math.max(0,Math.floor((Date.now()-new Date(st.first_observed).getTime())/86400000)):null,daysToMaturity:row.maturity?Math.max(0,(new Date(row.maturity).getTime()-Date.now())/86400000):null},
      history:history.rows.map(r=>({observedAt:r.observed_at,rate:asNumber(r.rate),borrowApr:asNumber(r.borrow_apr),rewardApr:asNumber(r.reward_apr),aprExRewards:asNumber(r.apr_ex_rewards),liquidityUsd:asNumber(r.liquidity_usd),tvlUsd:asNumber(r.tvl_usd),utilization:asNumber(r.utilization),stale:Boolean(r.stale)})),
      depth:depth.rows.map(r=>({notionalUsd:asNumber(r.notional_usd),side:r.side,headlineApr:asNumber(r.headline_apr),aprAtAmount:asNumber(r.apr_at_amount),effectiveApr:asNumber(r.effective_apr),effectiveApy:asNumber(r.effective_apy),costPct:asNumber(r.cost_pct),priceImpactBps:asNumber(r.price_impact_bps),totalFeeUsd:asNumber(r.total_fee_usd),fillable:Boolean(r.fillable),capped:Boolean(r.capped),locked:Boolean(r.locked),priceRisk:Boolean(r.price_risk),assumptions:r.assumptions??[],methodologyVersion:r.methodology_version,observedAt:r.observed_at})),
      basis:basis.rows.map(r=>({...r,fixed_rate:asNumber(r.fixed_rate),floating_rate:asNumber(r.floating_rate),basis_bps:asNumber(r.basis_bps),notional_usd:asNumber(r.notional_usd)})),
      methodologyVersion:METHODOLOGY_VERSION
    },{stale:Boolean(row.stale),asOf:row.observed_at??null});
  });

  app.get("/v1/yield-curve",async(request,reply)=>{
    const parsed=z.object({asset:z.string().default("usdc"),chain:z.string().optional(),notionalUsd:z.coerce.number().positive().default(100000)}).safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_FILTER",message:parsed.error.message,requestId:request.id}});
    const q=parsed.data,asset=await db.query(`SELECT id,asset_group,symbol FROM assets WHERE id=$1 OR lower(symbol)=lower($1) OR lower(asset_group)=lower($1) ORDER BY updated_at DESC LIMIT 1`,[q.asset]);
    if(!asset.rowCount)return envelope(request,{asset:q.asset,notionalUsd:q.notionalUsd,points:[],floatingReference:null,metrics:null,methodologyVersion:METHODOLOGY_VERSION});
    const group=asset.rows[0].asset_group??asset.rows[0].id,values:unknown[]=[group,q.notionalUsd];let chainSql="";if(q.chain){values.push(q.chain);chainSql=`AND lm.chain_id=$${values.length}`}
    const fixed=await db.query(`SELECT lm.*,d.effective_apy,d.effective_apr,d.price_impact_bps,
      (SELECT rate FROM rate_snapshots r WHERE r.market_id=lm.id AND r.observed_at<=now()-interval '1 day' ORDER BY r.observed_at DESC LIMIT 1) previous_day,
      (SELECT rate FROM rate_snapshots r WHERE r.market_id=lm.id AND r.observed_at<=now()-interval '7 days' ORDER BY r.observed_at DESC LIMIT 1) previous_week
      FROM mv_latest_markets lm LEFT JOIN LATERAL(SELECT * FROM execution_depth_snapshots x WHERE x.market_id=lm.id AND x.notional_usd<=$2 AND x.observed_at>=now()-(${env.STALE_DEPTH_SECONDS}*interval '1 second') ORDER BY abs(x.notional_usd-$2),x.observed_at DESC LIMIT 1)d ON TRUE
      WHERE lm.asset_group=$1 AND lm.status='active' AND NOT lm.stale AND lm.rate_type IN('fixed','hybrid') AND lm.maturity IS NOT NULL ${chainSql} ORDER BY lm.maturity`,values);
    const fv:unknown[]=[group];let fchain="";if(q.chain){fv.push(q.chain);fchain=`AND chain_id=$${fv.length}`}
    const floating=await db.query(`SELECT * FROM mv_latest_markets WHERE asset_group=$1 AND status='active' AND NOT stale AND rate_type IN('floating','hybrid') AND supply_apr IS NOT NULL ${fchain} ORDER BY supply_apr DESC NULLS LAST,liquidity_usd DESC NULLS LAST LIMIT 1`,fv);
    const points=fixed.rows.map(r=>{const tenor=Math.max(0,(new Date(r.maturity).getTime()-Date.now())/86400000);return{marketId:r.id,marketName:r.market_name,protocolId:r.protocol_id,protocolName:r.protocol_name,chainId:r.chain_id,chainName:r.chain_name,maturity:r.maturity,tenorDays:tenor,current:asNumber(r.effective_apy??r.effective_apr??r.fixed_apy??r.implied_apy),headline:asNumber(r.fixed_apy??r.implied_apy),previousDay:asNumber(r.previous_day),previousWeek:asNumber(r.previous_week),liquidityUsd:asNumber(r.liquidity_usd),priceImpactBps:asNumber(r.price_impact_bps)}}).filter(p=>p.current!==null);
    const sorted=[...points].sort((a,b)=>a.tenorDays-b.tenorDays),short=sorted[0]?.current??null,long=sorted.at(-1)?.current??null,spread=short!==null&&long!==null?(long-short)*10000:null;
    return envelope(request,{asset:asset.rows[0].symbol,assetGroup:group,notionalUsd:q.notionalUsd,floatingReference:floating.rowCount?{marketId:floating.rows[0].id,marketName:floating.rows[0].market_name,rate:asNumber(floating.rows[0].supply_apr)}:null,points,metrics:{shortLongSpreadBps:spread,steepnessBps:spread,inverted:spread!==null?spread<0:null,pointCount:points.length},methodologyVersion:METHODOLOGY_VERSION},{stale:fixed.rows.some(r=>r.stale),asOf:fixed.rows.map(r=>r.observed_at).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/basis-analytics",async(request,reply)=>{
    const parsed=z.object({asset:z.string().optional(),notionalUsd:z.coerce.number().positive().optional(),horizonDays:z.coerce.number().int().positive().optional(),days:z.coerce.number().int().min(1).max(365).default(90)}).safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_FILTER",message:parsed.error.message,requestId:request.id}});
    const q=parsed.data,where=["observed_at>=now()-($1::int*interval '1 day')"],values:unknown[]=[q.days];
    if(q.asset){values.push(q.asset);where.push(`lower(asset_group)=lower($${values.length})`)}if(q.notionalUsd){values.push(q.notionalUsd);where.push(`notional_usd=$${values.length}`)}if(q.horizonDays){values.push(q.horizonDays);where.push(`horizon_days=$${values.length}`)}
    const rows=await db.query(`SELECT b.*,m.maturity,m.market_name fixed_market_name,f.market_name floating_market_name FROM basis_snapshots b LEFT JOIN markets m ON m.id=b.fixed_market_id LEFT JOIN markets f ON f.id=b.floating_market_id WHERE ${where.join(" AND ")} ORDER BY b.observed_at`,values);
    const latestByKey=new Map<string,Record<string,unknown>>();for(const r of rows.rows){latestByKey.set(`${r.fixed_market_id}|${r.floating_market_id}|${r.notional_usd}|${r.horizon_days}`,r)}const latest=[...latestByKey.values()];
    const valid=latest.map(r=>asNumber(r.basis_bps)).filter((v):v is number=>v!==null),bestPositive=valid.filter(v=>v>0).sort((a,b)=>b-a)[0]??null,largestNegative=valid.filter(v=>v<0).sort((a,b)=>a-b)[0]??null,median=valid.length?[...valid].sort((a,b)=>a-b)[Math.floor(valid.length/2)]??null:null;
    return envelope(request,{metrics:{bestPositiveBasisBps:bestPositive,largestNegativeBasisBps:largestNegative,medianBasisBps:median,marketsCompared:latest.length},history:rows.rows.map(r=>({observedAt:r.observed_at,assetGroup:r.asset_group,horizonDays:Number(r.horizon_days),notionalUsd:asNumber(r.notional_usd),fixedMarketId:r.fixed_market_id,fixedMarketName:r.fixed_market_name,floatingMarketId:r.floating_market_id,floatingMarketName:r.floating_market_name,fixedRate:asNumber(r.fixed_rate),floatingRate:asNumber(r.floating_rate),basisBps:asNumber(r.basis_bps),maturity:r.maturity,assumptions:r.assumptions??[],methodologyVersion:r.methodology_version})),latest,canonicalNotionals,methodologyVersion:METHODOLOGY_VERSION},{asOf:rows.rows.at(-1)?.observed_at??null});
  });

  app.get("/v1/execution-analytics",async(request,reply)=>{
    const parsed=z.object({marketId:z.string().optional(),asset:z.string().optional(),side:z.string().optional()}).safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_FILTER",message:parsed.error.message,requestId:request.id}});const q=parsed.data,where=[`d.observed_at>=now()-(${env.STALE_DEPTH_SECONDS}*interval '1 second')`],values:unknown[]=[];
    if(q.marketId){values.push(q.marketId);where.push(`d.market_id=$${values.length}`)}if(q.asset){values.push(q.asset);where.push(`(lower(lm.asset_symbol)=lower($${values.length}) OR lower(lm.asset_group)=lower($${values.length}))`)}if(q.side){values.push(q.side);where.push(`d.side=$${values.length}`)}
    const rows=await db.query(`SELECT DISTINCT ON(d.market_id,d.side,d.notional_usd)d.*,lm.market_name,lm.asset_symbol,lm.asset_group,lm.protocol_name,lm.chain_name,lm.liquidity_usd FROM execution_depth_snapshots d JOIN mv_latest_markets lm ON lm.id=d.market_id WHERE ${where.join(" AND ")} ORDER BY d.market_id,d.side,d.notional_usd,d.observed_at DESC`,values);
    const byMarket=new Map<string,Array<Record<string,unknown>>>();for(const r of rows.rows){const list=byMarket.get(String(r.market_id))??[];list.push(r);byMarket.set(String(r.market_id),list)}
    const markets=[...byMarket.entries()].map(([marketId,items])=>{const sorted=items.sort((a,b)=>Number(a.notional_usd)-Number(b.notional_usd)),fillable=sorted.filter(r=>Boolean(r.fillable)&&!Boolean(r.capped)),capacity=fillable.length?Math.max(...fillable.map(r=>Number(r.notional_usd))):null;return{marketId,marketName:text(sorted[0]?.market_name),assetSymbol:text(sorted[0]?.asset_symbol),protocolName:text(sorted[0]?.protocol_name),chainName:text(sorted[0]?.chain_name),capacityUsd:capacity,points:sorted.map(r=>({notionalUsd:asNumber(r.notional_usd),side:r.side,headlineApr:asNumber(r.headline_apr),aprAtAmount:asNumber(r.apr_at_amount),effectiveApr:asNumber(r.effective_apr),effectiveApy:asNumber(r.effective_apy),priceImpactBps:asNumber(r.price_impact_bps),costPct:asNumber(r.cost_pct),totalFeeUsd:asNumber(r.total_fee_usd),fillable:Boolean(r.fillable),capped:Boolean(r.capped),locked:Boolean(r.locked),assumptions:r.assumptions??[],methodologyVersion:r.methodology_version,observedAt:r.observed_at}))}});
    return envelope(request,{markets,canonicalNotionals,methodologyVersion:METHODOLOGY_VERSION},{asOf:rows.rows.map(r=>r.observed_at).filter(Boolean).sort().at(-1)??null});
  });
}
