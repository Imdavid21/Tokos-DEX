"use client";

import * as echarts from "echarts";
import {useEffect,useRef} from "react";

type Format="percent"|"usd"|"bps"|"number";
const css=(name:string)=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const palette=()=>[css("--chart-1"),css("--chart-2"),css("--chart-3"),css("--chart-4"),css("--chart-5"),css("--chart-6"),css("--chart-7")];
const colorAt=(colors:string[],i:number)=>colors[i%Math.max(1,colors.length)]??css("--chart-1");
const fmt=(kind:Format,value:number)=>kind==="percent"?`${(value*100).toFixed(2)}%`:kind==="bps"?`${value.toFixed(0)} bp`:kind==="usd"?(Math.abs(value)>=1e9?`$${(value/1e9).toFixed(1)}B`:Math.abs(value)>=1e6?`$${(value/1e6).toFixed(1)}M`:Math.abs(value)>=1e3?`$${(value/1e3).toFixed(1)}K`:`$${value.toFixed(0)}`):value.toLocaleString(undefined,{maximumFractionDigits:2});

function useChart(option:()=>echarts.EChartsOption,deps:unknown[]){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current)return;
    const chart=echarts.init(ref.current,null,{renderer:"canvas"});
    const render=()=>chart.setOption(option(),true);
    render();
    const ro=new ResizeObserver(()=>chart.resize());ro.observe(ref.current);
    const mo=new MutationObserver(render);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    return()=>{ro.disconnect();mo.disconnect();chart.dispose()};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },deps);
  return ref;
}
function Frame({children,label}:{children:React.ReactNode;label:string}){const ref=useRef<HTMLDivElement>(null);return <div className="chart-shell" ref={ref}><div className="chart-toolbar"><button type="button" className="chart-action" onClick={()=>ref.current?.requestFullscreen?.()}>Full screen</button></div><div aria-label={label}>{children}</div></div>}

export function HorizontalBarChart({rows,format="usd",height=280}:{rows:Array<{label:string;value:number}>;format?:Format;height?:number}){
  const ref=useChart(()=>{const colors=palette();return{animationDuration:180,grid:{left:110,right:18,top:8,bottom:22},tooltip:{trigger:"axis",axisPointer:{type:"shadow"},valueFormatter:v=>fmt(format,Number(v))},xAxis:{type:"value",axisLabel:{color:css("--muted"),fontSize:10,formatter:(v:number)=>fmt(format,v)},splitLine:{lineStyle:{color:css("--border")}}},yAxis:{type:"category",inverse:true,data:rows.map(r=>r.label),axisLabel:{color:css("--muted"),fontSize:10,width:90,overflow:"truncate"},axisLine:{show:false},axisTick:{show:false}},series:[{type:"bar",data:rows.map((r,i)=>({value:r.value,itemStyle:{color:colorAt(colors,i)}})),barWidth:12}]};},[rows,format]);
  return <Frame label="Horizontal ranking chart"><div ref={ref} className="chart" style={{height}}/></Frame>;
}

export function HeatmapChart({cells,xLabels,yLabels,format="percent",height=320}:{cells:Array<{x:number;y:number;value:number;detail?:string}>;xLabels:string[];yLabels:string[];format?:Format;height?:number}){
  const values=cells.map(c=>c.value),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;
  const ref=useChart(()=>({animationDuration:160,grid:{left:100,right:24,top:20,bottom:54},tooltip:{formatter:(p:unknown)=>{const d=(p as{data:[number,number,number,string?]}).data;return `${yLabels[d[1]]??""} × ${xLabels[d[0]]??""}<br/>${fmt(format,d[2])}${d[3]?`<br/>${d[3]}`:""}`}},xAxis:{type:"category",data:xLabels,axisLabel:{color:css("--muted"),fontSize:9,rotate:28},axisLine:{lineStyle:{color:css("--border")}}},yAxis:{type:"category",data:yLabels,axisLabel:{color:css("--muted"),fontSize:9},axisLine:{lineStyle:{color:css("--border")}}},visualMap:{min,max,calculable:false,orient:"horizontal",left:"center",bottom:2,inRange:{color:[css("--heat-low"),css("--heat-mid"),css("--heat-high")]},textStyle:{color:css("--muted"),fontSize:9}},series:[{type:"heatmap",data:cells.map(c=>[c.x,c.y,c.value,c.detail??""]),label:{show:false},emphasis:{itemStyle:{borderColor:css("--text"),borderWidth:1}}}]}),[cells,xLabels,yLabels,format]);
  return <Frame label="Heatmap"><div ref={ref} className="chart" style={{height}}/></Frame>;
}

export function BubbleChart({points,height=330}:{points:Array<{x:number;y:number;size:number;label:string;group?:string;detail?:string}>;height?:number}){
  const maxSize=Math.max(1,...points.map(p=>p.size));
  const ref=useChart(()=>{const colors=palette(),groups=[...new Set(points.map(p=>p.group??p.label))];return{animationDuration:220,grid:{left:58,right:24,top:20,bottom:40},tooltip:{formatter:(p:unknown)=>{const raw=(p as{data:{value?:[number,number,number,string,string,string]}|[number,number,number,string,string,string]}).data,d=Array.isArray(raw)?raw:raw.value;if(!d)return"";return `${d[3]}${d[4]?` · ${d[4]}`:""}<br/>Yield ${(d[1]*100).toFixed(2)}%<br/>Liquidity ${fmt("usd",d[2])}${d[5]?`<br/>${d[5]}`:""}`}},xAxis:{type:"value",name:"Days",nameTextStyle:{color:css("--muted")},axisLabel:{color:css("--muted"),fontSize:10},splitLine:{lineStyle:{color:css("--border")}}},yAxis:{type:"value",axisLabel:{color:css("--muted"),fontSize:10,formatter:(v:number)=>fmt("percent",v)},splitLine:{lineStyle:{color:css("--border")}}},dataZoom:[{type:"inside"}],series:[{type:"scatter",data:points.map(p=>({value:[p.x,p.y,p.size,p.label,p.group??"",p.detail??""],itemStyle:{color:colorAt(colors,Math.max(0,groups.indexOf(p.group??p.label))),opacity:.72}})),symbolSize:(v:unknown)=>{const d=v as number[];return Math.max(6,Math.min(28,6+22*Math.sqrt((d[2]??0)/maxSize)))},emphasis:{focus:"self",itemStyle:{opacity:1}}}]};},[points]);
  return <Frame label="Yield landscape"><div ref={ref} className="chart" style={{height}}/></Frame>;
}

export function DistributionChart({values,current,format="percent",height=240}:{values:number[];current?:number|null;format?:Format;height?:number}){
  const bins=12,hasValues=values.length>0,min=hasValues?Math.min(...values):0,max=hasValues?Math.max(...values):1,span=max-min||1,step=span/bins,counts=Array.from({length:bins},()=>0);
  for(const v of values){const idx=Math.min(bins-1,Math.floor((v-min)/step));counts[idx]=(counts[idx]??0)+1}
  const labels=counts.map((_,i)=>fmt(format,min+step*(i+.5)));
  const ref=useChart(()=>{const bar:echarts.BarSeriesOption={type:"bar",data:counts,itemStyle:{color:css("--chart-1")}};if(current!=null)bar.markLine={symbol:"none",label:{formatter:`Current ${fmt(format,current)}`,color:css("--muted"),fontSize:9},lineStyle:{color:css("--chart-2"),type:"dashed"},data:[{xAxis:Math.min(bins-1,Math.max(0,Math.floor((current-min)/step)))}]};return{animationDuration:160,grid:{left:42,right:16,top:18,bottom:54},tooltip:{trigger:"axis",axisPointer:{type:"shadow"}},xAxis:{type:"category",data:labels,axisLabel:{color:css("--muted"),fontSize:9,rotate:35},axisLine:{lineStyle:{color:css("--border")}}},yAxis:{type:"value",axisLabel:{color:css("--muted"),fontSize:9},splitLine:{lineStyle:{color:css("--border")}}},series:[bar]}},[values,current,format]);
  if(!hasValues)return <div className="chart-empty" style={{height}}>Insufficient history.</div>;
  return <Frame label="Historical distribution"><div ref={ref} className="chart" style={{height}}/></Frame>;
}

export function ExecutionCurveChart({points,height=280}:{points:Array<{notional:number;headline:number|null;effective:number|null;impact:number|null}>;height?:number}){
  const ref=useChart(()=>({animationDuration:180,grid:{left:58,right:20,top:28,bottom:42},tooltip:{trigger:"axis",axisPointer:{type:"cross"},formatter:(raw:unknown)=>{const list=raw as Array<{seriesName:string;value:[number,number]}>;const first=list[0];if(!first)return"";return `${fmt("usd",first.value[0])}<br/>${list.map(x=>`${x.seriesName}: ${x.seriesName.includes("Impact")?fmt("bps",x.value[1]):fmt("percent",x.value[1])}`).join("<br/>")}`}},legend:{top:0,right:0,textStyle:{color:css("--muted"),fontSize:10}},xAxis:{type:"log",name:"Notional",axisLabel:{color:css("--muted"),fontSize:9,formatter:(v:number)=>fmt("usd",v)},splitLine:{lineStyle:{color:css("--border")}}},yAxis:[{type:"value",axisLabel:{color:css("--muted"),fontSize:9,formatter:(v:number)=>fmt("percent",v)},splitLine:{lineStyle:{color:css("--border")}}},{type:"value",axisLabel:{color:css("--muted"),fontSize:9,formatter:(v:number)=>fmt("bps",v)},splitLine:{show:false}}],series:[{name:"Headline yield",type:"line",showSymbol:true,data:points.filter(p=>p.headline!=null).map(p=>[p.notional,p.headline]),lineStyle:{color:css("--chart-1")},itemStyle:{color:css("--chart-1")}},{name:"Executable yield",type:"line",showSymbol:true,data:points.filter(p=>p.effective!=null).map(p=>[p.notional,p.effective]),lineStyle:{color:css("--chart-4")},itemStyle:{color:css("--chart-4")}},{name:"Price impact",type:"line",yAxisIndex:1,showSymbol:true,data:points.filter(p=>p.impact!=null).map(p=>[p.notional,p.impact]),lineStyle:{color:css("--chart-5"),type:"dashed"},itemStyle:{color:css("--chart-5")}}]}),[points]);
  return <Frame label="Execution curve"><div ref={ref} className="chart" style={{height}}/></Frame>;
}
