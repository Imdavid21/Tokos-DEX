import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {dbPool} from "@tokos-data/db";
import type {ServerEnv} from "@tokos-data/config";
import {envelope,finiteOrNull} from "./lib.js";

const entityType=z.enum(["asset","market","protocol","chain","vault","curator","oracle","issuer","bridge","liquidity_venue"]);
const riskEntityType=z.enum(["asset","market","protocol","chain","vault","curator"]);

export async function registerRiskRoutes(app:FastifyInstance,env:ServerEnv){
  const db=dbPool(env.DATABASE_URL);


  app.get("/v1/risk/markets",async(request,reply)=>{
    const parsed=z.object({limit:z.coerce.number().int().min(1).max(250).default(100)}).safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_FILTER",message:"Invalid risk filter",requestId:request.id}});
    const rows=await db.query(`
      WITH latest AS(
        SELECT DISTINCT ON(entity_id,dimension,metric_key) entity_id,dimension,metric_key,value,unit,severity,confidence,observed_at,stale
        FROM risk_observations WHERE entity_type='market'
        ORDER BY entity_id,dimension,metric_key,observed_at DESC
      )
      SELECT lm.id,lm.market_name,lm.asset_symbol,lm.protocol_name,lm.chain_name,lm.liquidity_usd,
        COALESCE(lm.supply_apr,lm.fixed_apy,lm.implied_apy) rate,
        jsonb_agg(jsonb_build_object('dimension',r.dimension,'metricKey',r.metric_key,'value',r.value,'unit',r.unit,'severity',r.severity,'confidence',r.confidence,'observedAt',r.observed_at))
          FILTER(WHERE r.entity_id IS NOT NULL) observations,
        max(r.observed_at) risk_as_of,bool_or(COALESCE(r.stale,false)) risk_stale
      FROM mv_latest_markets lm LEFT JOIN latest r ON r.entity_id=lm.id
      WHERE lm.status='active'
      GROUP BY lm.id,lm.market_name,lm.asset_symbol,lm.protocol_name,lm.chain_name,lm.liquidity_usd,lm.supply_apr,lm.fixed_apy,lm.implied_apy
      ORDER BY count(r.entity_id) DESC,lm.liquidity_usd DESC NULLS LAST LIMIT $1
    `,[parsed.data.limit]);
    return envelope(request,rows.rows.map(r=>({...r,liquidity_usd:finiteOrNull(r.liquidity_usd),rate:finiteOrNull(r.rate),observations:r.observations??[]})),
      {stale:rows.rows.some(r=>r.risk_stale),asOf:rows.rows.map(r=>r.risk_as_of).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/risk/entities/:type/:id",async(request,reply)=>{
    const parsed=z.object({type:riskEntityType,id:z.string().min(1)}).safeParse(request.params);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_ENTITY",message:"Invalid risk entity",requestId:request.id}});
    const {type,id}=parsed.data;
    const rows=await db.query(`
      SELECT DISTINCT ON(dimension,metric_key)
        dimension,metric_key,value,unit,direction,severity,confidence,source,source_observed_at,observed_at,
        methodology_version,assumptions,stale,metadata
      FROM risk_observations
      WHERE entity_type=$1 AND entity_id=$2
      ORDER BY dimension,metric_key,observed_at DESC
    `,[type,id]);
    const history=await db.query(`
      SELECT dimension,metric_key,value,unit,severity,confidence,source,source_observed_at,observed_at,
        methodology_version,stale
      FROM risk_observations
      WHERE entity_type=$1 AND entity_id=$2
      ORDER BY observed_at DESC
      LIMIT 1000
    `,[type,id]);
    return envelope(request,{
      entity:{type,id},
      observations:rows.rows.map(r=>({...r,value:finiteOrNull(r.value),confidence:finiteOrNull(r.confidence)})),
      history:history.rows.map(r=>({...r,value:finiteOrNull(r.value),confidence:finiteOrNull(r.confidence)}))
    },{stale:rows.rows.some(r=>r.stale),asOf:rows.rows.map(r=>r.observed_at).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/dependencies/:type/:id",async(request,reply)=>{
    const parsed=z.object({type:entityType,id:z.string().min(1)}).safeParse(request.params);
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_ENTITY",message:"Invalid dependency entity",requestId:request.id}});
    const {type,id}=parsed.data;
    const [outgoing,incoming]=await Promise.all([
      db.query(`
        SELECT DISTINCT ON(relationship,target_type,target_id)
          source_type,source_id,relationship,target_type,target_id,exposure_usd,weight,source,
          methodology_version,observed_at,ingested_at,stale,metadata
        FROM entity_dependencies
        WHERE source_type=$1 AND source_id=$2
        ORDER BY relationship,target_type,target_id,observed_at DESC
      `,[type,id]),
      db.query(`
        SELECT DISTINCT ON(relationship,source_type,source_id)
          source_type,source_id,relationship,target_type,target_id,exposure_usd,weight,source,
          methodology_version,observed_at,ingested_at,stale,metadata
        FROM entity_dependencies
        WHERE target_type=$1 AND target_id=$2
        ORDER BY relationship,source_type,source_id,observed_at DESC
      `,[type,id])
    ]);
    const map=(r:Record<string,unknown>)=>({...r,exposure_usd:finiteOrNull(r.exposure_usd),weight:finiteOrNull(r.weight)});
    const all=[...outgoing.rows,...incoming.rows];
    return envelope(request,{entity:{type,id},outgoing:outgoing.rows.map(map),incoming:incoming.rows.map(map)},
      {stale:all.some(r=>r.stale),asOf:all.map(r=>r.observed_at).filter(Boolean).sort().at(-1)??null});
  });


  app.get("/v1/risk/entities/:type/:id/changes",async(request,reply)=>{
    const parsed=z.object({type:riskEntityType,id:z.string().min(1),days:z.coerce.number().int().min(1).max(365).default(90)}).safeParse({...request.params,...request.query});
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_ENTITY",message:"Invalid risk history request",requestId:request.id}});
    const {type,id,days}=parsed.data;
    const rows=await db.query(`
      WITH x AS(SELECT dimension,metric_key,value,unit,severity,observed_at,
        lag(value) OVER(PARTITION BY dimension,metric_key ORDER BY observed_at) previous_value,
        lag(severity) OVER(PARTITION BY dimension,metric_key ORDER BY observed_at) previous_severity
        FROM risk_observations WHERE entity_type=$1 AND entity_id=$2 AND observed_at>=now()-($3||' days')::interval)
      SELECT *,(value-previous_value) delta FROM x
      WHERE previous_value IS NOT NULL AND (value IS DISTINCT FROM previous_value OR severity IS DISTINCT FROM previous_severity)
      ORDER BY observed_at DESC LIMIT 500
    `,[type,id,days]);
    return envelope(request,rows.rows.map(r=>({...r,value:finiteOrNull(r.value),previous_value:finiteOrNull(r.previous_value),delta:finiteOrNull(r.delta)})));
  });

  app.get("/v1/dependencies/:type/:id/graph",async(request,reply)=>{
    const parsed=z.object({type:entityType,id:z.string().min(1),depth:z.coerce.number().int().min(1).max(3).default(2)}).safeParse({...request.params,...request.query});
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_ENTITY",message:"Invalid dependency graph request",requestId:request.id}});
    const {type,id,depth}=parsed.data;
    const rows=await db.query(`
      WITH RECURSIVE g AS(
        SELECT source_type,source_id,relationship,target_type,target_id,exposure_usd,weight,observed_at,1 level
        FROM entity_dependencies WHERE source_type=$1 AND source_id=$2
        UNION ALL
        SELECT d.source_type,d.source_id,d.relationship,d.target_type,d.target_id,d.exposure_usd,d.weight,d.observed_at,g.level+1
        FROM entity_dependencies d JOIN g ON d.source_type=g.target_type AND d.source_id=g.target_id WHERE g.level<$3
      ) SELECT DISTINCT ON(source_type,source_id,relationship,target_type,target_id)
        source_type,source_id,relationship,target_type,target_id,exposure_usd,weight,observed_at,level
        FROM g ORDER BY source_type,source_id,relationship,target_type,target_id,observed_at DESC
    `,[type,id,depth]);
    return envelope(request,{root:{type,id},edges:rows.rows.map(r=>({...r,exposure_usd:finiteOrNull(r.exposure_usd),weight:finiteOrNull(r.weight)}))});
  });

  app.get("/v1/risk/markets/:id/scenario",async(request,reply)=>{
    const parsed=z.object({id:z.string().min(1),rateShockBps:z.coerce.number().min(-5000).max(5000).default(-200),liquidityShockPct:z.coerce.number().min(-.99).max(10).default(-.5),utilizationShock:z.coerce.number().min(-1).max(1).default(.1),notionalUsd:z.coerce.number().positive().default(100000),horizonDays:z.coerce.number().int().min(1).max(3650).default(30)}).safeParse({...request.params,...request.query});
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_SCENARIO",message:"Invalid scenario inputs",requestId:request.id}});
    const q=parsed.data,row=await db.query(`SELECT id,market_name,COALESCE(fixed_apy,implied_apy,supply_apr) rate,liquidity_usd,utilization FROM mv_latest_markets WHERE id=$1`,[q.id]);
    if(!row.rowCount)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Market not found",requestId:request.id}});
    const m=row.rows[0],rate=finiteOrNull(m.rate),liq=finiteOrNull(m.liquidity_usd),util=finiteOrNull(m.utilization);
    const shockedRate=rate==null?null:rate+q.rateShockBps/10000,shockedLiquidity=liq==null?null:Math.max(0,liq*(1+q.liquidityShockPct)),shockedUtilization=util==null?null:Math.max(0,Math.min(1,util+q.utilizationShock));
    const capacity=shockedLiquidity==null?null:Math.min(1,shockedLiquidity/q.notionalUsd);
    return envelope(request,{market:{id:m.id,name:m.market_name},inputs:q,baseline:{rate,liquidityUsd:liq,utilization:util},stressed:{rate:shockedRate,liquidityUsd:shockedLiquidity,utilization:shockedUtilization,notionalCapacity:capacity},methodologyVersion:"scenario-v1",probability:null,note:"Deterministic stress scenario; not a probability forecast."});
  });

  app.get("/v1/risk/markets/:id/adjusted-yield",async(request,reply)=>{
    const parsed=z.object({id:z.string().min(1),horizonDays:z.coerce.number().int().min(1).max(3650).default(30),notionalUsd:z.coerce.number().positive().default(100000)}).safeParse({...request.params,...request.query});
    if(!parsed.success)return reply.code(400).send({error:{code:"INVALID_INPUT",message:"Invalid adjusted-yield inputs",requestId:request.id}});
    const q=parsed.data,row=await db.query(`SELECT id,market_name,COALESCE(fixed_apy,implied_apy,supply_apr) headline_rate FROM mv_latest_markets WHERE id=$1`,[q.id]);
    if(!row.rowCount)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Market not found",requestId:request.id}});
    const x=await db.query(`SELECT cost_pct,price_impact_bps,fee_usd,observed_at FROM execution_depth_snapshots WHERE market_id=$1 AND notional_usd<=$2 ORDER BY observed_at DESC,notional_usd DESC LIMIT 1`,[q.id,q.notionalUsd]);
    const headline=finiteOrNull(row.rows[0].headline_rate),cost=x.rowCount?finiteOrNull(x.rows[0].cost_pct):null;
    const annualizedCost=cost==null?null:cost*365/q.horizonDays,adjusted=headline==null||annualizedCost==null?null:headline-annualizedCost;
    return envelope(request,{market:{id:q.id,name:row.rows[0].market_name},headlineYield:headline,executionCostPct:cost,annualizedExecutionCost:annualizedCost,adjustedYield:adjusted,expectedCreditLoss:null,methodologyVersion:"adjusted-yield-v1",availability:adjusted==null?"unavailable":"available",note:"Credit loss remains unavailable until defensible loss inputs exist."});
  });

  app.get("/v1/risk/entities",async request=>{
    const rows=await db.query(`WITH latest AS(SELECT DISTINCT ON(entity_type,entity_id,dimension,metric_key) * FROM risk_observations ORDER BY entity_type,entity_id,dimension,metric_key,observed_at DESC)
      SELECT entity_type,entity_id,count(*) observations,max(observed_at) as_of,jsonb_agg(jsonb_build_object('dimension',dimension,'metricKey',metric_key,'value',value,'unit',unit,'severity',severity)) metrics FROM latest GROUP BY entity_type,entity_id ORDER BY entity_type,entity_id LIMIT 2000`);
    return envelope(request,rows.rows);
  });

  app.get("/v1/methodologies",async request=>{
    const rows=await db.query("SELECT slug,name,version,scope,description,formula,inputs,limitations,updated_at FROM methodology_registry ORDER BY scope,name");
    return envelope(request,rows.rows,{asOf:rows.rows.map(r=>r.updated_at).filter(Boolean).sort().at(-1)??null});
  });

  app.get("/v1/methodologies/:slug",async(request,reply)=>{
    const {slug}=z.object({slug:z.string().min(1)}).parse(request.params);
    const row=await db.query("SELECT slug,name,version,scope,description,formula,inputs,limitations,updated_at FROM methodology_registry WHERE slug=$1",[slug]);
    if(!row.rowCount)return reply.code(404).send({error:{code:"NOT_FOUND",message:"Methodology not found",requestId:request.id}});
    return envelope(request,row.rows[0],{asOf:row.rows[0].updated_at});
  });
}
