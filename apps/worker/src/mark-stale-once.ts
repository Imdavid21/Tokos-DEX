import{loadServerEnv}from"@tokos-data/config";import{closeDb}from"@tokos-data/db";import{markStale}from"./ingest.js";
const env=loadServerEnv();
try{await markStale(env);console.log(JSON.stringify({ok:true,lendingSeconds:env.STALE_LENDING_SECONDS,pendleSeconds:env.STALE_PENDLE_SECONDS}));}finally{await closeDb();}
