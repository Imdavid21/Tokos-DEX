import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {gradeClass} from "@/lib/ratings";
type Action={id:string;entityId:string;action:string;fromGrade:string|null;toGrade:string;toPsl:number|null;observedAt:string;market:{name:string|null;assetSymbol:string|null;protocolName:string|null}};
export async function Ticker(){const res=await maybeApi<Action[]>("/ratings/actions?limit=18&days=30");const rows=res?.data??[];if(!rows.length)return null;const items=[...rows,...rows];
  return <div className="ticker" aria-label="Latest rating actions"><div className="ticker-label">Rating actions</div><div style={{overflow:"hidden",flex:1}}><div className="ticker-track">{items.map((a,i)=><Link key={a.id+i} href={`/ratings/market/${encodeURIComponent(a.entityId)}`}><span className={`action-pill ${a.action}`}>{a.action}</span><span>{a.market.name??a.entityId}</span><span className={`grade ${gradeClass(a.toGrade)}`} style={{height:18,minWidth:36,fontSize:9}}>{a.toGrade}</span>{a.fromGrade&&a.fromGrade!==a.toGrade?<span style={{color:"var(--muted-2)"}}>from {a.fromGrade}</span>:null}<span style={{color:"var(--muted-2)"}}>PSL {a.toPsl==null?"—":(a.toPsl*100).toFixed(2)+"%"}</span></Link>)}</div></div></div>
}
