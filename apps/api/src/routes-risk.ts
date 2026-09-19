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
