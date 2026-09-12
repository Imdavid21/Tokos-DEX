import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {METHODOLOGY_VERSION} from "@tokos-data/analytics";
import {dbPool} from "@tokos-data/db";
import type {ServerEnv} from "@tokos-data/config";
import {envelope,finiteOrNull,mapMarketRow} from "./lib.js";

const rateExpr="COALESCE(fixed_apy,implied_apy,supply_apr)";
const asNumber=(value:unknown)=>finiteOrNull(value);
const entityKind=z.enum(["asset","protocol","chain"]);
type EntityKind=z.infer<typeof entityKind>;

const metrics=[
  {slug:"supply-apr",name:"Supply APR",unit:"percent",source:"market_snapshots.supply_apr",formula:"Provider-reported supply APR.",frequency:"provider cadence",table:"market_snapshots",field:"supply_apr"},
  {slug:"borrow-apr",name:"Borrow APR",unit:"percent",source:"market_snapshots.borrow_apr",formula:"Provider-reported borrow APR.",frequency:"provider cadence",table:"market_snapshots",field:"borrow_apr"},
  {slug:"fixed-apy",name:"Fixed APY",unit:"percent",source:"market_snapshots.fixed_apy",formula:"Provider-reported or deterministically normalized fixed annual percentage yield.",frequency:"provider cadence",table:"market_snapshots",field:"fixed_apy"},
  {slug:"implied-apy",name:"Implied APY",unit:"percent",source:"market_snapshots.implied_apy",formula:"Provider-reported implied annual percentage yield.",frequency:"provider cadence",table:"market_snapshots",field:"implied_apy"},
  {slug:"underlying-apy",name:"Underlying APY",unit:"percent",source:"market_snapshots.underlying_apy",formula:"Provider-reported underlying annual percentage yield.",frequency:"provider cadence",table:"market_snapshots",field:"underlying_apy"},
  {slug:"reward-apr",name:"Reward APR",unit:"percent",source:"market_snapshots.reward_apr",formula:"Provider-reported rewards annual percentage rate.",frequency:"provider cadence",table:"market_snapshots",field:"reward_apr"},
  {slug:"effective-apy",name:"Effective APY",unit:"percent",source:"execution_depth_snapshots.effective_apy",formula:"Execution-adjusted annual percentage yield at the observed notional and quoted assumptions.",frequency:"quote cadence",table:"execution_depth_snapshots",field:"effective_apy"},
  {slug:"liquidity",name:"Liquidity",unit:"USD",source:"market_snapshots.liquidity_usd",formula:"Provider-reported immediately available market liquidity where supported.",frequency:"provider cadence",table:"market_snapshots",field:"liquidity_usd"},
  {slug:"tvl",name:"TVL",unit:"USD",source:"market_snapshots.tvl_usd",formula:"Provider-reported total value locked where supported.",frequency:"provider cadence",table:"market_snapshots",field:"tvl_usd"},
  {slug:"deposits",name:"Deposits",unit:"USD",source:"market_snapshots.deposits_usd",formula:"Provider-reported deposits. Never inferred from TVL changes.",frequency:"provider cadence",table:"market_snapshots",field:"deposits_usd"},
  {slug:"debt",name:"Debt",unit:"USD",source:"market_snapshots.debt_usd",formula:"Provider-reported outstanding debt.",frequency:"provider cadence",table:"market_snapshots",field:"debt_usd"},
  {slug:"utilization",name:"Utilization",unit:"ratio",source:"market_snapshots.utilization",formula:"Provider-reported or deterministic debt-to-supplied-capital utilization where source semantics support it.",frequency:"provider cadence",table:"market_snapshots",field:"utilization"},
  {slug:"basis",name:"Basis",unit:"bps",source:"basis_snapshots.basis_bps",formula:"Comparable fixed annualized rate minus floating reference rate, expressed in basis points for the same asset, notional, and horizon.",frequency:"comparison cadence",table:"basis_snapshots",field:"basis_bps"},
  {slug:"price-impact",name:"Price Impact",unit:"bps",source:"execution_depth_snapshots.price_impact_bps",formula:"Observed provider quote price impact at the stated notional.",frequency:"quote cadence",table:"execution_depth_snapshots",field:"price_impact_bps"},
  {slug:"rate-volatility",name:"Rate Volatility",unit:"percent",source:"rate_snapshots.rate",formula:"Sample standard deviation of normalized observed rates over the selected historical window. Returned only with sufficient observations.",frequency:"derived on read",table:"rate_snapshots",field:"rate"},
  {slug:"rate-percentile",name:"Rate Percentile",unit:"percentile",source:"rate_snapshots.rate",formula:"Fraction of valid historical observations at or below the current normalized rate over the selected window. Returned only with sufficient observations.",frequency:"derived on read",table:"rate_snapshots",field:"rate"}
] as const;

function entityColumn(kind:EntityKind){return kind==="asset"?"asset_id":kind==="protocol"?"protocol_id":"chain_id"}
async function resolveEntity(db:ReturnType<typeof dbPool>,kind:EntityKind,id:string){
  if(kind==="asset"){
    const r=await db.query("SELECT id,symbol label,name,asset_group FROM assets WHERE id=$1 OR lower(symbol)=lower($1) OR lower(asset_group)=lower($1) LIMIT 1",[id]);
    return r.rows[0]??null;
  }
  if(kind==="protocol"){
    const r=await db.query("SELECT id,name label,name,slug FROM protocols WHERE id=$1 OR slug=$1 LIMIT 1",[id]);
    return r.rows[0]??null;
  }
  const r=await db.query("SELECT id,name label,name,slug FROM chains WHERE id=$1 OR slug=$1 LIMIT 1",[id]);
  return r.rows[0]??null;
}
function entityListSql(kind:EntityKind){
  if(kind==="asset")return `SELECT asset_id id,max(asset_symbol) label,max(asset_name) name,count(*)FILTER(WHERE status='active') markets,count(DISTINCT protocol_id) protocols,count(DISTINCT chain_id) chains,percentile_cont(.5)WITHIN GROUP(ORDER BY ${rateExpr})FILTER(WHERE status='active'AND ${rateExpr} IS NOT NULL) median_rate,max(${rateExpr})FILTER(WHERE status='active'AND NOT stale) best_rate,sum(COALESCE(deposits_usd,tvl_usd,0))FILTER(WHERE status='active') deposits_usd,sum(COALESCE(liquidity_usd,0))FILTER(WHERE status='active') liquidity_usd,max(observed_at) as_of FROM mv_latest_markets GROUP BY asset_id ORDER BY deposits_usd DESC NULLS LAST`;
  if(kind==="protocol")return `SELECT protocol_id id,max(protocol_name) label,max(protocol_name) name,count(*)FILTER(WHERE status='active') markets,count(DISTINCT asset_id) assets,count(DISTINCT chain_id) chains,percentile_cont(.5)WITHIN GROUP(ORDER BY ${rateExpr})FILTER(WHERE status='active'AND ${rateExpr} IS NOT NULL) median_rate,max(${rateExpr})FILTER(WHERE status='active'AND NOT stale) best_rate,sum(COALESCE(deposits_usd,tvl_usd,0))FILTER(WHERE status='active') deposits_usd,sum(COALESCE(debt_usd,0))FILTER(WHERE status='active') debt_usd,sum(COALESCE(liquidity_usd,0))FILTER(WHERE status='active') liquidity_usd,avg(utilization)FILTER(WHERE status='active'AND utilization IS NOT NULL) utilization,max(observed_at) as_of FROM mv_latest_markets GROUP BY protocol_id ORDER BY deposits_usd DESC NULLS LAST`;
  return `SELECT chain_id id,max(chain_name) label,max(chain_name) name,count(*)FILTER(WHERE status='active') markets,count(DISTINCT asset_id) assets,count(DISTINCT protocol_id) protocols,percentile_cont(.5)WITHIN GROUP(ORDER BY ${rateExpr})FILTER(WHERE status='active'AND ${rateExpr} IS NOT NULL) median_rate,max(${rateExpr})FILTER(WHERE status='active'AND NOT stale) best_rate,sum(COALESCE(deposits_usd,tvl_usd,0))FILTER(WHERE status='active') deposits_usd,sum(COALESCE(debt_usd,0))FILTER(WHERE status='active') debt_usd,sum(COALESCE(liquidity_usd,0))FILTER(WHERE status='active') liquidity_usd,avg(utilization)FILTER(WHERE status='active'AND utilization IS NOT NULL) utilization,max(observed_at) as_of FROM mv_latest_markets GROUP BY chain_id ORDER BY deposits_usd DESC NULLS LAST`;
}

export async function registerIntelligenceRoutes(app:FastifyInstance,env:ServerEnv){
  const db=dbPool(env.DATABASE_URL);

  app.get("/v1/analytics/entities/:kind",async(request,reply)=>{
    const parsed=z.object({kind:entityKind}).safeParse(request.params);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_ENTITY_KIND",message:"Unsupported entity kind",requestId:request.id}});
    const r=await db.query(entityListSql(parsed.data.kind));
    return envelope(request,{kind:parsed.data.kind,rows:r.rows.map(x=>({...x,markets:Number(x.markets??0),assets:x.assets==null?undefined:Number(x.assets),protocols:x.protocols==null?undefined:Number(x.protocols),chains:x.chains==null?undefined:Number(x.chains),medianRate:asNumber(x.median_rate),bestRate:asNumber(x.best_rate),depositsUsd:asNumber(x.deposits_usd),debtUsd:asNumber(x.debt_usd),liquidityUsd:asNumber(x.liquidity_usd),utilization:asNumber(x.utilization)}))},{asOf:r.rows.map(x=>x.as_of).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/analytics/entities/:kind/:id",async(request,reply)=>{
    const parsed=z.object({kind:entityKind,id:z.string().min(1)}).safeParse(request.params);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_ENTITY",message:"Invalid entity request",requestId:request.id}});
    const {kind,id}=parsed.data,entity=await resolveEntity(db,kind,id);
    if(!entity)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Entity not found",requestId:request.id}});
    const col=entityColumn(kind),entityId=String(entity.id);
    const [summary,markets,history,byProtocol,byChain,byAsset,distribution,landscape]=await Promise.all([
      db.query(`SELECT count(*)FILTER(WHERE status='active') market_count,count(DISTINCT protocol_id)FILTER(WHERE status='active') protocol_count,count(DISTINCT chain_id)FILTER(WHERE status='active') chain_count,count(DISTINCT asset_id)FILTER(WHERE status='active') asset_count,sum(COALESCE(deposits_usd,tvl_usd,0))FILTER(WHERE status='active') deposits_usd,sum(COALESCE(debt_usd,0))FILTER(WHERE status='active') debt_usd,sum(COALESCE(liquidity_usd,0))FILTER(WHERE status='active') liquidity_usd,percentile_cont(.5)WITHIN GROUP(ORDER BY ${rateExpr})FILTER(WHERE status='active'AND ${rateExpr} IS NOT NULL) median_rate,max(${rateExpr})FILTER(WHERE status='active'AND NOT stale) best_rate,avg(utilization)FILTER(WHERE status='active'AND utilization IS NOT NULL) utilization,count(*)FILTER(WHERE status='active'AND rate_type IN('fixed','hybrid')) fixed_markets,count(*)FILTER(WHERE status='active'AND rate_type IN('floating','hybrid')) floating_markets,max(observed_at) as_of,bool_or(stale) any_stale FROM mv_latest_markets WHERE ${col}=$1`,[entityId]),
      db.query(`SELECT * FROM mv_latest_markets WHERE ${col}=$1 AND status='active' ORDER BY liquidity_usd DESC NULLS LAST LIMIT 150`,[entityId]),
      db.query(`SELECT d.bucket,percentile_cont(.5)WITHIN GROUP(ORDER BY COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr))FILTER(WHERE COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr)IS NOT NULL) rate,percentile_cont(.5)WITHIN GROUP(ORDER BY COALESCE(d.fixed_apy,d.implied_apy))FILTER(WHERE m.rate_type IN('fixed','hybrid')AND COALESCE(d.fixed_apy,d.implied_apy)IS NOT NULL) fixed_rate,percentile_cont(.5)WITHIN GROUP(ORDER BY d.supply_apr)FILTER(WHERE m.rate_type IN('floating','hybrid')AND d.supply_apr IS NOT NULL) floating_rate,avg(d.borrow_apr)FILTER(WHERE d.borrow_apr IS NOT NULL) borrow_rate,sum(COALESCE(d.tvl_usd,0)) tvl_usd,sum(COALESCE(d.liquidity_usd,0)) liquidity_usd,avg(d.utilization)FILTER(WHERE d.utilization IS NOT NULL) utilization FROM cagg_market_daily d JOIN markets m ON m.id=d.market_id WHERE m.${col}=$1 AND d.bucket>=now()-interval '365 days' GROUP BY d.bucket ORDER BY d.bucket`,[entityId]),
      db.query(`SELECT protocol_id key,max(protocol_name) label,sum(COALESCE(deposits_usd,tvl_usd,0)) value,count(*) markets FROM mv_latest_markets WHERE ${col}=$1 AND status='active' GROUP BY protocol_id ORDER BY value DESC NULLS LAST`,[entityId]),
      db.query(`SELECT chain_id key,max(chain_name) label,sum(COALESCE(deposits_usd,tvl_usd,0)) value,count(*) markets FROM mv_latest_markets WHERE ${col}=$1 AND status='active' GROUP BY chain_id ORDER BY value DESC NULLS LAST`,[entityId]),
      db.query(`SELECT asset_id key,max(asset_symbol) label,sum(COALESCE(deposits_usd,tvl_usd,0)) value,count(*) markets FROM mv_latest_markets WHERE ${col}=$1 AND status='active' GROUP BY asset_id ORDER BY value DESC NULLS LAST`,[entityId]),
      db.query(`SELECT rs.rate FROM rate_snapshots rs JOIN markets m ON m.id=rs.market_id WHERE m.${col}=$1 AND rs.rate IS NOT NULL AND rs.observed_at>=now()-interval '90 days' ORDER BY rs.observed_at DESC LIMIT 5000`,[entityId]),
      db.query(`SELECT id,market_name,protocol_id,protocol_name,chain_id,chain_name,asset_id,asset_symbol,maturity,${rateExpr} rate,liquidity_usd,tvl_usd,rate_type,observed_at FROM mv_latest_markets WHERE ${col}=$1 AND status='active'AND NOT stale AND ${rateExpr} IS NOT NULL ORDER BY liquidity_usd DESC NULLS LAST LIMIT 160`,[entityId])
    ]);
    const s=summary.rows[0]??{};
    return envelope(request,{
      kind,entity:{...entity,id:entityId},
      summary:{marketCount:Number(s.market_count??0),protocolCount:Number(s.protocol_count??0),chainCount:Number(s.chain_count??0),assetCount:Number(s.asset_count??0),depositsUsd:asNumber(s.deposits_usd),debtUsd:asNumber(s.debt_usd),liquidityUsd:asNumber(s.liquidity_usd),medianRate:asNumber(s.median_rate),bestRate:asNumber(s.best_rate),utilization:asNumber(s.utilization),fixedMarkets:Number(s.fixed_markets??0),floatingMarkets:Number(s.floating_markets??0)},
      history:history.rows.map(x=>({observedAt:x.bucket,rate:asNumber(x.rate),fixedRate:asNumber(x.fixed_rate),floatingRate:asNumber(x.floating_rate),borrowRate:asNumber(x.borrow_rate),tvlUsd:asNumber(x.tvl_usd),liquidityUsd:asNumber(x.liquidity_usd),utilization:asNumber(x.utilization)})),
      breakdowns:{protocols:byProtocol.rows.map(x=>({...x,value:asNumber(x.value),markets:Number(x.markets??0)})),chains:byChain.rows.map(x=>({...x,value:asNumber(x.value),markets:Number(x.markets??0)})),assets:byAsset.rows.map(x=>({...x,value:asNumber(x.value),markets:Number(x.markets??0)}))},
      distribution:distribution.rows.map(x=>asNumber(x.rate)).filter((x):x is number=>x!==null),
      landscape:landscape.rows.map(x=>({...x,rate:asNumber(x.rate),liquidity_usd:asNumber(x.liquidity_usd),tvl_usd:asNumber(x.tvl_usd)})),
      markets:markets.rows.map(mapMarketRow),methodologyVersion:METHODOLOGY_VERSION
    },{stale:Boolean(s.any_stale),asOf:s.as_of??null});
  });

  app.get("/v1/analytics/compare",async(request,reply)=>{
    const parsed=z.object({marketIds:z.string().min(1),days:z.coerce.number().int().min(7).max(365).default(90)}).safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_COMPARE",message:"Invalid comparison",requestId:request.id}});
    const ids=[...new Set(parsed.data.marketIds.split(",").filter(Boolean))];
    if(ids.length<2||ids.length>6)return reply.code(400).send({error:{code:"INVALID_COMPARE",message:"Compare requires 2 to 6 markets",requestId:request.id}});
    const [current,history]=await Promise.all([
      db.query(`SELECT lm.*,d.effective_apy,d.effective_apr,d.price_impact_bps,d.notional_usd depth_notional FROM mv_latest_markets lm LEFT JOIN LATERAL(SELECT effective_apy,effective_apr,price_impact_bps,notional_usd FROM execution_depth_snapshots x WHERE x.market_id=lm.id AND x.observed_at>=now()-($2::int*interval '1 second') ORDER BY x.observed_at DESC,x.notional_usd DESC LIMIT 1)d ON TRUE WHERE lm.id=ANY($1::text[])`,[ids,env.STALE_DEPTH_SECONDS]),
      db.query(`SELECT d.market_id,d.bucket observed_at,COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr) rate,d.liquidity_usd,d.tvl_usd,d.utilization FROM cagg_market_daily d WHERE d.market_id=ANY($1::text[])AND d.bucket>=now()-($2::int*interval '1 day') ORDER BY d.bucket`,[ids,parsed.data.days])
    ]);
    return envelope(request,{markets:current.rows.map(x=>({...mapMarketRow(x),effectiveRate:asNumber(x.effective_apy??x.effective_apr),priceImpactBps:asNumber(x.price_impact_bps),depthNotionalUsd:asNumber(x.depth_notional)})),history:history.rows.map(x=>({marketId:x.market_id,observedAt:x.observed_at,rate:asNumber(x.rate),liquidityUsd:asNumber(x.liquidity_usd),tvlUsd:asNumber(x.tvl_usd),utilization:asNumber(x.utilization)})),methodologyVersion:METHODOLOGY_VERSION},{stale:current.rows.some(x=>x.stale),asOf:current.rows.map(x=>x.observed_at).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/analytics/correlations",async(request,reply)=>{
    const parsed=z.object({dimension:z.enum(["market","protocol","asset"]).default("market"),days:z.coerce.number().int().min(14).max(365).default(90),limit:z.coerce.number().int().min(2).max(20).default(10)}).safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_CORRELATION",message:"Invalid correlation parameters",requestId:request.id}});
    const {dimension,days,limit}=parsed.data;
    const cfg=dimension==="market"?{key:"m.id",label:"m.market_name",currentKey:"id",currentLabel:"market_name"}:dimension==="protocol"?{key:"m.protocol_id",label:"p.name",currentKey:"protocol_id",currentLabel:"protocol_name"}:{key:"m.asset_id",label:"a.symbol",currentKey:"asset_id",currentLabel:"asset_symbol"};
    const joins=dimension==="protocol"?"JOIN protocols p ON p.id=m.protocol_id":dimension==="asset"?"JOIN assets a ON a.id=m.asset_id":"";
    const sql=`WITH top AS(SELECT ${cfg.currentKey} key,max(${cfg.currentLabel}) label,sum(COALESCE(liquidity_usd,0)) liquidity FROM mv_latest_markets WHERE status='active'AND NOT stale GROUP BY ${cfg.currentKey} ORDER BY liquidity DESC NULLS LAST LIMIT $2),series AS(SELECT d.bucket::date bucket,${cfg.key} key,max(${cfg.label}) label,percentile_cont(.5)WITHIN GROUP(ORDER BY COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr))FILTER(WHERE COALESCE(d.fixed_apy,d.implied_apy,d.supply_apr)IS NOT NULL) rate FROM cagg_market_daily d JOIN markets m ON m.id=d.market_id ${joins} JOIN top t ON t.key=${cfg.key} WHERE d.bucket>=now()-($1::int*interval '1 day') GROUP BY d.bucket::date,${cfg.key}),pairs AS(SELECT x.key x_key,y.key y_key,max(x.label) x_label,max(y.label) y_label,corr(x.rate,y.rate) coefficient,count(*) samples,min(x.bucket) sample_from,max(x.bucket) sample_to FROM series x JOIN series y ON x.bucket=y.bucket AND x.key<=y.key WHERE x.rate IS NOT NULL AND y.rate IS NOT NULL GROUP BY x.key,y.key HAVING count(*)>=7)SELECT * FROM pairs ORDER BY x_key,y_key`;
    const r=await db.query(sql,[days,limit]);
    const labels=[...new Map(r.rows.flatMap(x=>[[String(x.x_key),String(x.x_label)],[String(x.y_key),String(x.y_label)]])).entries()].map(([key,label])=>({key,label}));
    return envelope(request,{dimension,days,labels,pairs:r.rows.map(x=>({xKey:String(x.x_key),yKey:String(x.y_key),xLabel:String(x.x_label),yLabel:String(x.y_label),coefficient:asNumber(x.coefficient),samples:Number(x.samples??0),sampleFrom:x.sample_from,sampleTo:x.sample_to}))},{asOf:r.rows.map(x=>x.sample_to).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/metrics",async request=>envelope(request,metrics.map(({table,field,...m})=>m),{asOf:new Date().toISOString()}));
  app.get("/v1/metrics/:slug",async(request,reply)=>{
    const {slug}=z.object({slug:z.string()}).parse(request.params),metric=metrics.find(x=>x.slug===slug);
    if(!metric)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Metric not found",requestId:request.id}});
    const r=await db.query(`SELECT min(observed_at) first_observation,max(observed_at) latest_observation,count(*)FILTER(WHERE ${metric.field} IS NOT NULL) observations FROM ${metric.table}`);
    const x=r.rows[0]??{};
    return envelope(request,{...metric,methodologyVersion:METHODOLOGY_VERSION,availableHistory:{firstObservation:x.first_observation??null,latestObservation:x.latest_observation??null,observations:Number(x.observations??0)}},{asOf:x.latest_observation??null});
  });

  app.get("/v1/datasets/:slug.csv",async(request,reply)=>{
    const {slug}=z.object({slug:z.string()}).parse(request.params);
    const tables:Record<string,string>={markets:"markets",market_snapshots:"market_snapshots",rate_snapshots:"rate_snapshots",execution_depth:"execution_depth_snapshots",basis:"basis_snapshots",assets:"assets",protocols:"protocols",chains:"chains"};
    const table=tables[slug];if(!table)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Dataset not found",requestId:request.id}});
    const order=["market_snapshots","rate_snapshots","execution_depth_snapshots","basis_snapshots"].includes(table)?" ORDER BY observed_at DESC":"";
    const r=await db.query(`SELECT * FROM ${table}${order} LIMIT 50000`),columns=r.fields.map(f=>f.name),escape=(v:unknown)=>{if(v==null)return"";const s=typeof v==="object"?JSON.stringify(v):String(v);return /[\",\n]/.test(s)?`\"${s.replaceAll("\"","\"\"")}\"`:s};
    const csv=[columns.join(","),...r.rows.map(row=>columns.map(c=>escape(row[c])).join(","))].join("\n");
    reply.header("content-type","text/csv; charset=utf-8").header("content-disposition",`attachment; filename=tokos-${slug}.csv`);return reply.send(csv);
  });
}
