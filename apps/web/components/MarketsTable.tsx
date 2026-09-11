"use client";
import Link from "next/link";
import {useState} from "react";
import {DataState} from "./DataState";
import {Sparkline} from "./Chart";
import {ago,pct,shortId,usd,bps} from "@/lib/format";

type TrendPoint=[string|number,number|null];
export type MarketRow={id:string;assetId:string;assetSymbol?:string;marketName:string;protocolId:string;protocolName?:string;chainId:string;chainName?:string;rateType:string;provider:string;supplyApr:number|null;borrowApr:number|null;fixedApy:number|null;impliedApy?:number|null;liquidityUsd:number|null;utilization:number|null;depositsUsd:number|null;tvlUsd?:number|null;change24hBps?:number|null;observedAt:string;stale:boolean;maturity?:string|null;rateTrend?:TrendPoint[]};

export function MarketsTable({rows,selectable=false}:{rows:MarketRow[];selectable?:boolean}){
  const[selected,setSelected]=useState<string[]>([]),base=(process.env.NEXT_PUBLIC_BASE_PATH??"").replace(/\/$/,"");
  if(!rows.length)return <DataState kind="filtered" title="No matching markets" detail="No normalized markets match the current filters."/>;
  const showTrend=rows.some(r=>r.rateTrend?.length);
  function toggle(id:string){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length<6?[...s,id]:s)}
  const table=<div className="table-wrap"><table className="data"><thead><tr>
    {selectable&&<th style={{width:36}} aria-label="Select"/>}<th className="sticky-col" style={{width:84}}>Asset</th><th className="sticky-col-2">Market</th><th>Protocol</th><th>Chain</th><th>Type</th><th className="num">Rate</th><th className="num">Borrow</th><th className="num">24H</th><th className="num">Liquidity</th><th className="num">Util.</th>{showTrend&&<th>Trend</th>}<th>Updated</th>
  </tr></thead><tbody>{rows.map(r=>{
    const rate=r.fixedApy??r.impliedApy??r.supplyApr;
    return <tr key={r.id}>
      {selectable&&<td><input type="checkbox" name="markets" value={r.id} aria-label={`Select ${r.marketName}`} checked={selected.includes(r.id)} onChange={()=>toggle(r.id)} disabled={!selected.includes(r.id)&&selected.length>=6}/></td>}
      <td className="identity sticky-col">{r.assetSymbol??r.assetId.toUpperCase()}</td>
      <td className="sticky-col-2"><Link href={`/market/${encodeURIComponent(r.id)}`} className="identity">{r.marketName}</Link><div className="provider" title={r.id}>{shortId(r.id)}</div></td>
      <td><Link href={`/protocol/${r.protocolId}`}>{r.protocolName??r.protocolId}</Link></td><td><Link href={`/chain/${r.chainId}`}>{r.chainName??r.chainId}</Link></td><td><span className="tag">{r.rateType}</span></td>
      <td className="num identity">{pct(rate)}</td><td className="num">{pct(r.borrowApr)}</td><td className={`num ${(r.change24hBps??0)>0?"positive":(r.change24hBps??0)<0?"negative":""}`}>{bps(r.change24hBps)}</td><td className="num">{usd(r.liquidityUsd)}</td><td className="num">{pct(r.utilization,1)}</td>
      {showTrend&&<td style={{width:92,height:42}}>{r.rateTrend?.length?<Sparkline data={r.rateTrend} label={`${r.marketName} rate trend`}/>:<span className="subtle">—</span>}</td>}
      <td>{r.stale?<span className="tag stale-tag">Stale</span>:ago(r.observedAt)}</td>
    </tr>
  })}</tbody></table></div>;
  if(!selectable)return table;
  return <form action={`${base}/compare`} method="get"><div className="toolbar" style={{justifyContent:"flex-end"}}><span className="subtle">{selected.length}/6 selected</span><button className="btn" type="submit" disabled={selected.length<2}>Compare selected</button></div>{table}</form>
}
