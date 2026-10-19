"use client";
import {useEffect,useRef,useState} from "react";
import {api} from "@/lib/api";
import {gradeClass,psl,signedPct} from "@/lib/ratings";

type Base={lltv:number;utilization:number;priceImpactBps:number;oracleLagDays:number;protocolPd:number;observedVol:number};
type Result={grade:string;outlook:string;psl:number;pslLow:number;pslHigh:number;expectedLoss:number;riskAdjustedApy:number|null;coverage:number;paths:number;drivers:Array<{label:string;share:number}>};

function Slider({label,value,baseValue,min,max,step,fmt,onChange}:{label:string;value:number;baseValue:number;min:number;max:number;step:number;fmt:(x:number)=>string;onChange:(x:number)=>void}){
  return <label>{label}<input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/><output>{fmt(value)}{value!==baseValue?<span className="subtle"> (was {fmt(baseValue)})</span>:null}</output></label>
}

export function WhatIf({marketId,base}:{marketId:string;base:Base}){
  const [v,setV]=useState<Base>(base);
  const [res,setRes]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState<string|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const dirty=JSON.stringify(v)!==JSON.stringify(base);
  useEffect(()=>{if(!dirty)return;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(async()=>{setBusy(true);setErr(null);try{const q=new URLSearchParams({paths:"3000",lltv:String(v.lltv),utilization:String(v.utilization),priceImpactBps:String(v.priceImpactBps),oracleLagDays:String(v.oracleLagDays),protocolPd:String(v.protocolPd),observedVol:String(v.observedVol)});const r=await api<Result>(`/ratings/market/${encodeURIComponent(marketId)}/rerun?${q}`);setRes(r.data)}catch(e){setErr(e instanceof Error?e.message:"Failed")}finally{setBusy(false)}},450);return()=>{if(timer.current)clearTimeout(timer.current)}},[v,dirty,marketId]);
  const slider=(k:keyof Base,label:string,min:number,max:number,step:number,fmt:(x:number)=>string)=><Slider key={k} label={label} value={v[k]} baseValue={base[k]} min={min} max={max} step={step} fmt={fmt} onChange={x=>setV(prev=>({...prev,[k]:x}))}/>;
  return <div className="panel"><div className="panel-body">
    <div className="whatif">
      {slider("lltv","Liquidation LTV",0.3,0.98,0.005,x=>`${(x*100).toFixed(1)}%`)}
      {slider("utilization","Utilization",0,1,0.01,x=>`${(x*100).toFixed(0)}%`)}
      {slider("priceImpactBps","Price impact at depth notional",0,1000,1,x=>`${x} bp`)}
      {slider("observedVol","Collateral / loan ratio volatility",0.005,2,0.005,x=>`${(x*100).toFixed(1)}% ann.`)}
      {slider("oracleLagDays","Oracle lag",0,3,0.05,x=>`${x.toFixed(2)} d`)}
      {slider("protocolPd","Protocol loss probability",0,0.05,0.0005,x=>`${(x*100).toFixed(2)}% / yr`)}
    </div>
    <div style={{display:"flex",gap:10,marginTop:14,alignItems:"center"}}><button className="btn" type="button" onClick={()=>{setV(base);setRes(null);setErr(null)}} disabled={!dirty}>Reset to stored inputs</button><span className="subtle">{busy?"Simulating 3,000 paths…":err?err:dirty?"Live recomputation":"Move a slider to re-rate"}</span></div>
    {res&&dirty&&<div className="whatif-result"><div><span className="label">Grade</span><strong><span className={`grade ${gradeClass(res.grade)}`} style={{height:30,fontSize:14}}>{res.grade}</span></strong></div><div><span className="label">PSL</span><strong>{psl(res.psl)}</strong><span className="subtle">{psl(res.pslLow)} to {psl(res.pslHigh)}</span></div><div><span className="label">Expected loss</span><strong>{(res.expectedLoss*1e4).toFixed(0)} bp</strong></div><div><span className="label">Net yield</span><strong>{signedPct(res.riskAdjustedApy)}</strong><span className="subtle">top driver {res.drivers[0]?.label??"—"}</span></div></div>}
  </div></div>
}
