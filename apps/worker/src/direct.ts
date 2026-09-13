import{loadServerEnv}from"@tokos-data/config";import{backfillPendleHistory,ingestOneDeltaComparables,ingestOneDeltaLatest,ingestPendleMarkets,ingestPendleDepth,markStale,services}from"./ingest.js";import{ingestOneDeltaDepthBounded}from"./safe-depth.js";import{ingestCrossProviderBasis}from"./cross-basis.js";import{refreshHistoricalRollups}from"./rollups.js";import{probeApiReadiness}from"./readiness-probe.js";
const env=loadServerEnv();
type Task={name:string;every:number;run:()=>Promise<unknown>;running:boolean};
const tasks:Task[]=[
 {name:"onedelta-latest",every:900000,run:()=>ingestOneDeltaLatest(env),running:false},
 {name:"pendle-markets",every:300000,run:()=>ingestPendleMarkets(env),running:false},
 {name:"onedelta-depth",every:3600000,run:()=>ingestOneDeltaDepthBounded(env,100000,60),running:false},
 {name:"onedelta-comparables",every:3600000,run:()=>ingestOneDeltaComparables(env),running:false},
 {name:"cross-basis",every:3600000,run:()=>ingestCrossProviderBasis(env),running:false},
 {name:"stale-monitor",every:60000,run:()=>markStale(env),running:false},
 {name:"pendle-history",every:86400000,run:()=>backfillPendleHistory(env),running:false},
 {name:"rollup-refresh",every:86400000,run:()=>refreshHistoricalRollups(env),running:false},
 {name:"pendle-depth",every:7200000,run:()=>ingestPendleDepth(env),running:false},
 {name:"storage-prune",every:86400000,run:()=>services(env).repo.pruneProviderObservations(),running:false}
];
async function execute(task:Task){if(task.running)return;task.running=true;const started=Date.now();console.log(JSON.stringify({level:"info",job:task.name,event:"started"}));try{const result=await task.run();console.log(JSON.stringify({level:"info",job:task.name,event:"completed",durationMs:Date.now()-started,result}))}catch(error){console.error(JSON.stringify({level:"error",job:task.name,event:"failed",durationMs:Date.now()-started,error:error instanceof Error?error.message:String(error)}))}finally{task.running=false}}
async function logReadiness(stage:string){try{const{repo}=services(env),r=await repo.pool.query(`SELECT (SELECT count(*) FROM mv_latest_markets WHERE status='active') active_markets,(SELECT count(*) FROM mv_latest_markets WHERE provider='pendle' AND status='active' AND implied_apy IS NOT NULL) pendle_fixed_markets,(SELECT count(*) FROM market_snapshots) market_snapshots,(SELECT count(*) FROM rate_snapshots) rate_snapshots,(SELECT count(*) FROM execution_depth_snapshots) execution_depth_points,(SELECT count(*) FROM basis_snapshots) basis_points,(SELECT count(*) FROM assets) assets,(SELECT count(*) FROM protocols) protocols,(SELECT count(*) FROM chains) chains`),x=r.rows[0]??{};console.log(JSON.stringify({level:"info",event:"data-readiness",stage,...Object.fromEntries(Object.entries(x).map(([k,v])=>[k,Number(v)]))}))}catch(error){console.error(JSON.stringify({level:"error",event:"data-readiness-failed",stage,error:error instanceof Error?error.message:String(error)}))}}
async function bootstrap(){for(const name of["pendle-markets","pendle-history","rollup-refresh","onedelta-comparables","stale-monitor","storage-prune"]){const task=tasks.find(x=>x.name===name);if(task)await execute(task)}}
console.log(JSON.stringify({level:"info",event:"direct-scheduler-ready",tasks:tasks.map(t=>({name:t.name,every:t.every}))}));
void bootstrap().then(async()=>{for(const task of tasks)setInterval(()=>void execute(task),task.every);await logReadiness("bootstrap");const latest=tasks.find(x=>x.name==="onedelta-latest");if(latest)await execute(latest);const depth=tasks.find(x=>x.name==="onedelta-depth");if(depth)await execute(depth);const basis=tasks.find(x=>x.name==="cross-basis");if(basis)await execute(basis);await logReadiness("lending-refresh");await probeApiReadiness()});
process.on("SIGTERM",()=>process.exit(0));process.on("SIGINT",()=>process.exit(0));
