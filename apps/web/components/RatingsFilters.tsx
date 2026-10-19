"use client";
import {useRouter,usePathname} from "next/navigation";
import {GRADES} from "@/lib/ratings";
type Current=Record<string,string|undefined>;
export function RatingsFilters({current,protocols}:{current:Current;protocols:string[]}){
  const router=useRouter(),path=usePathname();
  const set=(k:string,v:string)=>{const p=new URLSearchParams();for(const [key,val] of Object.entries(current))if(val)p.set(key,val);if(v)p.set(k,v);else p.delete(k);if(k!=="limit")p.delete("cursor");router.push(`${path}?${p.toString()}`)};
  return <div className="filter-bar">
    <input className="input" placeholder="Search market, asset or protocol" defaultValue={current.q??""} onKeyDown={e=>{if(e.key==="Enter")set("q",(e.target as HTMLInputElement).value)}}/>
    <select className="select" value={current.grades??""} onChange={e=>set("grades",e.target.value)}><option value="">All grades</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}<option value="NR">NR</option></select>
    <select className="select" value={current.investmentGrade??""} onChange={e=>set("investmentGrade",e.target.value)}><option value="">Any quality</option><option value="true">Investment grade</option></select>
    <select className="select" value={current.outlook??""} onChange={e=>set("outlook",e.target.value)}><option value="">Any outlook</option><option value="stable">Stable</option><option value="positive">Positive</option><option value="negative">Negative</option><option value="watch">Watch</option></select>
    <select className="select" value={current.protocol??""} onChange={e=>set("protocol",e.target.value)}><option value="">All protocols</option>{protocols.map(p=><option key={p} value={p.toLowerCase().replace(/\s+/g,"-")}>{p}</option>)}</select>
    <select className="select" value={current.minSupplyUsd??""} onChange={e=>set("minSupplyUsd",e.target.value)}><option value="">Any supply</option><option value="1000000">Over $1M</option><option value="10000000">Over $10M</option><option value="100000000">Over $100M</option></select>
    <select className="select" value={current.sort??"riskAdjustedApy"} onChange={e=>set("sort",e.target.value)}><option value="riskAdjustedApy">Net yield</option><option value="psl">Lowest PSL</option><option value="apy">Highest APY</option><option value="supply">Largest supply</option><option value="expectedLoss">Lowest expected loss</option><option value="updated">Recently rated</option></select>
    <button className="btn" type="button" onClick={()=>router.push(path)}>Reset</button>
  </div>
}
