import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {usd} from "@/lib/format";
import {gradeClass,psl,signedPct} from "@/lib/ratings";
import {Unavailable} from "@/components/DataState";
import {FrontierChart} from "@/components/FrontierChart";
export const metadata={title:"Yield against risk"};
type P={id:string;name:string|null;assetSymbol:string|null;protocolName:string|null;chainName:string|null;grade:string;psl:number|null;supplyApy:number|null;expectedLoss:number|null;riskAdjustedApy:number|null;supplyUsd:number|null};
export default async function FrontierPage(){const res=await maybeApi<P[]>("/ratings/frontier");const rows=res?.data??[];
  const frontier:P[]=[];let best=-Infinity;for(const p of [...rows].sort((a,b)=>(a.psl??1)-(b.psl??1))){if((p.supplyApy??-Infinity)>best){best=p.supplyApy??best;frontier.push(p)}}
  return <div className="page"><div className="page-head"><div><h1 className="page-title">Yield <i>against risk</i></h1><div className="page-sub">Supply APY plotted against annual PSL on a log scale, with grade boundaries marked. The efficient set below lists markets no other market beats on both yield and loss probability.</div></div><div className="page-meta">{rows.length} graded markets</div></div>
    {!res||!rows.length?<Unavailable title="No graded markets"/>:<><FrontierChart points={rows} height={460}/>
    <section className="section"><h2 className="section-title"><span className="idx">01</span>Efficient set</h2><div className="table-wrap"><table className="data"><thead><tr><th>Grade</th><th>Market</th><th>Protocol</th><th>Network</th><th className="num">Supply</th><th className="num">APY</th><th className="num">PSL</th><th className="num">Exp. loss</th><th className="num">Net yield</th></tr></thead><tbody>{frontier.map(p=><tr key={p.id}><td><span className={`grade ${gradeClass(p.grade)}`}>{p.grade}</span></td><td className="identity"><Link href={`/ratings/market/${encodeURIComponent(p.id)}`}>{p.name}</Link></td><td>{p.protocolName}</td><td>{p.chainName}</td><td className="num">{usd(p.supplyUsd)}</td><td className="num">{signedPct(p.supplyApy)}</td><td className="num">{psl(p.psl)}</td><td className="num">{p.expectedLoss==null?"—":`${(p.expectedLoss*1e4).toFixed(0)} bp`}</td><td className="num">{signedPct(p.riskAdjustedApy)}</td></tr>)}</tbody></table></div></section></>}
  </div>}
