import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {Unavailable} from "@/components/DataState";
export const metadata={title:"Metrics"};
type Metric={slug:string;name:string;unit:string;source:string;formula:string;frequency:string};
export default async function Metrics(){const res=await maybeApi<Metric[]>("/metrics");return <div className="page"><div className="page-head"><h1 className="page-title">Metrics</h1><div className="page-meta">Definitions and methodology</div></div>{!res?<Unavailable title="Metrics directory unavailable"/>:<div className="table-wrap"><table className="data"><thead><tr><th>Metric</th><th>Unit</th><th>Source</th><th>Frequency</th></tr></thead><tbody>{res.data.map(m=><tr key={m.slug}><td className="identity"><Link href={`/metrics/${m.slug}`}>{m.name}</Link></td><td>{m.unit}</td><td className="mono">{m.source}</td><td>{m.frequency}</td></tr>)}</tbody></table></div>}</div>}
