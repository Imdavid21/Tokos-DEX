"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {BANDS} from "@/lib/ratings";

type P={id:string;name:string|null;protocolName:string|null;grade:string;psl:number|null;supplyApy:number|null;riskAdjustedApy:number|null;supplyUsd:number|null};
const LO=0.0005,HI=1;const lx=(v:number)=>(Math.log10(Math.max(LO,Math.min(HI,v)))-Math.log10(LO))/(Math.log10(HI)-Math.log10(LO));
const SIGNAL=new Set(["CCC","CC","C","D"]),WEAK=new Set(["BB","B"]);

/** Every rated market as a tick on the log PSL axis; tick height follows supply. Hover for the market, click to open it. */
export function UniverseStrip({points}:{points:P[]}){
  const router=useRouter();const [hover,setHover]=useState<{p:P;x:number;y:number}|null>(null);
  const box=useRef<HTMLDivElement>(null);const [W,setW]=useState(1000);
  useEffect(()=>{const el=box.current;if(!el)return;const ro=new ResizeObserver(([e])=>{if(e)setW(Math.max(320,Math.floor(e.contentRect.width)))});ro.observe(el);return()=>ro.disconnect()},[]);
  const H=150,top=22,base=108;const narrow=W<560;
  const ticks=useMemo(()=>{const max=Math.log10(Math.max(1e6,...points.map(p=>p.supplyUsd??1e6)));const min=Math.log10(1e6);return points.filter(p=>p.psl!=null).map(p=>{const s=Math.log10(Math.max(1e6,p.supplyUsd??1e6));const hgt=18+((s-min)/Math.max(0.01,max-min))*(base-top-18);return{p,x:lx(p.psl!)*W,h:hgt}})},[points,W]);
  return <div className="strip" ref={box} onMouseLeave={()=>setHover(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="xMinYMin meet" role="img" aria-label="Rated markets placed on the annual loss probability axis">
      {BANDS.map((b,i)=>{const x0=lx(Math.max(LO,b.lower))*W,x1=lx(b.upper??HI)*W;const dark=SIGNAL.has(b.grade);return <g key={b.grade}><rect x={x0} y={top-6} width={Math.max(0,x1-x0)} height={base-top+6} fill={dark?"var(--ember)":"var(--text)"} opacity={dark?0.05:i%2?0.045:0.02}/><line x1={x0} x2={x0} y1={top-6} y2={base+16} stroke="var(--border)" strokeWidth={1}/>{(!narrow||["AAA","A","BB","CCC","C"].includes(b.grade))&&<text x={x0+5} y={base+28} fontSize={9} fill={dark?"var(--ember)":"var(--muted)"} fontFamily="var(--font-mono)" letterSpacing={1.2}>{b.grade}</text>}</g>})}
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--border-strong)"/>
      {[0.001,0.01,0.1,1].map(v=><text key={v} x={lx(v)*W} y={H-2} fontSize={8.5} textAnchor="middle" fill="var(--muted-2)" fontFamily="var(--font-mono)">{v*100}%</text>)}
      {ticks.map(({p,x,h},i)=>{const sig=SIGNAL.has(p.grade),weak=WEAK.has(p.grade);const active=hover?.p.id===p.id;return <g key={p.id} style={{cursor:"pointer"}} onMouseEnter={e=>{const r=(e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();void r;setHover({p,x,y:base-h})}} onClick={()=>router.push(`/ratings/market/${encodeURIComponent(p.id)}`)}><line x1={x} x2={x} y1={base} y2={base-h} stroke={sig?"var(--ember)":weak?"var(--muted)":"var(--text)"} strokeWidth={active?3:1.4} opacity={active?1:sig?.9:.65} style={{transition:"stroke-width .15s, opacity .15s",transformOrigin:`${x}px ${base}px`,animation:`grow-y .6s cubic-bezier(.2,.8,.2,1) ${Math.min(600,i*12)}ms both`}}/><rect x={x-6} y={top-6} width={12} height={base-top+6} fill="transparent"/></g>})}
    </svg>
    {hover&&<div className="strip-tip" style={{left:hover.x+18,top:hover.y+18}}><b>{hover.p.name}</b> | {hover.p.protocolName}<br/><span className="subtle">{hover.p.grade} | PSL {((hover.p.psl??0)*100).toFixed(2)}% | APY {((hover.p.supplyApy??0)*100).toFixed(2)}% | net {((hover.p.riskAdjustedApy??0)*100).toFixed(2)}%</span></div>}
  </div>
}
