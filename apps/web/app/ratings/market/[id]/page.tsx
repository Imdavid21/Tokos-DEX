import Link from "next/link";
import {notFound} from "next/navigation";
import {maybeApi} from "@/lib/api";
import {usd} from "@/lib/format";
import {BANDS,gradeClass,psl,signedPct,type Rating} from "@/lib/ratings";
import {TimeChart} from "@/components/Chart";
import {WhatIf} from "@/components/WhatIf";
import {Seal} from "@/components/Seal";
import {FanChart} from "@/components/FanChart";
import {Reveal} from "@/components/Motion";

type Driver={key:string;label:string;pslContribution:number;share:number;detail:string};
type Input={key:string;value:number|string;unit:string;source:"observed"|"prior"|"derived";note?:string};
type Detail=Rating&{run:{id:string|null;seed:string|null;paths:number|null;inputsHash:string|null;durationMs:number|null;inputs:{records:Input[];archetypes:{collateral:string;loan:string}}|null;drivers:Driver[];simulation:{quantiles:{p50:number;p90:number;p95:number;p99:number;max:number};histogram:Array<{from:number;to:number;count:number}>;channels:Record<string,number>;samplePaths?:Array<{ratio:number[];loss:number[];significant:boolean}>}|null;limitations:string[]};history:Array<{computedAt:string;grade:string;psl:number|null;pslLow:number|null;pslHigh:number|null;expectedLoss:number|null;riskAdjustedApy:number|null}>;actions:Array<{id:string;action:string;fromGrade:string|null;toGrade:string;notches:number;reason:string;observedAt:string}>;dependencies:Array<{relationship:string;targetType:string;targetId:string}>};

export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;return{title:`Rating | ${decodeURIComponent(id)}`}}

export default async function RatingDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const res=await maybeApi<Detail>(`/ratings/market/${encodeURIComponent(decodeURIComponent(id))}`);
  if(!res)notFound();
  const r=res.data,m=r.market,run=r.run;
  const band=BANDS.find(b=>b.grade===r.grade);
  const inputs=run.inputs?.records??[];
  const observed=inputs.filter(x=>x.source==="observed").length;
  const hist=run.simulation?.histogram??[];const maxBin=Math.max(1,...hist.map(h=>h.count));
  const logPos=(v:number)=>{const lo=Math.log10(0.0005),hi=Math.log10(1);return Math.max(0,Math.min(1,(Math.log10(Math.max(0.0005,v))-lo)/(hi-lo)))};
  return <div className="page">
    <div className="page-head"><div><div className="label" style={{marginBottom:10}}><Link href="/ratings">Rated markets</Link> / {m.protocolName} / {m.chainName}</div><h1 className="page-title">{m.name}</h1><div className="page-sub">{m.assetSymbol} {m.rateType} market on {m.protocolName}, {m.chainName}. Rated under {r.methodologyVersion} from {run.paths?.toLocaleString()} simulated one-year paths, seed {run.seed}, inputs hash {run.inputsHash}.</div></div><div className="page-meta">Computed {r.computedAt?new Date(r.computedAt).toISOString().slice(0,16).replace("T"," "):"—"} UTC | <Link href={`/market/${encodeURIComponent(m.id)}`} className="btn" style={{height:26}}>Market data</Link></div></div>

    <div className="rating-card">
      <div className="rating-card-grade"><span className="label">Indenture grade</span><Seal grade={r.grade} psl={r.psl} large/><span className={`outlook ${r.outlook}`}>Outlook {r.outlook}</span>{band&&<div><div className="band-track"><i style={{left:`${logPos(band.lower)*100}%`,width:`${(logPos(band.upper??1)-logPos(band.lower))*100}%`,opacity:.25}}/><b style={{left:`calc(${logPos(r.psl??0)*100}% - 1px)`}}/></div><div className="band-scale"><span>0.05%</span><span>1%</span><span>10%</span><span>100%</span></div></div>}</div>
      <div className="rating-card-kpis">
        <div><span className="label">Annual PSL</span><strong>{psl(r.psl)}</strong><span className="subtle">95% CI {psl(r.pslLow)} to {psl(r.pslHigh)}</span></div>
        <div><span className="label">Expected loss</span><strong>{r.expectedLoss==null?"—":`${(r.expectedLoss*1e4).toFixed(0)} bp`}</strong><span className="subtle">LGD {psl(r.lgd,1)} given loss</span></div>
        <div><span className="label">Supply APY</span><strong>{signedPct(r.supplyApy)}</strong><span className="subtle">supply {usd(m.supplyUsd)} | util {m.utilization==null?"—":(m.utilization*100).toFixed(0)+"%"}</span></div>
        <div><span className="label">Net yield</span><strong className={r.riskAdjustedApy!=null&&r.riskAdjustedApy<0?"signal":""}>{signedPct(r.riskAdjustedApy)}</strong><span className="subtle">APY minus expected loss</span></div>
      </div>
    </div>

    {run.simulation?.samplePaths?.length?<Reveal as="section" className="section"><div className="panel"><div className="panel-head"><span className="panel-title">A year of simulated paths</span><span className="panel-note">{run.simulation.samplePaths.length} of {run.paths?.toLocaleString()} paths, collateral to loan ratio, monthly checkpoints</span></div><div className="panel-body"><FanChart paths={run.simulation.samplePaths} lltvRatioFloor={lltvFloor(inputs)}/><div className="fan-note"><span>Bone: paths that end the year without a significant loss</span><span style={{color:"var(--ember)"}}>Ember: paths where suppliers lost more than 1%</span></div></div></div></Reveal>:null}

    <section className="section grid-2">
      <div className="panel"><div className="panel-head"><span className="panel-title">What drives the rating</span><span className="panel-note">PSL removed if the channel were benign</span></div><div className="panel-body">{run.drivers.length?run.drivers.map(d=><div className="driver" key={d.key}><div className="driver-name">{d.label}</div><div className="driver-bar"><i style={{width:`${Math.max(1,d.share*100)}%`}}/></div><div className="driver-val">{(d.pslContribution*100).toFixed(2)} pp | {(d.share*100).toFixed(0)}%</div></div>):<span className="subtle">No driver decomposition stored</span>}</div></div>
      <div className="panel"><div className="panel-head"><span className="panel-title">Loss distribution</span><span className="panel-note">{run.paths?.toLocaleString()} paths, log-spaced bins</span></div><div className="panel-body">{hist.length?<><div className="hist">{hist.map((h,i)=><i key={i} className={h.from>=0.01?"sig":""} style={{height:`${Math.max(1,(h.count/maxBin)*100)}%`}} title={`${(h.from*100).toFixed(2)}% to ${(h.to*100).toFixed(2)}%: ${h.count} paths`}/>)}</div><div className="hist-axis"><span>0</span><span>0.1%</span><span>1%</span><span>10%</span><span>100%</span></div><div className="kvs" style={{marginTop:14}}>{run.simulation&&<><div className="kv"><dt>P50 / P90 / P95 / P99</dt><dd>{psl(run.simulation.quantiles.p50)} / {psl(run.simulation.quantiles.p90)} / {psl(run.simulation.quantiles.p95)} / {psl(run.simulation.quantiles.p99)}</dd></div><div className="kv"><dt>Worst path</dt><dd>{psl(run.simulation.quantiles.max,1)} of principal</dd></div><div className="kv"><dt>First cause of loss</dt><dd>{Object.entries(run.simulation.channels).filter(([,v])=>v>0).map(([k,v])=>`${k} ${(v*100).toFixed(0)}%`).join(" | ")||"—"}</dd></div></>}</div></>:<span className="subtle">No distribution stored</span>}</div></div>
    </section>

    <section className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">03</span>Inputs and sources</h2><div className="page-sub">{observed} of {inputs.length} inputs observed from normalized data; the rest are published priors or derived. Coverage {r.coverage==null?"—":Math.round(r.coverage*100)+"%"}. Archetypes: collateral {run.inputs?.archetypes.collateral}, loan {run.inputs?.archetypes.loan}.</div></div></div>
      <div className="table-wrap"><table className="data inputs-table" style={{minWidth:0}}><thead><tr><th>Input</th><th className="num">Value</th><th>Unit</th><th>Source</th><th>Note</th></tr></thead><tbody>{inputs.map(x=><tr key={x.key}><td>{x.key}</td><td className="num">{typeof x.value==="number"?fmt(x.value,x.unit):x.value}</td><td className="subtle">{x.unit}</td><td><span className={`src ${x.source}`}>{x.source}</span></td><td className="subtle" style={{whiteSpace:"normal"}}>{x.note??""}</td></tr>)}</tbody></table></div>
      {run.limitations.length>0&&<div className="panel" style={{marginTop:12}}><div className="panel-head"><span className="panel-title">Limitations of this rating</span></div><div className="panel-body"><ul className="limitations" style={{margin:0,paddingLeft:18}}>{run.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul></div></div>}
    </section>

    <section className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">04</span>What if</h2><div className="page-sub">Re-run this market with different inputs. Computation is live, not persisted, and never becomes a rating action.</div></div></div>
      <WhatIf marketId={m.id} base={{lltv:numberInput(inputs,"liquidation_ltv")??0.8,utilization:numberInput(inputs,"utilization")??0.75,priceImpactBps:Math.round((numberInput(inputs,"price_impact")??0.01)*10000),oracleLagDays:numberInput(inputs,"oracle_lag_days")??0.25,protocolPd:numberInput(inputs,"protocol_pd")??0.002,observedVol:numberInput(inputs,"ratio_volatility")??0.5}}/>
    </section>

    <section className="section grid-2">
      <div className="panel"><div className="panel-head"><span className="panel-title">Rating history</span><span className="panel-note">{r.history.length} runs</span></div>{r.history.length>1?<TimeChart series={[{name:"PSL",data:r.history.map(h=>[h.computedAt,h.psl])},{name:"95% high",data:r.history.map(h=>[h.computedAt,h.pslHigh])},{name:"95% low",data:r.history.map(h=>[h.computedAt,h.pslLow])}]} yFormat="percent" height={260}/>:<div className="panel-body subtle">History accumulates with each daily run. {r.history.length===1?"One run so far.":""}</div>}</div>
      <div className="panel"><div className="panel-head"><span className="panel-title">Actions on this market</span></div><div className="table-wrap" style={{border:0}}><table className="data" style={{minWidth:0}}><thead><tr><th>When</th><th>Action</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>{r.actions.length?r.actions.map(a=><tr key={a.id}><td className="subtle">{a.observedAt.slice(0,10)}</td><td><span className={`action-pill ${a.action}`}>{a.action}</span></td><td>{a.fromGrade?<span className={`grade ${gradeClass(a.fromGrade)}`}>{a.fromGrade}</span>:"—"}</td><td><span className={`grade ${gradeClass(a.toGrade)}`}>{a.toGrade}</span></td><td className="subtle" style={{whiteSpace:"normal"}}>{a.reason}</td></tr>):<tr><td colSpan={5} className="subtle">No actions</td></tr>}</tbody></table></div></div>
    </section>

    <section className="section"><div className="kvs"><div className="kv"><dt>Run ID</dt><dd className="mono">{run.id??"—"}</dd></div><div className="kv"><dt>Reproduce</dt><dd className="mono">rateMarket(facts, {"{"}seed: {run.seed}, paths: {run.paths}{"}"}) with the inputs above returns PSL {psl(r.psl,3)} under {r.methodologyVersion}</dd></div><div className="kv"><dt>Dependencies</dt><dd>{r.dependencies.length?r.dependencies.map(d=><Link key={d.relationship+d.targetId} href={`/${d.targetType}/${encodeURIComponent(d.targetId)}`} className="tag" style={{marginRight:6}}>{d.relationship} {d.targetId}</Link>):"—"}</dd></div><div className="kv"><dt>Methodology</dt><dd><Link href={`/methodology/${r.methodologyVersion}`}>{r.methodologyVersion}</Link></dd></div></div></section>
    <div className="notice" style={{marginTop:24}}>Independent assessment. Not financial advice. Ratings are model outputs over published inputs and are comparable only within one methodology version.</div>
  </div>
}
/** Ratio at which the riskiest borrower bucket (0.96 of LLTV) reaches the liquidation threshold. */
function lltvFloor(inputs:Input[]){const lltv=numberInput(inputs,"liquidation_ltv");return lltv?0.96:null}
function numberInput(inputs:Input[],key:string){const v=inputs.find(x=>x.key===key)?.value;return typeof v==="number"?v:null}
function fmt(v:number,unit:string){if(unit==="USD")return usd(v);if(unit==="ratio"||unit==="fraction"||unit==="annual"||unit==="annualized")return v<0.01?`${(v*100).toFixed(3)}%`:`${(v*100).toFixed(2)}%`;if(unit==="days")return v.toFixed(2);if(unit==="per year")return v.toFixed(2);if(unit==="log drop")return v.toFixed(2);return String(v)}
