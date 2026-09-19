import{dbPool}from"@tokos-data/db";import type{ServerEnv}from"@tokos-data/config";

export async function enforceRiskRetention(env:ServerEnv){
 const pool=dbPool(env.DATABASE_URL);
 try{
  const results:Record<string,number>={};
  const queries:[string,string][]=[
   ["providerPayloads",`UPDATE provider_observations SET payload=NULL WHERE payload IS NOT NULL AND ingested_at<now()-interval '24 hours'`],
   ["providerRows",`DELETE FROM provider_observations WHERE ingested_at<now()-interval '14 days'`],
   ["executionDepth",`DELETE FROM execution_depth_snapshots WHERE observed_at<now()-interval '30 days'`],
   ["basis",`DELETE FROM basis_snapshots WHERE observed_at<now()-interval '90 days'`],
   ["marketRaw",`DELETE FROM market_snapshots WHERE observed_at<now()-interval '14 days'`],
   ["riskRaw",`DELETE FROM risk_observations WHERE observed_at<now()-interval '180 days'`],
   ["dependencyRaw",`DELETE FROM entity_dependencies WHERE observed_at<now()-interval '90 days'`]
  ];
  for(const[name,sql]of queries){const r=await pool.query(sql);results[name]=r.rowCount??0}
  return results;
 }finally{await pool.end()}
}
