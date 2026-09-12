import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {Unavailable} from "@/components/DataState";
import {ago} from "@/lib/format";
export const metadata={title:"Datasets"};
type D={slug:string;description:string;tableName:string;updateFrequency:string;sources:string[];rowCount:number;latestObservation:string|null};
export default async function Datasets(){const res=await maybeApi<D[]>("/datasets");return <div className="page"><div className="page-head"><h1 className="page-title">Datasets</h1><div className="page-meta">Canonical research tables</div></div>{!res?<Unavailable title="Dataset registry unavailable"/>:<div className="table-wrap"><table className="data"><thead><tr><th>Dataset</th><th>Source</th><th className="num">Rows</th><th>Frequency</th><th>Latest</th></tr></thead><tbody>{res.data.map(d=><tr key={d.slug}><td><Link className="identity mono" href={`/datasets/${d.slug}`}>{d.slug}</Link><div className="provider">{d.description}</div></td><td>{d.sources.join(", ")||"Tokos"}</td><td className="num">{d.rowCount.toLocaleString()}</td><td>{d.updateFrequency}</td><td>{d.latestObservation?ago(d.latestObservation):"entity dataset"}</td></tr>)}</tbody></table></div>}</div>}
