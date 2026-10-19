"use client";
import * as echarts from "echarts";
import {useEffect,useRef} from "react";
import {useRouter} from "next/navigation";

type P={id:string;name:string|null;assetSymbol:string|null;protocolName:string|null;grade:string;psl:number|null;supplyApy:number|null;riskAdjustedApy:number|null;supplyUsd:number|null};
function css(name:string){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
const WEAK=new Set(["BB","B"]),SIGNAL=new Set(["CCC","CC","C","D"]);

export function FrontierChart({points,height=360}:{points:P[];height?:number}){
  const ref=useRef<HTMLDivElement>(null);const router=useRouter();
  useEffect(()=>{
    if(!ref.current)return;const chart=echarts.init(ref.current,null,{renderer:"canvas"});
    const render=()=>{const text=css("--text"),muted=css("--muted"),signal=css("--signal"),border=css("--border"),grid=css("--grid"),bg=css("--bg");
      const data=points.filter(p=>p.psl!=null&&p.supplyApy!=null).map(p=>({value:[Math.max(1e-4,p.psl!)*100,p.supplyApy!*100,Math.max(1e5,p.supplyUsd??1e5)],name:p.name??p.id,p,itemStyle:{color:SIGNAL.has(p.grade)?signal:WEAK.has(p.grade)?css("--muted-2"):text,borderColor:bg,borderWidth:1}}));
      const maxSupply=Math.max(1,...data.map(d=>d.value[2] as number));
      chart.setOption({animationDuration:300,
        grid:{left:56,right:24,top:24,bottom:48},
        tooltip:{trigger:"item",confine:true,backgroundColor:bg,borderColor:border,textStyle:{color:text,fontSize:11,fontFamily:css("--font-mono")},formatter:(x:unknown)=>{const p=(x as {data:{p:P}}).data.p;return `<b>${p.name}</b><br/>${p.protocolName??""}<br/>Grade ${p.grade} · PSL ${(p.psl!*100).toFixed(2)}%<br/>APY ${(p.supplyApy!*100).toFixed(2)}% · net ${((p.riskAdjustedApy??0)*100).toFixed(2)}%<br/>Supply $${((p.supplyUsd??0)/1e6).toFixed(1)}M`}},
        xAxis:{type:"log",name:"Annual PSL",nameLocation:"middle",nameGap:30,nameTextStyle:{color:muted,fontSize:9,fontFamily:css("--font-mono")},min:0.05,max:50,axisLabel:{color:muted,fontSize:10,formatter:(v:number)=>`${v}%`},axisLine:{lineStyle:{color:border}},splitLine:{lineStyle:{color:grid}}},
        yAxis:{type:"value",name:"Supply APY",nameTextStyle:{color:muted,fontSize:9,fontFamily:css("--font-mono")},axisLabel:{color:muted,fontSize:10,formatter:(v:number)=>`${v.toFixed(0)}%`},splitLine:{lineStyle:{color:grid}},axisLine:{show:false}},
        series:[{type:"scatter",data,symbolSize:(v:number[])=>6+Math.sqrt((v[2] as number)/maxSupply)*26,emphasis:{scale:1.3},markLine:{silent:true,symbol:"none",lineStyle:{color:border,type:"dashed"},label:{color:muted,fontSize:9,formatter:"{b}"},data:[{xAxis:0.1,name:"AAA"},{xAxis:0.4,name:"AA"},{xAxis:0.8,name:"A"},{xAxis:1.5,name:"BBB"},{xAxis:3,name:"BB"},{xAxis:6,name:"B"},{xAxis:12,name:"CCC"}]}}]
      },true)};
    render();const ro=new ResizeObserver(()=>chart.resize());ro.observe(ref.current);const mo=new MutationObserver(render);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    chart.on("click",(e:unknown)=>{const p=(e as {data?:{p?:P}})?.data?.p;if(p)router.push(`/ratings/market/${encodeURIComponent(p.id)}`)});
    return()=>{ro.disconnect();mo.disconnect();chart.dispose()}
  },[points,router]);
  return <div className="chart-shell"><div ref={ref} className="chart" style={{height}} role="img" aria-label="Supply APY against annual probability of significant loss"/></div>
}
