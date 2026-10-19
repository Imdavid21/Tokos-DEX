import Link from "next/link";
import {maybeApi} from "@/lib/api";
import {usd} from "@/lib/format";
import {BANDS,GRADES,gradeClass,psl,rampClass,signedPct,type Action,type Rating,type Summary} from "@/lib/ratings";
import {Glyphs} from "@/components/Glyphs";
import {Unavailable} from "@/components/DataState";
import {FrontierChart} from "@/components/FrontierChart";

export const revalidate=60;
type Frontier=Array<{id:string;name:string|null;assetSymbol:string|null;protocolName:string|null;grade:string;psl:number|null;supplyApy:number|null;riskAdjustedApy:number|null;supplyUsd:number|null}>;

export default async function Home(){
  const [summary,best,watch,actions,frontier]=await Promise.all([
    maybeApi<Summary>("/ratings/summary"),
    maybeApi<Rating[]>("/ratings?investmentGrade=true&sort=riskAdjustedApy&limit=8&minSupplyUsd=1000000"),
    maybeApi<Rating[]>("/ratings?sort=psl&order=desc&limit=8"),
    maybeApi<Action[]>("/ratings/actions?limit=10&days=90"),
    maybeApi<Frontier>("/ratings/frontier")
  ]);
  const s=summary?.data;
  const totalSupply=s?.distribution.reduce((a,d)=>a+(d.supplyUsd??0),0)??0;
  const maxCount=Math.max(1,...(s?.distribution.map(d=>d.markets)??[1]));
  return <div className="page">
    <section className="hero"><Glyphs/><div className="hero-inner">
      <div className="hero-kicker">Open loss-probability ratings for onchain credit</div>
      <h1 className="hero-title">Yield tells you what you might earn.<br/><i>Indenture tells you what you might lose.</i></h1>
      <div className="hero-sub">Daily probability of significant loss for every rated lending market.<br/>Every input public. Every run reproducible. Never paid for by the rated party.</div>
      <div className="hero-actions"><Link className="btn primary" href="/ratings">Explore rated markets</Link><Link className="btn" href="/methodology/indenture-psl-v1">Read the methodology</Link></div>
    </div></section>

    {!s?<section className="section"><Unavailable title="Ratings are not available yet" detail="The rating worker has not completed a run against this database. Nothing is substituted."/></section>:<>
    <section className="section"><div className="metrics">
      <M l="Rated markets" v={s.graded.toLocaleString()} m={`${(s.rated-s.graded).toLocaleString()} not rated on coverage`}/>
      <M l="Rated supply" v={usd(s.ratedSupplyUsd)} m="deposits across graded markets"/>
      <M l="Protocols / networks" v={`${s.protocols} / ${s.chains}`} m={`${s.assets} loan assets`}/>
      <M l="On watch or negative" v={s.watch.toLocaleString()} m="outlook flags" signal={s.watch>0}/>
      <M l="Actions, 30 days" v={Object.values(s.actions30d).reduce((a,b)=>a+b,0).toLocaleString()} m={Object.entries(s.actions30d).map(([k,v])=>`${v} ${k}`).join(" · ")||"none"}/>
    </div></section>

    <section className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">01</span>The rated universe</h2><div className="page-sub">Markets by grade. Each column is a published annual PSL band, lower edge inclusive. Bars share one maximum.</div></div><Link className="btn" href="/scale">Scale and bands</Link></div>
      <div className="ramp">{[...GRADES,"NR"].map(g=>{const d=s.distribution.find(x=>x.grade===g);const band=BANDS.find(b=>b.grade===g);const n=d?.markets??0;return <div key={g} className={`ramp-cell ${rampClass(g)}`}><span className={`grade ${gradeClass(g)}`}>{g}</span><div className="ramp-bar"><i style={{height:`${Math.max(1,(n/maxCount)*100)}%`}}/></div><div className="ramp-n">{n}</div><div className="ramp-sub">{usd(d?.supplyUsd??null)}{totalSupply>0&&d?.supplyUsd?` · ${((d.supplyUsd/totalSupply)*100).toFixed(0)}%`:""}</div><div className="ramp-band">{band?`${(band.lower*100).toFixed(1)}%${band.upper==null?"+":` to ${(band.upper*100).toFixed(1)}%`}`:"coverage < 50%"}</div></div>})}</div>
    </section>

    <section className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">02</span>Yield against risk</h2><div className="page-sub">Supply APY against annual PSL for every graded market. Up and left is better. Point size is supply.</div></div><Link className="btn" href="/frontier">Open the frontier</Link></div>
      {frontier?.data?.length?<FrontierChart points={frontier.data} height={340}/>:<Unavailable title="No frontier yet"/>}
    </section>

    <section className="section grid-2">
      <Table title="03 · Best risk-adjusted yield, investment grade" note="APY minus expected loss, supply over $1M" link="/ratings?investmentGrade=true&sort=riskAdjustedApy" rows={best?.data??[]} col="riskAdjustedApy"/>
      <Table title="04 · Highest loss probability" note="markets to watch" link="/ratings?sort=psl&order=desc" rows={watch?.data??[]} col="psl"/>
    </section>

    <section className="section"><div className="section-bar"><div><h2 className="section-title"><span className="idx">05</span>Latest rating actions</h2><div className="page-sub">Initiations, upgrades, downgrades and outlook changes, with the driver behind each one.</div></div><Link className="btn" href="/actions">All actions</Link></div>
      <div className="table-wrap"><table className="data"><thead><tr><th>When</th><th>Action</th><th>Market</th><th>Protocol</th><th>From</th><th>To</th><th className="num">PSL</th><th>Reason</th></tr></thead><tbody>{(actions?.data??[]).map(a=><tr key={a.id}><td className="subtle">{new Date(a.observedAt).toISOString().slice(0,10)}</td><td><span className={`action-pill ${a.action}`}>{a.action}</span></td><td className="identity"><Link href={`/ratings/market/${encodeURIComponent(a.entityId)}`}>{a.market.name??a.entityId}</Link></td><td>{a.market.protocolName??"—"}</td><td>{a.fromGrade?<span className={`grade ${gradeClass(a.fromGrade)}`}>{a.fromGrade}</span>:<span className="subtle">—</span>}</td><td><span className={`grade ${gradeClass(a.toGrade)}`}>{a.toGrade}</span></td><td className="num">{psl(a.toPsl)}</td><td className="subtle" style={{whiteSpace:"normal",maxWidth:420}}>{a.reason}</td></tr>)}</tbody></table></div>
    </section>
    </>}
  </div>
}

function M({l,v,m,signal=false}:{l:string;v:string;m?:string;signal?:boolean}){return <div className="metric"><div className="metric-label">{l}</div><div className="metric-value" style={signal?{color:"var(--signal)"}:undefined}>{v}</div>{m&&<div className="metric-meta">{m}</div>}</div>}
function Table({title,note,link,rows,col}:{title:string;note:string;link:string;rows:Rating[];col:"riskAdjustedApy"|"psl"}){
  return <div className="panel"><div className="panel-head"><span className="panel-title">{title}</span><Link href={link} className="panel-note">{note} →</Link></div><div className="table-wrap" style={{border:0}}><table className="data" style={{minWidth:0}}><thead><tr><th>Grade</th><th>Market</th><th className="num">APY</th><th className="num">{col==="psl"?"PSL":"Net yield"}</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.entityId}><td><span className={`grade ${gradeClass(r.grade)}`}>{r.grade}</span></td><td className="identity"><Link href={`/ratings/market/${encodeURIComponent(r.entityId)}`}>{r.market.name}</Link><span className="subtle" style={{display:"block"}}>{r.market.chainName}</span></td><td className="num">{signedPct(r.supplyApy)}</td><td className="num">{col==="psl"?psl(r.psl):signedPct(r.riskAdjustedApy)}</td></tr>):<tr><td colSpan={4} className="subtle">No rows</td></tr>}</tbody></table></div></div>
}
