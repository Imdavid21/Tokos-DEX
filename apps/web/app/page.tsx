import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {usd} from "@/lib/format";
import {BANDS,GRADES,gradeClass,psl,signedPct,type Action,type Rating,type Summary} from "@/lib/ratings";
import {PathField} from "@/components/PathField";
import {UniverseStrip} from "@/components/UniverseStrip";
import {Seal} from "@/components/Seal";
import {CountUp,Reveal} from "@/components/Motion";
import {Unavailable} from "@/components/DataState";
import {FrontierChart} from "@/components/FrontierChart";

export const revalidate=60;
type Frontier=Array<{id:string;name:string|null;assetSymbol:string|null;protocolName:string|null;grade:string;psl:number|null;supplyApy:number|null;riskAdjustedApy:number|null;supplyUsd:number|null}>;

export default async function Home(){
  const [summary,best,watch,actions,frontier]=await Promise.all([
    maybeApi<Summary>("/ratings/summary"),
    maybeApi<Rating[]>("/ratings?investmentGrade=true&sort=riskAdjustedApy&limit=8&minSupplyUsd=1000000"),
    maybeApi<Rating[]>("/ratings?sort=psl&order=desc&limit=8"),
    maybeApi<Action[]>("/ratings/actions?limit=12&days=90&action=initiate,upgrade,downgrade,withdraw"),
    maybeApi<Frontier>("/ratings/frontier")
  ]);
  const s=summary?.data;
  const totalSupply=s?.distribution.reduce((a,d)=>a+(d.supplyUsd??0),0)??0;
  const moves=(actions?.data??[]).slice(0,10);
  const ig=s?GRADES.slice(0,4).reduce((a,g)=>a+(s.distribution.find(d=>d.grade===g)?.supplyUsd??0),0):0;
  return <div className="page">
    <section className="hero">
      <div className="hero-copy">
        <h1 className="hero-title">Every lending market, <i>priced for what it could lose.</i></h1>
        <p className="hero-sub">Indenture simulates one year of collateral, liquidations and liquidity for every rated market and publishes the probability that a supplier loses more than 1% of principal. Every input is public, every run reproducible, and yield is shown net of expected loss.</p>
        <div className="hero-actions"><Link className="btn primary" href="/ratings">Explore rated markets</Link><Link className="btn" href="/methodology/indenture-psl-v1">Methodology</Link></div>
      </div>
      <PathField/>
    </section>

    {!s?<section className="section"><Unavailable title="Ratings are not available yet" detail="The rating worker has not completed a run against this database. Nothing is substituted."/></section>:<>
    <Reveal as="section" className="section"><div className="metrics">
      <M l="Rated markets" v={<CountUp value={s.graded}/>} m={`${(s.rated-s.graded).toLocaleString()} withheld on coverage`}/>
      <M l="Rated supply" v={<CountUp value={s.ratedSupplyUsd??0} kind="usd"/>} m={`${totalSupply>0?Math.round((ig/totalSupply)*100):0}% investment grade`}/>
      <M l="Protocols / networks" v={`${s.protocols} / ${s.chains}`} m={`${s.assets} loan assets`}/>
      <M l="Watch or negative" v={<CountUp value={s.watch}/>} m="outlook flags" signal={s.watch>0}/>
      <M l="Grade moves, 30 days" v={<CountUp value={(s.actions30d.upgrade??0)+(s.actions30d.downgrade??0)}/>} m={`${s.actions30d.upgrade??0} up | ${s.actions30d.downgrade??0} down`}/>
    </div></Reveal>

    <Reveal as="section" className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">01</span>The rated universe</h2><div className="page-sub">Every graded market placed on the annual loss probability axis. Tick height follows supply. Hover a tick, click to open the rating.</div></div><Link className="btn" href="/scale">Scale and bands</Link></div>
      {frontier?.data?.length?<UniverseStrip points={frontier.data}/>:<Unavailable title="No graded markets"/>}
      <div className="strip-legend" style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:12}}>{[...GRADES,"NR"].map(g=>{const d=s.distribution.find(x=>x.grade===g);if(!d?.markets)return null;const b=BANDS.find(x=>x.grade===g);return <div key={g} style={{display:"flex",alignItems:"center",gap:8}}><span className={`grade ${gradeClass(g)}`}>{g}</span><span className="subtle">{d.markets} | {usd(d.supplyUsd)}{b?` | ${(b.lower*100).toFixed(1)}%${b.upper==null?"+":" to "+(b.upper*100).toFixed(1)+"%"}`:""}</span></div>})}</div>
    </Reveal>

    <Reveal as="section" className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">02</span>Yield against risk</h2><div className="page-sub">Supply APY against annual PSL on a log scale. Up and left is better. Point size is supply.</div></div><Link className="btn" href="/frontier">Open the frontier</Link></div>
      {frontier?.data?.length?<FrontierChart points={frontier.data} height={340}/>:<Unavailable title="No frontier yet"/>}
    </Reveal>

    <section className="section grid-2">
      <Reveal index={0}><Table title="Best net yield, investment grade" note="APY minus expected loss" link="/ratings?investmentGrade=true&sort=riskAdjustedApy" rows={best?.data??[]} col="riskAdjustedApy"/></Reveal>
      <Reveal index={1}><Table title="Highest loss probability" note="markets to watch" link="/ratings?sort=psl&order=desc" rows={watch?.data??[]} col="psl"/></Reveal>
    </section>

    <Reveal as="section" className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">05</span>Grade changes</h2><div className="page-sub">Initiations, upgrades and downgrades, each with the driver behind it. Outlook moves live on the actions page.</div></div><Link className="btn" href="/actions">All actions</Link></div>
      <div className="table-wrap"><table className="data"><thead><tr><th>When</th><th>Action</th><th>Market</th><th>Protocol</th><th>From</th><th>To</th><th className="num">PSL</th><th>Reason</th></tr></thead><tbody>{moves.length?moves.map(a=><tr key={a.id}><td className="subtle">{new Date(a.observedAt).toISOString().slice(0,10)}</td><td><span className={`action-pill ${a.action}`}>{a.action}</span></td><td className="identity"><Link href={`/ratings/market/${encodeURIComponent(a.entityId)}`}>{a.market.name??a.entityId}</Link></td><td>{a.market.protocolName??"—"}</td><td>{a.fromGrade?<span className={`grade ${gradeClass(a.fromGrade)}`}>{a.fromGrade}</span>:<span className="subtle">—</span>}</td><td><span className={`grade ${gradeClass(a.toGrade)}`}>{a.toGrade}</span></td><td className="num">{psl(a.toPsl)}</td><td className="subtle" style={{whiteSpace:"normal",maxWidth:460}}>{a.reason}</td></tr>):<tr><td colSpan={8} className="subtle">No grade changes in the window</td></tr>}</tbody></table></div>
    </Reveal>
    </>}
  </div>
}

function M({l,v,m,signal=false}:{l:string;v:React.ReactNode;m?:string;signal?:boolean}){return <div className="metric"><div className="metric-label">{l}</div><div className="metric-value" style={signal?{color:"var(--ember)"}:undefined}>{v}</div>{m&&<div className="metric-meta">{m}</div>}</div>}
function Table({title,note,link,rows,col}:{title:string;note:string;link:string;rows:Rating[];col:"riskAdjustedApy"|"psl"}){
  return <div className="panel"><div className="panel-head"><span className="panel-title">{title}</span><Link href={link} className="panel-note">{note} →</Link></div><div className="table-wrap" style={{border:0,borderRadius:0}}><table className="data" style={{minWidth:0}}><thead><tr><th>Grade</th><th>Market</th><th className="num">APY</th><th className="num">{col==="psl"?"PSL":"Net yield"}</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.entityId}><td><Seal grade={r.grade} psl={r.psl}/></td><td className="identity"><Link href={`/ratings/market/${encodeURIComponent(r.entityId)}`}>{r.market.name}</Link><span className="subtle" style={{display:"block"}}>{r.market.chainName} | <span className={`outlook ${r.outlook}`}>{r.outlook}</span></span></td><td className="num">{signedPct(r.supplyApy)}</td><td className="num">{col==="psl"?psl(r.psl):signedPct(r.riskAdjustedApy)}</td></tr>):<tr><td colSpan={4} className="subtle">No rows</td></tr>}</tbody></table></div></div>
}
