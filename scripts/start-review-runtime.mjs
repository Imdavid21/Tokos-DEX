import{spawn,spawnSync}from"node:child_process";
const target=process.env.TOKOS_DATA_DB_NAME??"tokos_data";
if(!process.env.ADMIN_DATABASE_URL)throw new Error("ADMIN_DATABASE_URL is required");
const targetUrl=new URL(process.env.ADMIN_DATABASE_URL);targetUrl.pathname=`/${target}`;process.env.DATABASE_URL=targetUrl.toString();
const ensure=spawnSync("pnpm",["--filter","@tokos-data/db","ensure-review-db"],{stdio:"inherit",env:process.env});if(ensure.status!==0)process.exit(ensure.status??1);
const run=spawnSync("pnpm",["db:migrate"],{stdio:"inherit",env:process.env});if(run.status!==0)process.exit(run.status??1);
const common={...process.env,NODE_ENV:"production",APP_ENV:"production",API_URL:"http://127.0.0.1:4000",NEXT_PUBLIC_API_URL:"http://127.0.0.1:4000",API_PORT:"4000"};
const children=[
 spawn("pnpm",["--filter","@tokos-data/api","start"],{stdio:"inherit",env:common}),
 spawn("pnpm",["--filter","@tokos-data/worker","start:direct"],{stdio:"inherit",env:common}),
 spawn("pnpm",["--filter","@tokos-data/web","start"],{stdio:"inherit",env:common})
];
let exiting=false;const stop=(code=0)=>{if(exiting)return;exiting=true;for(const child of children)child.kill("SIGTERM");setTimeout(()=>process.exit(code),1500).unref()};
for(const child of children)child.on("exit",code=>{if(!exiting&&code!==0)stop(code??1)});
process.on("SIGTERM",()=>stop(0));process.on("SIGINT",()=>stop(0));
