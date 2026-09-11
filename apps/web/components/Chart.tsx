"use client";
import * as echarts from "echarts";
import {useEffect,useId,useRef} from "react";

type Point=[string|number,number|null];
type Series={name:string;data:Point[]};
type NumberFormat="percent"|"usd"|"number";

function formatter(kind:NumberFormat){return(v:number)=>{
  if(kind==="percent")return `${(v*100).toFixed(2)}%`;
  if(kind==="usd")return Math.abs(v)>=1e9?`$${(v/1e9).toFixed(1)}B`:Math.abs(v)>=1e6?`$${(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e3?`$${(v/1e3).toFixed(1)}K`:`$${v.toFixed(0)}`;
  return v.toLocaleString(undefined,{maximumFractionDigits:2});
}}
function css(name:string){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
function downloadCsv(filename:string,series:Series[]){
  const timestamps=[...new Set(series.flatMap(s=>s.data.map(([x])=>String(x))))];
  const rows=[["timestamp",...series.map(s=>s.name)].join(",")];
  for(const t of timestamps){rows.push([t,...series.map(s=>{const point=s.data.find(([x])=>String(x)===t);return point?.[1]??""})].join(","))}
  const url=URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
function ChartFrame({children,onCsv,label}:{children:React.ReactNode;onCsv?:()=>void;label:string}){
  const shell=useRef<HTMLDivElement>(null);
  return <div className="chart-shell" ref={shell}>
    <div className="chart-toolbar">
      {onCsv&&<button className="chart-action" type="button" onClick={onCsv}>CSV</button>}
      <button className="chart-action" type="button" onClick={()=>shell.current?.requestFullscreen?.()}>Full screen</button>
    </div>
    <div aria-label={label}>{children}</div>
  </div>
}

export function TimeChart({series,yFormat="percent",height=300}:{series:Series[];yFormat?:NumberFormat;height?:number}){
  const ref=useRef<HTMLDivElement>(null),id=useId();
  useEffect(()=>{
    if(!ref.current)return;const chart=echarts.init(ref.current,null,{renderer:"canvas"});const format=formatter(yFormat);
    const render=()=>chart.setOption({
      animationDuration:220,color:[css("--green"),css("--green-2"),css("--info"),css("--warning")],
      grid:{left:56,right:18,top:28,bottom:42},
      tooltip:{trigger:"axis",axisPointer:{type:"cross",label:{backgroundColor:css("--text")}},valueFormatter:format,confine:true},
      legend:{top:0,right:0,textStyle:{color:css("--muted"),fontSize:10}},
      xAxis:{type:"time",axisLabel:{color:css("--muted"),fontSize:10},axisLine:{lineStyle:{color:css("--border")}},axisPointer:{show:true},splitLine:{show:false}},
      yAxis:{type:"value",axisLabel:{color:css("--muted"),fontSize:10,formatter:format},splitLine:{lineStyle:{color:css("--border")}},axisLine:{show:false},axisPointer:{show:true}},
      dataZoom:[{type:"inside",filterMode:"none"},{type:"slider",height:12,bottom:7,borderColor:css("--border"),backgroundColor:"transparent",fillerColor:css("--highlight"),textStyle:{color:css("--muted"),fontSize:9}}],
      series:series.map(s=>({name:s.name,type:"line",showSymbol:false,symbolSize:5,smooth:false,lineStyle:{width:1.6},emphasis:{focus:"series"},connectNulls:false,data:s.data}))
    },true);
    render();const ro=new ResizeObserver(()=>chart.resize());ro.observe(ref.current);const mo=new MutationObserver(render);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});return()=>{ro.disconnect();mo.disconnect();chart.dispose()}
  },[series,yFormat]);
  return <ChartFrame label={`Time series chart: ${series.map(s=>s.name).join(", ")}`} onCsv={()=>downloadCsv(`tokos-chart-${id}.csv`,series)}><div ref={ref} className="chart" style={{height}} role="img"/></ChartFrame>
}

export function CurveChart({points}:{points:Array<{tenorDays:number;fixed:number|null;floating:number|null}>}){
  const ref=useRef<HTMLDivElement>(null);const series:Series[]=[{name:"Fixed",data:points.filter(p=>p.fixed!=null).map(p=>[p.tenorDays,p.fixed])},{name:"Floating",data:points.filter(p=>p.floating!=null).map(p=>[p.tenorDays,p.floating])}];
  useEffect(()=>{
    if(!ref.current)return;const chart=echarts.init(ref.current);const format=formatter("percent");const render=()=>chart.setOption({
      animationDuration:220,color:[css("--green"),css("--info")],tooltip:{trigger:"axis",axisPointer:{type:"cross"},valueFormatter:format,confine:true},legend:{top:0,right:0,textStyle:{color:css("--muted"),fontSize:10}},grid:{left:56,right:18,top:30,bottom:38},
      xAxis:{type:"value",name:"days",nameTextStyle:{color:css("--muted"),fontSize:10},axisLabel:{color:css("--muted"),fontSize:10},axisLine:{lineStyle:{color:css("--border")}},splitLine:{show:false}},
      yAxis:{type:"value",axisLabel:{color:css("--muted"),fontSize:10,formatter:format},splitLine:{lineStyle:{color:css("--border")}}},
      dataZoom:[{type:"inside",filterMode:"none"}],series:[{name:"Fixed",type:"line",showSymbol:true,symbolSize:5,data:series[0]?.data??[]},{name:"Floating",type:"line",showSymbol:false,data:series[1]?.data??[]}]
    },true);render();const ro=new ResizeObserver(()=>chart.resize());ro.observe(ref.current);const mo=new MutationObserver(render);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});return()=>{ro.disconnect();mo.disconnect();chart.dispose()}
  },[points]);
  return <ChartFrame label="Fixed and floating rate curve" onCsv={()=>downloadCsv("tokos-yield-curve.csv",series)}><div ref={ref} className="chart" role="img"/></ChartFrame>
}

export function Sparkline({data,format="percent",label="Trend"}:{data:Point[];format?:NumberFormat;label?:string}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current||!data.length)return;const chart=echarts.init(ref.current,null,{renderer:"canvas"}),fmt=formatter(format);const values=data.map(([,v])=>v).filter((v):v is number=>v!=null);const high=values.length?Math.max(...values):null,low=values.length?Math.min(...values):null,first=values[0]??null;
    const render=()=>chart.setOption({animation:false,grid:{left:0,right:0,top:2,bottom:2},tooltip:{trigger:"axis",confine:true,formatter:(raw:unknown)=>{const items=raw as Array<{value:Point}>;const current=items[0]?.value?.[1]??null;const change=current!=null&&first!=null?current-first:null;return [`Current ${current==null?"—":fmt(current)}`,`High ${high==null?"—":fmt(high)}`,`Low ${low==null?"—":fmt(low)}`,`Change ${change==null?"—":fmt(change)}`].join("<br/>")}},xAxis:{type:"category",show:false,data:data.map(([x])=>x)},yAxis:{type:"value",show:false,scale:true},series:[{type:"line",showSymbol:false,smooth:false,lineStyle:{width:1.2,color:css("--green")},areaStyle:{opacity:.06,color:css("--green")},data:data.map(([,v])=>v)}]},true);
    render();const ro=new ResizeObserver(()=>chart.resize());ro.observe(ref.current);const mo=new MutationObserver(render);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});return()=>{ro.disconnect();mo.disconnect();chart.dispose()}
  },[data,format]);return <div ref={ref} className="sparkline" role="img" aria-label={label}/>;
}
