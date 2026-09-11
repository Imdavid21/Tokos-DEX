import{loadServerEnv}from"@tokos-data/config";import{backfillPendleHistory,ingestOneDeltaComparables,ingestOneDeltaDepth,ingestOneDeltaLatest,ingestPendleMarkets,ingestPendleDepth,markStale}from"./ingest.js";
const env=loadServerEnv();
type Task={name:string;every:number;run:()=>Promise<unknown>;running:boolean};
const tasks:Task[]=[
 {name:"onedelta-latest",every:60000,run:()=>ingestOneDeltaLatest(env),running:false},
 {name:"pendle-markets",every:300000,run:()=>ingestPendleMarkets(env),running:false},
 {name:"onedelta-depth",every:900000,run:()=>ingestOneDeltaDepth(env,100000),running:false},
 {name:"onedelta-comparables",every:1800000,run:()=>ingestOneDeltaComparables(env),running:false},
 {name:"stale-monitor",every:60000,run:()=>markStale(env),running:false},
 {name:"pendle-history",every:3600000,run:()=>backfillPendleHistory(env),running:false},
 {name:"pendle-depth",every:1800000,run:()=>ingestPendleDepth(env),running:false}
];
async function execute(task:Task){if(task.running)return;task.running=true;const started=Date.now();try{const result=await task.run();console.log(JSON.stringify({level:"info",job:task.name,event:"completed",durationMs:Date.now()-started,result}))}catch(error){console.error(JSON.stringify({level:"error",job:task.name,event:"failed",durationMs:Date.now()-started,error:error instanceof Error?error.message:String(error)}))}finally{task.running=false}}
for(const task of tasks){setInterval(()=>void execute(task),task.every).unref()}
for(const name of["onedelta-latest","pendle-markets","stale-monitor"]){const task=tasks.find(x=>x.name===name);if(task)await execute(task)}
console.log(JSON.stringify({level:"info",event:"direct-scheduler-ready",tasks:tasks.map(t=>({name:t.name,every:t.every}))}));
process.on("SIGTERM",()=>process.exit(0));process.on("SIGINT",()=>process.exit(0));
await new Promise(()=>{});
