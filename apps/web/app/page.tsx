import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {Metric} from "@/components/Metric";
import {MarketsTable,type MarketRow} from "@/components/MarketsTable";
import {StaleNotice,Unavailable} from "@/components/DataState";
import {bps,pct} from "@/lib/format";

type Overview={summary:{medianRate:number|null;bestRate:number|null;activeMarkets:number;assets:number;protocols:number};movers:MarketRow[];notableMarkets:MarketRow[];providerHealth:Array<{provider:string;last_success_at?:string;last_error?:string}>};

export default async function Home(){
  const res=await maybeApi<Overview>("/overview");
  if(!res)return <div className="page"><Unavailable title="Tokos Data is not yet populated" detail="The normalized API is unavailable. No demo rates are substituted."/></div>;
  const d=res.data;
  return <div className="page">
    <div className="page-head"><h1 className="page-title">Overview</h1><div className="page-meta">As of {new Date(res.meta.asOf).toLocaleString("en",{timeZone:"UTC"})} UTC</div></div>
    {res.meta.stale&&<StaleNotice asOf={res.meta.asOf}/>} 
    <div className="metrics" style={{marginTop:res.meta.stale?12:0}}>
      <Metric label="Median yield" value={pct(d.summary.medianRate)}/><Metric label="Best current yield" value={pct(d.summary.bestRate)}/><Metric label="Active markets" value={d.summary.activeMarkets.toLocaleString()}/><Metric label="Assets" value={d.summary.assets.toLocaleString()}/><Metric label="Protocols" value={d.summary.protocols.toLocaleString()}/>
    </div>
    <div className="split">
      <section className="panel"><div className="panel-head"><span className="panel-title">Rate Movers</span><Link href="/markets?sort=change24h&order=desc" className="panel-note">All markets</Link></div><div className="panel-body">{d.movers.length?<div>{d.movers.slice(0,7).map(m=><Link key={m.id} href={`/market/${encodeURIComponent(m.id)}`} style={{display:"grid",gridTemplateColumns:"70px 1fr auto",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)"}}><b>{m.assetSymbol??m.assetId.toUpperCase()}</b><span>{m.marketName}</span><span className={(m.change24hBps??0)>=0?"positive":"negative"}>{bps(m.change24hBps)}</span></Link>)}</div>:<div className="subtle">Insufficient history for 24H movers.</div>}</div></section>
      <section className="panel"><div className="panel-head"><span className="panel-title">Source Health</span></div><div className="panel-body">{d.providerHealth.length?d.providerHealth.map(h=><div key={h.provider} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}><span className="identity">{h.provider}</span><span className={h.last_error?"negative":"positive"}>{h.last_error?"degraded":"live"}</span></div>):<div className="subtle">No ingestion health records yet.</div>}</div></section>
    </div>
    <section className="section"><div className="panel-head" style={{border:"1px solid var(--border)"}}><span className="panel-title">Current Rates</span><Link href="/rates" className="panel-note">Rates</Link></div><MarketsTable rows={d.notableMarkets}/></section>
  </div>
}
