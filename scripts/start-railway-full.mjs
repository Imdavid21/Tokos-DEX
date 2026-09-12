import {spawn} from "node:child_process";

function run(command,args,{required=true}={}){
  const child=spawn(command,args,{stdio:"inherit",env:process.env});
  if(required)child.on("error",error=>{console.error(error);process.exit(1)});
  return child;
}

async function wait(child,label){
  const code=await new Promise(resolve=>child.once("exit",resolve));
  if(code!==0)throw new Error(`${label} exited with code ${code}`);
}

if(!process.env.DATABASE_URL){
  console.error("DATABASE_URL is required for the full Railway runtime");
  process.exit(1);
}

await wait(run("pnpm",["db:migrate"]),"database migration");

const children=[
  run("pnpm",["--filter","@tokos-data/api","start"]),
  run("pnpm",["--filter","@tokos-data/worker","start:direct"]),
  run("pnpm",["--filter","@tokos-data/web","exec","next","start","-p",process.env.PORT||"3000"])
];

let stopping=false;
function stop(signal){
  if(stopping)return;stopping=true;
  for(const child of children)if(!child.killed)child.kill(signal);
}
process.on("SIGTERM",()=>stop("SIGTERM"));
process.on("SIGINT",()=>stop("SIGINT"));

for(const child of children){
  child.once("exit",code=>{
    if(stopping)return;
    console.error(`runtime child exited with code ${code}`);
    stop("SIGTERM");
    process.exit(code??1);
  });
}

await new Promise(()=>{});
