import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {Unavailable} from "@/components/DataState";

export const metadata={title:"Risk"};

type Methodology={slug:string;name:string;version:string;scope:string;description:string};

export default async function RiskPage(){
  const methods=await maybeApi<Methodology[]>("/methodologies");
  return <div className="page">
    <div className="page-head"><div><h1 className="page-title">Risk</h1><div className="page-sub">Transparent risk observations and dependencies. No composite score.</div></div><div className="page-meta">foundation</div></div>
    <section className="section analytics-grid two">
      <div className="panel"><div className="panel-head"><span className="panel-title">Framework</span></div><div className="panel-body">
        <div className="stat-grid">
          <div className="stat-cell"><div className="stat-label">Asset</div><div className="stat-value">observable risk dimensions</div></div>
          <div className="stat-cell"><div className="stat-label">Market</div><div className="stat-value">liquidity, volatility, utilization, dependencies</div></div>
          <div className="stat-cell"><div className="stat-label">Vault</div><div className="stat-value">planned after allocation coverage</div></div>
          <div className="stat-cell"><div className="stat-label">Portfolio</div><div className="stat-value">later phase, outside current V0 contract</div></div>
        </div>
      </div></div>
      <div className="panel"><div className="panel-head"><span className="panel-title">Principle</span></div><div className="panel-body">
        <p>Risk remains decomposed into source metrics, confidence, provenance, and methodology. Missing observations remain unavailable rather than inferred.</p>
      </div></div>
    </section>
    <section className="section"><h2 className="section-title">Methodologies</h2>
      {!methods?<Unavailable title="Methodology registry unavailable"/>:
      <div className="table-wrap"><table className="data"><thead><tr><th>Method</th><th>Version</th><th>Scope</th><th>Description</th></tr></thead><tbody>
        {methods.data.map(m=><tr key={m.slug}><td className="identity"><Link href={`/methodology/${m.slug}`}>{m.name}</Link></td><td className="mono">{m.version}</td><td>{m.scope}</td><td>{m.description}</td></tr>)}
      </tbody></table></div>}
    </section>
  </div>
}
