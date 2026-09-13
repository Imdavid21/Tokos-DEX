import{loadServerEnv}from"@tokos-data/config";import{backfillPendleHistory,ingestOneDeltaComparables,ingestOneDeltaLatest,ingestPendleMarkets,ingestPendleDepth,markStale,services}from"./ingest.js";import{ingestOneDeltaDepthBounded}from"./safe-depth.js";
const env=loadServerEnv();
type Task={name:string;every:number;run:()=>Promise<unknown>;running:boolean};
const tasks:Task[]=[
 {name:"onedelta-latest",every:900000,run:()=>ingestOneDeltaLatest(env),running:false},
 {name:"pendle-markets",every:300000,run:()=>ingestPendleMarkets(env),running:false},
 {name:"onedelta-depth",every:3600000,run:()=>ingestOneDeltaDepthBounded(env,100000,60),running:false},
 {name:"onedelta-comparables",every:3600000,run:()=>ingestOneDeltaComparables(env),running:false},
 {name:"stale-monitor",every:60000,run:()=>markStale(env),running:false},
 {name:"pendle-history",every:86400000,run:()=>backfillPendleHistory(env),running:false},
 {name:"pendle-depth",every:7200000,run:()=>ingestPendleDepth(env),running:false},
 {name:"storage-prune",every:86400000,run:()=>services(env).repo.pruneProviderObservations(),running:false}
];
async function execute(task:Task){if(task.running)return;task.running=true;const started=Date.now();console.log(JSON.stringify({level:"info",job:task.name,event:"started"}));try{const result=await task.run();console.log(JSON.stringify({level:"info",job:task.name,event:"completed",durationMs:Date.now()-started,result}))}catch(error){console.error(JSON.stringify({level:"error",job:task.name,event:"failed",durationMs:Date.now()-started,error:error instanceof Error?error.message:String(error)}))}finally{task.running=false}}
async function bootstrap(){for(const name of["pendle-markets","pendle-history","onedelta-comparables","stale-monitor","storage-prune"]){const task=tasks.find(x=>x.name===name);if(task)await execute(task)}}
console.log(JSON.stringify({level:"info",event:"direct-scheduler-ready",tasks:tasks.map(t=>({name:t.name,every:t.every}))}));
void bootstrap().finally(()=>{for(const task of tasks)setInterval(()=>void execute(task),task.every).unref()});
process.on("SIGTERM",()=>process.exit(0));process.on("SIGINT",()=>process.exit(0));
await new Promise(()=>{});
