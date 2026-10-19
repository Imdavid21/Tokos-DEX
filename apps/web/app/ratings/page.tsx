import Link from "next/link";
import {maybeApi,qs} from "@/lib/api";
import {usd} from "@/lib/format";
import {GRADES,psl,signedPct,type Rating} from "@/lib/ratings";
import {Unavailable} from "@/components/DataState";
import {RatingsFilters} from "@/components/RatingsFilters";
import {Seal} from "@/components/Seal";

export const metadata={title:"Rated markets"};
type Search=Record<string,string|string[]|undefined>;
const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;

export default async function RatingsPage({searchParams}:{searchParams:Promise<Search>}){
  const sp=await searchParams;
  const params={grades:first(sp.grades),outlook:first(sp.outlook),protocol:first(sp.protocol),chains:first(sp.chains),asset:first(sp.asset),q:first(sp.q),investmentGrade:first(sp.investmentGrade),minSupplyUsd:first(sp.minSupplyUsd),maxPsl:first(sp.maxPsl),sort:first(sp.sort)??"riskAdjustedApy",order:first(sp.order),limit:first(sp.limit)??"200"};
  const res=await maybeApi<Rating[]>(`/ratings?${qs(params)}`);
  const rows=res?.data??[];
  const protocols=[...new Set(rows.map(r=>r.market.protocolName).filter(Boolean))].sort() as string[];
  return <div className="page">
    <div className="page-head"><div><h1 className="page-title">Rated <i>markets</i></h1><div className="page-sub">Every graded lending market with its annual probability of significant loss, expected loss and yield net of expected loss. Click a row for the drivers, inputs and the run that produced it.</div></div><div className="page-meta">{rows.length} rows · {res?.meta.asOf?new Date(res.meta.asOf).toISOString().slice(0,16).replace("T"," ")+" UTC":"—"} · <a href={`${process.env.NEXT_PUBLIC_BASE_PATH??""}/api/v1/ratings/export.csv`} className="btn" style={{height:26}}>CSV</a></div></div>
    <RatingsFilters current={params} protocols={protocols}/>
    {!res?<Unavailable title="Ratings unavailable"/>:rows.length===0?<div className="state"><div><h2>No markets match</h2><p>Loosen the grade, protocol or supply filters.</p></div></div>:
    <div className="table-wrap"><table className="data"><thead><tr><th>Grade</th><th>Outlook</th><th>Market</th><th>Protocol</th><th>Network</th><th className="num">Supply</th><th className="num">APY</th><th className="num">PSL</th><th className="num">95% CI</th><th className="num">Exp. loss</th><th className="num">Net yield</th><th>Top driver</th><th className="num">Coverage</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.entityId}>
        <td><Seal grade={r.grade} psl={r.psl}/></td>
        <td><span className={`outlook ${r.outlook}`}>{r.outlook}</span></td>
        <td className="identity"><Link href={`/ratings/market/${encodeURIComponent(r.entityId)}`}>{r.market.name}</Link><span className="subtle" style={{display:"block"}}>{r.market.assetSymbol} · {r.market.rateType}</span></td>
        <td>{r.market.protocolName??"—"}</td><td>{r.market.chainName??"—"}</td>
        <td className="num">{usd(r.market.supplyUsd)}</td>
        <td className="num">{signedPct(r.supplyApy)}</td>
        <td className="num">{psl(r.psl)}</td>
        <td className="num subtle">{psl(r.pslLow)} to {psl(r.pslHigh)}</td>
        <td className="num">{r.expectedLoss==null?"—":`${(r.expectedLoss*1e4).toFixed(0)} bp`}</td>
        <td className="num" style={r.riskAdjustedApy!=null&&r.riskAdjustedApy<0?{color:"var(--signal)"}:undefined}>{signedPct(r.riskAdjustedApy)}</td>
        <td className="subtle">{r.topDriver??"—"}</td>
        <td className="num subtle">{r.coverage==null?"—":`${Math.round(r.coverage*100)}%`}</td>
      </tr>)}</tbody></table></div>}
    <div className="notice" style={{marginTop:16}}>Grades are bands on annual PSL: {GRADES.slice(0,4).join(", ")} are investment grade. NR means input coverage is under 50% and no grade is published. Not financial advice.</div>
  </div>
}
