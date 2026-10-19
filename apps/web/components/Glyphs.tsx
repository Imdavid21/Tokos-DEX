"use client";
import {useEffect,useRef} from "react";

const CHARS="$%&#@=+-/\\|<>^~:;.,'`ƒ∑∆∏∫Ω√∞≈≠≤≥";
const BLOCKS="█▓▒░▌▐▀▄";

function draw(canvas:HTMLCanvasElement,seed:number,t:number,mirror:boolean){
  const ctx=canvas.getContext("2d");if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);const w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const color=getComputedStyle(document.documentElement).getPropertyValue("--text").trim()||"#fff";
  const cell=11;const cols=Math.ceil(w/cell),rows=Math.ceil(h/(cell*1.3));
  ctx.font=`500 ${cell}px ui-monospace, "JetBrains Mono", monospace`;ctx.textBaseline="top";
  let s=seed;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  for(let r=0;r<rows;r++){for(let c=0;c<cols;c++){
    const x=mirror?w-(c+1)*cell:c*cell,y=r*cell*1.3;
    const edge=mirror?(w-x)/w:x/w;
    const silhouette=Math.sin((r/rows)*Math.PI*1.4+0.2)*0.9+Math.sin((r/rows)*9+seed)*0.12;
    const limit=silhouette*(0.55+0.25*Math.sin(t*0.0004+r*0.3));
    const inside=edge<limit;
    const v=rnd();
    if(!inside&&v>0.08)continue;
    const flicker=(Math.sin(t*0.002+r*1.7+c*0.9+seed)+1)/2;
    const bright=inside&&v<0.22;
    const ch=bright?BLOCKS[Math.floor(rnd()*BLOCKS.length)]!:CHARS[Math.floor(rnd()*CHARS.length)]!;
    const alpha=bright?0.35+0.55*flicker:inside?0.08+0.22*flicker:0.05;
    ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillText(ch,x,y);
  }}
  ctx.globalAlpha=1;
}

export function Glyphs(){
  const left=useRef<HTMLCanvasElement>(null),right=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;let raf=0,last=0;
    const frame=(t:number)=>{if(t-last>125){last=t;if(left.current)draw(left.current,7,t,false);if(right.current)draw(right.current,13,t,true)}if(!reduced)raf=requestAnimationFrame(frame)};
    raf=requestAnimationFrame(frame);
    const ro=new ResizeObserver(()=>{last=0});if(left.current)ro.observe(left.current);
    const mo=new MutationObserver(()=>{last=0});mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    return()=>{cancelAnimationFrame(raf);ro.disconnect();mo.disconnect()};
  },[]);
  return <div className="hero-glyphs" aria-hidden="true"><canvas ref={left} className="left"/><canvas ref={right} className="right"/></div>;
}
