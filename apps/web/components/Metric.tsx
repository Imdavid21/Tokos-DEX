import {Sparkline} from "./Chart";

type Point=[string|number,number|null];
export function Metric({label,value,meta,className="",trend,trendFormat="percent"}:{label:string;value:string;meta?:string|undefined;className?:string|undefined;trend?:Point[]|undefined;trendFormat?:"percent"|"usd"|"number"}){
  return <div className={`metric ${className}`}>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
    {meta&&<div className="metric-meta">{meta}</div>}
    {trend?.length?<div className="metric-spark"><Sparkline data={trend} format={trendFormat} label={`${label} trend`}/></div>:null}
  </div>
}
