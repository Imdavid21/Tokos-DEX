"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {pct,usd} from "@/lib/format";

type Row={id:string;market_name:string;protocol_name:string|null;asset_symbol:string|null;asset_group:string|null;rate:number|null;liquidity_usd:number|null;rate_type:string};
type Tab="overall"|"stablecoins"|"eth"|"btc"|"fixed"|"floating";
const tabs:Tab[]=["overall","stablecoins","eth","btc","fixed","floating"];
const label=(tab:Tab)=>tab==="stablecoins"?"Stablecoins":tab[0].toUpperCase()+tab.slice(1);
export function OpportunityRanking({rows}:{rows:Row[]}){const[tab,setTab]=useState<Tab>("overall");const filtered=useMemo(()=>rows.filter(r=>{const group=(r.asset_group??r.asset_symbol??"").toLowerCase();if(tab==="stablecoins")return /usd|dai|eur|usdt|usdc/.test(group);if(tab==="eth")return group.includes("eth");if(tab==="btc")return group.includes("btc");if(tab==="fixed")return r.rate_type==="fixed"||r.rate_type==="hybrid";if(tab==="floating")return r.rate_type==="floating"||r.rate_type==="hybrid";return true}).filter(r=>r.rate!=null).sort((a,b)=>(b.rate??-Infinity)-(a.rate??-Infinity)).slice(0,8),[rows,tab]);return <div><div className="chart-toolbar" style={{justifyContent:"flex-start"}}>{tabs.map(t=><button key={t} type="button" className={`chart-action ${t===tab?"active":""}`} onClick={()=>setTab(t)}>{label(t)}</button>)}</div><div className="table-wrap" style={{border:0}}><table className="data" style={{minWidth:560}}><thead><tr><th>Asset</th><th>Market</th><th>Protocol</th><th className="num">Rate</th><th className="num">Liquidity</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td className="identity">{r.asset_symbol??r.asset_group??"—"}</td><td><Link href={`/market/${encodeURIComponent(r.id)}`}>{r.market_name}</Link></td><td>{r.protocol_name??"—"}</td><td className="num identity">{pct(r.rate)}</td><td className="num">{usd(r.liquidity_usd)}</td></tr>)}</tbody></table></div></div>}
