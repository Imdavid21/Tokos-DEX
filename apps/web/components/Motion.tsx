"use client";
import {useEffect,useRef,useState} from "react";
/** Reveals children when they scroll into view. `index` staggers siblings. */
export function Reveal({children,index=0,as:Tag="div",className=""}:{children:React.ReactNode;index?:number;as?:"div"|"section"|"tr";className?:string}){
  const ref=useRef<HTMLElement>(null);const [on,setOn]=useState(false);
  useEffect(()=>{const el=ref.current;if(!el)return;const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){setOn(true);io.disconnect()}},{rootMargin:"0px 0px -6% 0px"});io.observe(el);const t=setTimeout(()=>{setOn(true);io.disconnect()},1800);return()=>{io.disconnect();clearTimeout(t)}},[]);
  const T=Tag as unknown as "div";
  return <T ref={ref as React.RefObject<HTMLDivElement>} className={`reveal ${on?"in":""} ${className}`} style={{"--i":index} as React.CSSProperties}>{children}</T>;
}
/** Counts a formatted number up from zero on mount. */
function fmt(kind:"int"|"usd",v:number){if(kind==="int")return Math.round(v).toLocaleString();const a=Math.abs(v);if(a>=1e9)return `$${(v/1e9).toFixed(a>=1e10?1:2)}B`;if(a>=1e6)return `$${(v/1e6).toFixed(a>=1e7?1:2)}M`;if(a>=1e3)return `$${(v/1e3).toFixed(1)}K`;return `$${v.toFixed(0)}`}
export function CountUp({value,kind="int",duration=900}:{value:number;kind?:"int"|"usd";duration?:number}){
  const [v,setV]=useState(0);
  useEffect(()=>{const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;let raf=0;const t0=performance.now();const tick=(t:number)=>{const p=reduced?1:Math.min(1,(t-t0)/duration);setV(value*(1-Math.pow(1-p,3)));if(p<1)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[value,duration]);
  return <>{fmt(kind,v)}</>;
}
