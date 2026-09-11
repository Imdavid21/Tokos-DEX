import {maybeApi,qs} from "@/lib/api";
import {MarketsTable,type MarketRow} from "@/components/MarketsTable";
import {Unavailable,StaleNotice} from "@/components/DataState";
import Link from "next/link";

export const metadata={title:"Markets"};
type Search=Promise<Record<string,string|string[]|undefined>>;

export default async function Markets({searchParams}:{searchParams:Search}){
  const sp=await searchParams,p=(k:string)=>Array.isArray(sp[k])?sp[k]?.[0]:sp[k],base=(process.env.NEXT_PUBLIC_BASE_PATH??"").replace(/\/$/,"");
  const query=qs({asset:p("asset"),protocol:p("protocol"),chains:p("chains"),rateType:p("rateType"),minLiquidityUsd:p("minLiquidityUsd"),sort:p("sort")??"liquidity",order:p("order")??"desc",limit:100,cursor:p("cursor")});
  const res=await maybeApi<MarketRow[]>(`/markets?${query}`);
  return <div className="page">
    <div className="page-head"><h1 className="page-title">Markets</h1><div className="page-meta">{res?`${res.data.length}${res.meta.hasMore?"+":""} rows`:"Unavailable"}</div></div>
    <form className="filter-bar">
      <input className="input" name="asset" defaultValue={p("asset")} placeholder="Asset" aria-label="Asset filter"/>
      <input className="input" name="protocol" defaultValue={p("protocol")} placeholder="Protocol" aria-label="Protocol filter"/>
      <input className="input" name="chains" defaultValue={p("chains")} placeholder="Chain ID" aria-label="Chain filter"/>
      <select className="select" name="rateType" defaultValue={p("rateType")??""} aria-label="Rate type"><option value="">All types</option><option value="floating">Floating</option><option value="fixed">Fixed</option><option value="hybrid">Hybrid</option></select>
      <input className="input" name="minLiquidityUsd" defaultValue={p("minLiquidityUsd")} placeholder="Min liquidity" aria-label="Minimum liquidity"/>
      <select className="select" name="sort" defaultValue={p("sort")??"liquidity"} aria-label="Sort"><option value="liquidity">Liquidity</option><option value="rate">Rate</option><option value="change24h">24H change</option><option value="updated">Updated</option></select>
      <button className="btn" type="submit">Apply</button><Link className="btn" href="/markets">Reset</Link><a className="btn" href={`${base}/api/v1/export/markets.csv?${query}`} download>CSV</a>
    </form>
    {!res?<Unavailable title="Market data unavailable"/>:<>{res.meta.stale&&<StaleNotice asOf={res.meta.asOf}/>}<div style={{marginTop:res.meta.stale?12:0}}><MarketsTable rows={res.data} selectable/></div>{res.meta.hasMore&&res.meta.nextCursor&&<div className="toolbar" style={{justifyContent:"flex-end",marginTop:12}}><Link className="btn" href={`/markets?${qs({asset:p("asset"),protocol:p("protocol"),chains:p("chains"),rateType:p("rateType"),minLiquidityUsd:p("minLiquidityUsd"),sort:p("sort")??"liquidity",order:p("order")??"desc",cursor:res.meta.nextCursor})}`}>Next page</Link></div>}</>}
  </div>
}
