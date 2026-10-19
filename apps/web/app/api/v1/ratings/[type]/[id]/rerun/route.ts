import {NextResponse} from "next/server";
import {rateMarket,type MarketFacts} from "@tokos-data/ratings";
import {isMockForced,mockFacts} from "@/lib/mock-api";

export const runtime="nodejs";export const maxDuration=30;
const serverBase=(process.env.API_URL??process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000").replace(/\/$/,"");

/** Live what-if. Proxies to the data API when it answers; otherwise recomputes from the stored (or demonstration) inputs. */
export async function GET(req:Request,ctx:{params:Promise<{type:string;id:string}>}){
  const {type,id}=await ctx.params;const url=new URL(req.url);const q=url.searchParams;
  if(!isMockForced()){
    try{const r=await fetch(`${serverBase}/v1/ratings/${type}/${encodeURIComponent(id)}/rerun?${q}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(12000)});if(r.ok)return NextResponse.json(await r.json())}catch{}
  }
  const base=mockFacts(decodeURIComponent(id)) as MarketFacts|null;
  if(!base)return NextResponse.json({error:{code:"NOT_FOUND",message:"No rating for this entity"}},{status:404});
  const num=(k:string)=>q.get(k)==null?undefined:Number(q.get(k));
  const facts:MarketFacts={...base};
  if(num("lltv")!=null)facts.lltv=num("lltv")!;if(num("utilization")!=null)facts.utilization=num("utilization")!;
  if(num("priceImpactBps")!=null){facts.priceImpact=num("priceImpactBps")!/10000;facts.depthNotionalUsd=facts.depthNotionalUsd??100000}
  if(num("observedVol")!=null)facts.observedVol=num("observedVol")!;if(num("protocolPd")!=null)facts.protocolPd=num("protocolPd")!;if(num("oracleLagDays")!=null)facts.oracleLagDays=num("oracleLagDays")!;
  const paths=Math.min(6000,Math.max(500,num("paths")??3000));
  const out=rateMarket(facts,{paths,driverPaths:Math.min(1000,paths)});
  return NextResponse.json({data:{entity:{type,id},grade:out.grade,outlook:out.outlook,psl:out.psl,pslLow:out.pslLow,pslHigh:out.pslHigh,lgd:out.lgd,expectedLoss:out.expectedLoss,riskAdjustedApy:out.riskAdjustedApy,coverage:out.coverage,seed:out.seed,paths:out.paths,inputsHash:out.inputsHash,drivers:out.drivers,inputs:out.inputs,histogram:out.simulation.histogram,quantiles:out.simulation.quantiles,channels:out.simulation.channels,samplePaths:out.simulation.samplePaths,limitations:out.limitations,methodologyVersion:out.methodologyVersion,note:"Ephemeral recomputation; not persisted and not a rating action."},meta:{asOf:new Date().toISOString(),stale:false,requestId:"local",demo:true}});
}
