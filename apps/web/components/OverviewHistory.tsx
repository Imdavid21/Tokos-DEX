"use client";
import {useEffect,useMemo,useState} from "react";
import {TimeChart} from "./Chart";

type Row={observedAt:string;medianYield:number|null;weightedYield:number|null;fixedYield:number|null;floatingYield:number|null;borrowRate:number|null;tvlUsd:number|null;liquidityUsd:number|null;utilization:number|null};
const metrics={medianYield:{label:"Median Yield",format:"percent"},weightedYield:{label:"Weighted Yield",format:"percent"},fixedYield:{label:"Fixed",format:"percent"},floatingYield:{label:"Floating Ref.",format:"percent"},borrowRate:{label:"Borrow",format:"percent"},tvlUsd:{label:"TVL",format:"usd"},liquidityUsd:{label:"Liquidity",format:"usd"},utilization:{label:"Utilization",format:"percent"}} as const;
type Key=keyof typeof metrics;
export function OverviewHistory({rows}:{rows:Row[]}){const available=useMemo(()=>(Object.keys(metrics)as Key[]).filter(k=>rows.some(r=>r[k]!=null)),[rows]),[key,setKey]=useState<Key>(available[0]??"medianYield");useEffect(()=>{if(!available.includes(key)&&available[0])setKey(available[0])},[available,key]);const meta=metrics[key];return <div><div className="chart-toolbar" style={{justifyContent:"flex-start"}}>{available.map(k=><button type="button" key={k} className={`chart-action ${k===key?"active":""}`} onClick={()=>setKey(k)}>{metrics[k].label}</button>)}</div><TimeChart series={[{name:meta.label,data:rows.map(r=>[r.observedAt,r[key]] as [string,number|null])}]} yFormat={meta.format}/></div>}
