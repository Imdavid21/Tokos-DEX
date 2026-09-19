import {notFound} from "next/navigation";
import {maybeApi} from "@/lib/api";

type Methodology={slug:string;name:string;version:string;scope:string;description:string;formula:string|null;inputs:unknown[];limitations:unknown[];updated_at:string};
export default async function MethodologyPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const res=await maybeApi<Methodology>(`/methodologies/${encodeURIComponent(slug)}`);
  if(!res)notFound();
  const m=res.data;
  return <div className="page"><div className="page-head"><div><h1 className="page-title">{m.name}</h1><div className="page-sub">{m.description}</div></div><div className="page-meta">{m.version}</div></div>
    <section className="section analytics-grid two">
      <div className="panel"><div className="panel-head"><span className="panel-title">Inputs</span></div><div className="panel-body"><ul>{(m.inputs??[]).map((x,i)=><li key={i}>{String(x)}</li>)}</ul></div></div>
      <div className="panel"><div className="panel-head"><span className="panel-title">Limitations</span></div><div className="panel-body"><ul>{(m.limitations??[]).map((x,i)=><li key={i}>{String(x)}</li>)}</ul></div></div>
    </section>
    {m.formula&&<section className="panel section"><div className="panel-head"><span className="panel-title">Formula</span></div><div className="panel-body mono">{m.formula}</div></section>}
  </div>
}
