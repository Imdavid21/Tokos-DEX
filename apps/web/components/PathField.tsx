"use client";
import {useEffect,useRef} from "react";

/**
 * Live field of simulated collateral/loan ratio paths over one year, drawn progressively.
 * Paths that cross the liquidation-loss band turn ember. The field re-seeds every few seconds and crossfades.
 * This is a visual sketch of the engine's mechanism, not the production simulation.
 */
function mulberry(seed:number){let s=seed>>>0||1;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function normal(r:()=>number){let u=0;while(u===0)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r())}
type Path={pts:Float32Array;breach:number};
function makePaths(seed:number,n:number,steps:number):Path[]{const r=mulberry(seed);const out:Path[]=[];for(let i=0;i<n;i++){const vol=0.08+r()*0.32;const dv=vol/Math.sqrt(steps);const pts=new Float32Array(steps+1);let x=1;pts[0]=1;let breach=-1;let stress=0;for(let s=1;s<=steps;s++){if(stress>0)stress--;else if(r()<0.006)stress=25;const v=stress?dv*2.2:dv;let m=-0.5*v*v+v*normal(r);if(r()<(stress?0.02:0.005))m-=0.03+r()*0.1;x*=Math.exp(m);pts[s]=x;if(breach<0&&x<0.55)breach=s}out.push({pts,breach})}return out}
function css(name:string){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}

export function PathField(){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps=260,n=110;let seed=11,paths=makePaths(seed,n,steps),next:Path[]|null=null;let raf=0,phaseStart=performance.now();const DRAW=2600,HOLD=7000,FADE=900;
    const resize=()=>{const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.floor(canvas.clientWidth*dpr);canvas.height=Math.floor(canvas.clientHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)};resize();
    const ro=new ResizeObserver(resize);ro.observe(canvas);
    const draw=(t:number)=>{
      const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
      const text=css("--text"),ember=css("--ember"),muted=css("--muted-2"),border=css("--border");
      const padL=18,padR=18,padT=24,padB=34;const X=(s:number)=>padL+(s/steps)*(w-padL-padR);const lo=0.34,hi=1.9;const Y=(v:number)=>padT+(1-(Math.log(v)-Math.log(lo))/(Math.log(hi)-Math.log(lo)))*(h-padT-padB);
      ctx.clearRect(0,0,w,h);
      // loss band: below this ratio the representative position produces bad debt
      ctx.fillStyle=ember;ctx.globalAlpha=0.06;ctx.fillRect(padL,Y(0.55),w-padL-padR,Y(lo)-Y(0.55));ctx.globalAlpha=1;
      ctx.strokeStyle=border;ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(padL,Y(0.55));ctx.lineTo(w-padR,Y(0.55));ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(padL,Y(1));ctx.lineTo(w-padR,Y(1));ctx.strokeStyle=border;ctx.stroke();
      ctx.fillStyle=muted;ctx.font="9px ui-monospace, 'IBM Plex Mono', monospace";ctx.textAlign="left";ctx.fillText("t0",padL,h-padB+18);ctx.textAlign="right";ctx.fillText("one year",w-padR,h-padB+18);ctx.textAlign="left";ctx.fillText("ratio 1.0",padL,Y(1)-6);ctx.fillStyle=ember;ctx.fillText("bad debt below",padL,Y(0.55)+12);
      const elapsed=t-phaseStart;const progress=reduced?1:Math.min(1,elapsed/DRAW);const eased=1-Math.pow(1-progress,3);const upTo=Math.floor(eased*steps);
      const fade=elapsed>DRAW+HOLD?Math.min(1,(elapsed-DRAW-HOLD)/FADE):0;
      ctx.globalAlpha=1-fade;
      for(const p of paths){const breached=p.breach>=0&&p.breach<=upTo;ctx.beginPath();ctx.moveTo(X(0),Y(p.pts[0]!));for(let s=1;s<=upTo;s++)ctx.lineTo(X(s),Y(p.pts[s]!));ctx.strokeStyle=breached?ember:text;ctx.globalAlpha=(1-fade)*(breached?0.4:0.14);ctx.lineWidth=breached?1:0.75;ctx.stroke();if(breached&&p.breach<=upTo){ctx.beginPath();ctx.arc(X(p.breach),Y(p.pts[p.breach]!),2.2,0,Math.PI*2);ctx.fillStyle=ember;ctx.globalAlpha=(1-fade)*0.9;ctx.fill()}}
      ctx.globalAlpha=1;
      if(!reduced&&fade>=1){seed+=7;next=makePaths(seed,n,steps);paths=next;phaseStart=t}
      if(!reduced)raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    const mo=new MutationObserver(()=>{if(reduced)draw(performance.now())});mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    return()=>{cancelAnimationFrame(raf);ro.disconnect();mo.disconnect()};
  },[]);
  return <div className="hero-field" aria-hidden="true"><canvas ref={ref}/><div className="hero-legend"><span><i/>simulated ratio path</span><span><i className="ember"/>loss event</span><span><i className="dash"/>liquidation floor</span></div></div>;
}
