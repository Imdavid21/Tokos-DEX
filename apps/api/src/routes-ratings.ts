import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {dbPool} from "@tokos-data/db";
import type {ServerEnv} from "@tokos-data/config";
import {BANDS,GRADES,INVESTMENT_GRADE,LOSS_THRESHOLD,METHODOLOGY_VERSION,rateMarket,type MarketFacts} from "@tokos-data/ratings";
import {decodeCursor,encodeCursor,envelope,finiteOrNull} from "./lib.js";

const asRecord=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const SORTS:Record<string,string>={riskAdjustedApy:"r.risk_adjusted_apy DESC NULLS LAST",psl:"r.psl ASC",grade:"r.psl ASC",apy:"r.supply_apy DESC NULLS LAST",supply:"COALESCE(lm.deposits_usd,lm.tvl_usd) DESC NULLS LAST",liquidity:"lm.liquidity_usd DESC NULLS LAST",expectedLoss:"r.expected_loss ASC",updated:"r.computed_at DESC"};
const listQuery=z.object({grades:z.string().optional(),outlook:z.enum(["stable","positive","negative","watch"]).optional(),protocol:z.string().optional(),chains:z.string().optional(),asset:z.string().optional(),investmentGrade:z.coerce.boolean().optional(),minSupplyUsd:z.coerce.number().nonnegative().optional(),maxPsl:z.coerce.number().min(0).max(1).optional(),sort:z.string().default("riskAdjustedApy"),order:z.enum(["asc","desc"]).optional(),limit:z.coerce.number().int().min(1).max(500).default(100),cursor:z.string().optional(),q:z.string().trim().optional()});

const BASE_SELECT=`
  SELECT r.entity_type,r.entity_id,r.run_id,r.methodology_version,r.grade,r.outlook,r.psl,r.psl_low,r.psl_high,r.lgd,r.expected_loss,r.supply_apy,r.risk_adjusted_apy,r.coverage,r.top_driver,r.computed_at,
    lm.market_name,lm.provider,lm.protocol_id,lm.protocol_name,lm.protocol_slug,lm.chain_id,lm.chain_name,lm.chain_slug,lm.asset_id,lm.asset_symbol,lm.asset_group,lm.market_type,lm.rate_type,lm.maturity,
    COALESCE(lm.deposits_usd,lm.tvl_usd) supply_usd,lm.liquidity_usd,lm.utilization,lm.stale,lm.observed_at
  FROM ratings_latest r JOIN mv_latest_markets lm ON lm.id=r.entity_id AND r.entity_type='market'`;

export function mapRating(r:Record<string,unknown>){
  return{entityType:String(r.entity_type),entityId:String(r.entity_id),runId:r.run_id==null?null:String(r.run_id),methodologyVersion:String(r.methodology_version),grade:String(r.grade),outlook:String(r.outlook),
    psl:finiteOrNull(r.psl),pslLow:finiteOrNull(r.psl_low),pslHigh:finiteOrNull(r.psl_high),lgd:finiteOrNull(r.lgd),expectedLoss:finiteOrNull(r.expected_loss),supplyApy:finiteOrNull(r.supply_apy),riskAdjustedApy:finiteOrNull(r.risk_adjusted_apy),coverage:finiteOrNull(r.coverage),topDriver:r.top_driver==null?null:String(r.top_driver),computedAt:r.computed_at==null?null:new Date(String(r.computed_at)).toISOString(),
    market:{id:String(r.entity_id),name:r.market_name==null?null:String(r.market_name),provider:r.provider==null?null:String(r.provider),protocolId:r.protocol_id==null?null:String(r.protocol_id),protocolName:r.protocol_name==null?null:String(r.protocol_name),protocolSlug:r.protocol_slug==null?null:String(r.protocol_slug),chainId:r.chain_id==null?null:String(r.chain_id),chainName:r.chain_name==null?null:String(r.chain_name),chainSlug:r.chain_slug==null?null:String(r.chain_slug),assetId:r.asset_id==null?null:String(r.asset_id),assetSymbol:r.asset_symbol==null?null:String(r.asset_symbol),assetGroup:r.asset_group==null?null:String(r.asset_group),marketType:r.market_type==null?null:String(r.market_type),rateType:r.rate_type==null?null:String(r.rate_type),maturity:r.maturity==null?null:new Date(String(r.maturity)).toISOString(),supplyUsd:finiteOrNull(r.supply_usd),liquidityUsd:finiteOrNull(r.liquidity_usd),utilization:finiteOrNull(r.utilization),stale:Boolean(r.stale),observedAt:r.observed_at==null?null:new Date(String(r.observed_at)).toISOString()}};
}

export async function registerRatingRoutes(app:FastifyInstance,env:ServerEnv){
  const db=dbPool(env.DATABASE_URL);

  app.get("/v1/ratings/scale",async request=>envelope(request,{methodologyVersion:METHODOLOGY_VERSION,lossThreshold:LOSS_THRESHOLD,horizonDays:365,investmentGrade:INVESTMENT_GRADE,bands:BANDS.map((b,i)=>({grade:b.grade,label:b.label,lowerPsl:i===0?0:BANDS[i-1]!.maxPsl,upperPsl:Number.isFinite(b.maxPsl)?b.maxPsl:null}))}));

  app.get("/v1/ratings/summary",async request=>{
    const [dist,actions,meta]=await Promise.all([
      db.query(`SELECT r.grade,count(*)::int markets,sum(COALESCE(lm.deposits_usd,lm.tvl_usd,0))::float supply_usd,avg(r.psl)::float avg_psl,avg(r.risk_adjusted_apy)::float avg_radj FROM ratings_latest r JOIN mv_latest_markets lm ON lm.id=r.entity_id WHERE r.entity_type='market' GROUP BY r.grade`),
      db.query(`SELECT action,count(*)::int n FROM rating_actions WHERE observed_at>=now()-interval '30 days' GROUP BY action`),
      db.query(`SELECT count(*)::int rated,count(*) FILTER(WHERE grade<>'NR')::int graded,max(computed_at) as_of,count(DISTINCT lm.protocol_id)::int protocols,count(DISTINCT lm.chain_id)::int chains,count(DISTINCT lm.asset_id)::int assets,sum(COALESCE(lm.deposits_usd,lm.tvl_usd,0))::float rated_supply_usd,count(*) FILTER(WHERE outlook='watch' OR outlook='negative')::int watch FROM ratings_latest r JOIN mv_latest_markets lm ON lm.id=r.entity_id WHERE r.entity_type='market'`)
    ]);
    const byGrade=new Map(dist.rows.map(r=>[r.grade,r]));
    const distribution=[...GRADES,"NR"].map(g=>{const r=byGrade.get(g);return{grade:g,markets:r?Number(r.markets):0,supplyUsd:r?finiteOrNull(r.supply_usd):0,avgPsl:r?finiteOrNull(r.avg_psl):null,avgRiskAdjustedApy:r?finiteOrNull(r.avg_radj):null}});
    const m=meta.rows[0]??{};
    return envelope(request,{methodologyVersion:METHODOLOGY_VERSION,rated:Number(m.rated??0),graded:Number(m.graded??0),protocols:Number(m.protocols??0),chains:Number(m.chains??0),assets:Number(m.assets??0),ratedSupplyUsd:finiteOrNull(m.rated_supply_usd),watch:Number(m.watch??0),distribution,actions30d:Object.fromEntries(actions.rows.map(r=>[r.action,Number(r.n)]))},{asOf:m.as_of??null});
  });

  app.get("/v1/ratings",async(request,reply)=>{
    const parsed=listQuery.safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_FILTER",message:parsed.error.message,requestId:request.id}});
    const q=parsed.data,where=["r.entity_type='market'"],values:unknown[]=[];
    const add=(sql:string,value:unknown)=>{values.push(value);where.push(sql.replace("?",`$${values.length}`))};
    if(q.grades)add("r.grade=ANY(?::text[])",q.grades.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean));
    if(q.investmentGrade)add("r.grade=ANY(?::text[])",[...INVESTMENT_GRADE]);
    if(q.outlook)add("r.outlook=?",q.outlook);
    if(q.protocol){values.push(q.protocol,q.protocol);where.push(`(lm.protocol_id=$${values.length-1} OR lm.protocol_slug=$${values.length})`)}
    if(q.chains)add("lm.chain_id=ANY(?::text[])",q.chains.split(","));
    if(q.asset){values.push(q.asset,q.asset);where.push(`(lm.asset_id=$${values.length-1} OR lower(lm.asset_symbol)=lower($${values.length}))`)}
    if(q.minSupplyUsd!==undefined)add("COALESCE(lm.deposits_usd,lm.tvl_usd,0)>=?",q.minSupplyUsd);
    if(q.maxPsl!==undefined)add("r.psl<=?",q.maxPsl);
    if(q.q){values.push(`%${q.q}%`);where.push(`(lm.market_name ILIKE $${values.length} OR lm.asset_symbol ILIKE $${values.length} OR lm.protocol_name ILIKE $${values.length})`)}
    let order=SORTS[q.sort]??SORTS.riskAdjustedApy!;
    if(q.order)order=order.replace(/ (ASC|DESC)/,` ${q.order.toUpperCase()}`);
    const offset=decodeCursor<{offset:number}>(q.cursor)?.offset??0;values.push(q.limit+1,offset);
    const result=await db.query(`${BASE_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order}, r.entity_id ASC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
    const more=result.rows.length>q.limit,rows=result.rows.slice(0,q.limit);
    return envelope(request,rows.map(mapRating),{stale:rows.some(r=>r.stale),asOf:rows.map(r=>r.computed_at).filter(Boolean).sort().at(-1)??null,nextCursor:more?encodeCursor({offset:offset+q.limit}):null,hasMore:more});
  });

  app.get("/v1/ratings/actions",async(request,reply)=>{
    const parsed=z.object({limit:z.coerce.number().int().min(1).max(500).default(50),action:z.string().optional(),days:z.coerce.number().int().min(1).max(365).default(90)}).safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_FILTER",message:parsed.error.message,requestId:request.id}});
    const q=parsed.data,values:unknown[]=[q.days,q.limit];let actionSql="";
    if(q.action){values.push(q.action.split(","));actionSql=`AND a.action=ANY($${values.length}::text[])`}
    const rows=await db.query(`SELECT a.id,a.entity_type,a.entity_id,a.action,a.from_grade,a.to_grade,a.from_psl,a.to_psl,a.from_outlook,a.to_outlook,a.notches,a.reason,a.run_id,a.methodology_version,a.observed_at,lm.market_name,lm.asset_symbol,lm.protocol_name,lm.chain_name,COALESCE(lm.deposits_usd,lm.tvl_usd) supply_usd FROM rating_actions a LEFT JOIN mv_latest_markets lm ON lm.id=a.entity_id WHERE a.observed_at>=now()-($1||' days')::interval ${actionSql} ORDER BY a.observed_at DESC,abs(a.notches) DESC LIMIT $2`,values);
    return envelope(request,rows.rows.map(r=>({id:r.id,entityType:r.entity_type,entityId:r.entity_id,action:r.action,fromGrade:r.from_grade,toGrade:r.to_grade,fromPsl:finiteOrNull(r.from_psl),toPsl:finiteOrNull(r.to_psl),fromOutlook:r.from_outlook,toOutlook:r.to_outlook,notches:Number(r.notches),reason:r.reason,runId:r.run_id,methodologyVersion:r.methodology_version,observedAt:new Date(r.observed_at).toISOString(),market:{name:r.market_name,assetSymbol:r.asset_symbol,protocolName:r.protocol_name,chainName:r.chain_name,supplyUsd:finiteOrNull(r.supply_usd)}})),{asOf:rows.rows[0]?.observed_at?new Date(rows.rows[0].observed_at).toISOString():null});
  });

  app.get("/v1/ratings/frontier",async request=>{
    const rows=await db.query(`${BASE_SELECT} WHERE r.grade<>'NR' AND r.supply_apy IS NOT NULL ORDER BY r.risk_adjusted_apy DESC NULLS LAST LIMIT 1500`);
    return envelope(request,rows.rows.map(r=>({id:r.entity_id,name:r.market_name,assetSymbol:r.asset_symbol,protocolName:r.protocol_name,chainName:r.chain_name,grade:r.grade,psl:finiteOrNull(r.psl),supplyApy:finiteOrNull(r.supply_apy),expectedLoss:finiteOrNull(r.expected_loss),riskAdjustedApy:finiteOrNull(r.risk_adjusted_apy),supplyUsd:finiteOrNull(r.supply_usd)})));
  });

  app.get("/v1/ratings/export.csv",async(request,reply)=>{
    const rows=await db.query(`${BASE_SELECT} ORDER BY r.psl ASC, r.entity_id LIMIT 50000`);
    const cols=["entity_id","market_name","asset_symbol","protocol_name","chain_name","grade","outlook","psl","psl_low","psl_high","lgd","expected_loss","supply_apy","risk_adjusted_apy","coverage","top_driver","supply_usd","liquidity_usd","utilization","methodology_version","computed_at"];
    const escape=(v:unknown)=>{const t=v==null?"":v instanceof Date?v.toISOString():String(v);return/[",\n]/.test(t)?`"${t.replaceAll('"','""')}"`:t};
    const csv=[cols.join(","),...rows.rows.map(r=>cols.map(c=>escape(r[c])).join(","))].join("\n");
    return reply.header("content-type","text/csv; charset=utf-8").header("content-disposition",'attachment; filename="indenture-ratings.csv"').send(csv);
  });

  app.get("/v1/ratings/:type/:id",async(request,reply)=>{
    const parsed=z.object({type:z.enum(["market"]),id:z.string().min(1)}).safeParse(request.params);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_ENTITY",message:"Invalid rating entity",requestId:request.id}});
    const {type,id}=parsed.data;
    const latest=await db.query(`${BASE_SELECT} WHERE r.entity_type=$1 AND r.entity_id=$2`,[type,id]);
    if(!latest.rowCount)return reply.code(404).send({error:{code:"NOT_FOUND",message:"No rating for this entity",requestId:request.id}});
    const row=latest.rows[0];
    const [run,history,actions,dependencies]=await Promise.all([
      db.query(`SELECT id,seed,paths,inputs_hash,inputs,drivers,simulation,limitations,duration_ms,computed_at FROM rating_runs WHERE id=$1`,[row.run_id]),
      db.query(`SELECT computed_at,grade,outlook,psl,psl_low,psl_high,expected_loss,risk_adjusted_apy,coverage FROM rating_runs WHERE entity_type=$1 AND entity_id=$2 ORDER BY computed_at DESC LIMIT 400`,[type,id]),
      db.query(`SELECT id,action,from_grade,to_grade,from_psl,to_psl,from_outlook,to_outlook,notches,reason,observed_at FROM rating_actions WHERE entity_type=$1 AND entity_id=$2 ORDER BY observed_at DESC LIMIT 100`,[type,id]),
      db.query(`SELECT DISTINCT ON(relationship,target_type,target_id) relationship,target_type,target_id,exposure_usd,weight FROM entity_dependencies WHERE source_type=$1 AND source_id=$2 ORDER BY relationship,target_type,target_id,observed_at DESC`,[type,id])
    ]);
    const r=run.rows[0]??{};
    return envelope(request,{...mapRating(row),run:{id:r.id??null,seed:r.seed==null?null:String(r.seed),paths:r.paths==null?null:Number(r.paths),inputsHash:r.inputs_hash??null,durationMs:r.duration_ms==null?null:Number(r.duration_ms),inputs:r.inputs??null,drivers:r.drivers??[],simulation:r.simulation??null,limitations:r.limitations??[]},
      history:history.rows.map(h=>({computedAt:new Date(h.computed_at).toISOString(),grade:h.grade,outlook:h.outlook,psl:finiteOrNull(h.psl),pslLow:finiteOrNull(h.psl_low),pslHigh:finiteOrNull(h.psl_high),expectedLoss:finiteOrNull(h.expected_loss),riskAdjustedApy:finiteOrNull(h.risk_adjusted_apy),coverage:finiteOrNull(h.coverage)})).reverse(),
      actions:actions.rows.map(a=>({id:a.id,action:a.action,fromGrade:a.from_grade,toGrade:a.to_grade,fromPsl:finiteOrNull(a.from_psl),toPsl:finiteOrNull(a.to_psl),fromOutlook:a.from_outlook,toOutlook:a.to_outlook,notches:Number(a.notches),reason:a.reason,observedAt:new Date(a.observed_at).toISOString()})),
      dependencies:dependencies.rows.map(d=>({relationship:d.relationship,targetType:d.target_type,targetId:d.target_id,exposureUsd:finiteOrNull(d.exposure_usd),weight:finiteOrNull(d.weight)}))},
      {stale:Boolean(row.stale),asOf:row.computed_at?new Date(row.computed_at).toISOString():null});
  });

  /** Reproduce a stored run or re-rate with overridden inputs. Pure compute, no persistence. */
  app.get("/v1/ratings/:type/:id/rerun",async(request,reply)=>{
    const parsed=z.object({type:z.enum(["market"]),id:z.string().min(1),paths:z.coerce.number().int().min(500).max(20000).default(5000),lltv:z.coerce.number().min(0.05).max(0.99).optional(),utilization:z.coerce.number().min(0).max(1).optional(),priceImpactBps:z.coerce.number().min(0).max(5000).optional(),observedVol:z.coerce.number().min(0).max(5).optional(),protocolPd:z.coerce.number().min(0).max(1).optional(),oracleLagDays:z.coerce.number().min(0).max(30).optional()}).safeParse({...asRecord(request.params),...asRecord(request.query)});
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_INPUT",message:parsed.error.message,requestId:request.id}});
    const q=parsed.data;
    const latest=await db.query(`SELECT r.run_id,x.inputs,x.seed FROM ratings_latest r JOIN rating_runs x ON x.id=r.run_id WHERE r.entity_type=$1 AND r.entity_id=$2`,[q.type,q.id]);
    if(!latest.rowCount)return reply.code(404).send({error:{code:"NOT_FOUND",message:"No rating for this entity",requestId:request.id}});
    const stored=asRecord(latest.rows[0].inputs);const facts={...asRecord(stored.facts)} as unknown as MarketFacts;
    if(q.lltv!==undefined)facts.lltv=q.lltv;if(q.utilization!==undefined)facts.utilization=q.utilization;if(q.priceImpactBps!==undefined){facts.priceImpact=q.priceImpactBps/10000;facts.depthNotionalUsd=facts.depthNotionalUsd??100000}if(q.observedVol!==undefined)facts.observedVol=q.observedVol;if(q.protocolPd!==undefined)facts.protocolPd=q.protocolPd;if(q.oracleLagDays!==undefined)facts.oracleLagDays=q.oracleLagDays;
    const out=rateMarket(facts,{paths:q.paths,driverPaths:Math.min(2000,q.paths)});
    return envelope(request,{entity:{type:q.type,id:q.id},overrides:{lltv:q.lltv??null,utilization:q.utilization??null,priceImpactBps:q.priceImpactBps??null,observedVol:q.observedVol??null,protocolPd:q.protocolPd??null,oracleLagDays:q.oracleLagDays??null},grade:out.grade,outlook:out.outlook,psl:out.psl,pslLow:out.pslLow,pslHigh:out.pslHigh,lgd:out.lgd,expectedLoss:out.expectedLoss,riskAdjustedApy:out.riskAdjustedApy,coverage:out.coverage,seed:out.seed,paths:out.paths,inputsHash:out.inputsHash,drivers:out.drivers,inputs:out.inputs,histogram:out.simulation.histogram,quantiles:out.simulation.quantiles,channels:out.simulation.channels,samplePaths:out.simulation.samplePaths,limitations:out.limitations,methodologyVersion:out.methodologyVersion,note:"Ephemeral recomputation; not persisted and not a rating action."});
  });
}
