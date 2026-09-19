import{maybeApi}from"@/lib/api";import{Unavailable}from"@/components/DataState";import{pct,usd}from"@/lib/format";
export const metadata={title:"Scenarios"};
type R={market:{id:string;name:string};inputs:Record<string,unknown>;baseline:{rate:number|null;liquidityUsd:number|null;utilization:number|null};stressed:{rate:number|null;liquidityUsd:number|null;utilization:number|null;notionalCapacity:number|null};note:string};
type Market={id:string;marketName:string;assetSymbol:string|null;protocolName:string|null;chainName:string|null;liquidityUsd:number|null;fixedApy:number|null;impliedApy:number|null;supplyApr:number|null};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const s=await searchParams,id=one(s.market)??"",rateBps=finite(one(s.rateShockBps),-200),liqPercent=finite(one(s.liquidityShockPercent),-50),notional=finite(one(s.notionalUsd),100000),liqDecimal=liqPercent/100;
 const markets=await maybeApi<Market[]>("/analytics/markets?limit=250"),options=[...(markets?.data??[])].sort((a,b)=>(b.liquidityUsd??0)-(a.liquidityUsd??0));
 const r=id?await maybeApi<R>(`/risk/markets/${encodeURIComponent(id)}/scenario?rateShockBps=${rateBps}&liquidityShockPct=${liqDecimal}&notionalUsd=${notional}`):null;
 const baselineRate=r?.data.baseline.rate??null,stressedRate=r?.data.stressed.rate??null,baselineLiq=r?.data.baseline.liquidityUsd??null,stressedLiq=r?.data.stressed.liquidityUsd??null;
 const yieldDelta=baselineRate!=null&&stressedRate!=null?(stressedRate-baselineRate)*10000:null,liqDelta=baselineLiq!=null&&stressedLiq!=null&&baselineLiq>0?(stressedLiq/baselineLiq-1):null;
 const liqCoverage=stressedLiq!=null&&notional>0?stressedLiq/notional:null,notionalShare=stressedLiq!=null&&stressedLiq>0?notional/stressedLiq:null;
 const yieldScale=Math.max(Math.abs(baselineRate??0),Math.abs(stressedRate??0),0.0001),baselineYieldWidth=clampPct((baselineRate??0)/yieldScale),stressedYieldWidth=clampPct((stressedRate??0)/yieldScale);
 const liqScale=Math.max(baselineLiq??0,stressedLiq??0,1),baselineLiqWidth=clampPct((baselineLiq??0)/liqScale),stressedLiqWidth=clampPct((stressedLiq??0)/liqScale);
 return <div className="page">
  <div className="page-head"><div><h1 className="page-title">Stress Testing</h1><div className="page-sub">Apply deterministic shocks to live market data and see the impact before allocating capital.</div></div></div>
  <form className="scenario-controls">
   <label className="scenario-market"><span>Market</span><select className="select" name="market" defaultValue={id}><option value="">Choose market</option>{options.map(m=><option key={m.id} value={m.id}>{[m.assetSymbol??m.marketName,m.protocolName,m.chainName,pct(m.fixedApy??m.impliedApy??m.supplyApr)].filter(Boolean).join(" · ")}</option>)}</select></label>
   <label className="scenario-field"><span>Yield shock</span><div className="scenario-input"><input name="rateShockBps" type="number" step="25" defaultValue={rateBps}/><b>bps</b></div><small>Change to current annualized yield</small></label>
   <label className="scenario-field"><span>Liquidity shock</span><div className="scenario-input"><input name="liquidityShockPercent" type="number" step="5" min="-100" defaultValue={liqPercent}/><b>%</b></div><small>Change to available market liquidity</small></label>
   <label className="scenario-field"><span>Position size</span><div className="scenario-input"><b>$</b><input name="notionalUsd" type="number" step="10000" min="1" defaultValue={notional}/></div><small>Capital you want to deploy</small></label>
   <button className="btn primary scenario-run">Run stress test</button>
  </form>
  {!r?<Unavailable title={id?"Scenario unavailable":"Choose a market"} detail={id?"Live scenario data is unavailable for this market.":"Select a market to model yield, liquidity, and capacity under stress."}/>:<>
   <div className="scenario-summary section">
    <div><span>Yield change</span><strong>{yieldDelta==null?"—":signedBps(yieldDelta)}</strong></div>
    <div><span>Liquidity change</span><strong>{liqDelta==null?"—":signedPct(liqDelta)}</strong></div>
    <div><span>Position</span><strong>{usd(notional)}</strong></div>
    <div><span>Stressed liquidity coverage</span><strong>{liqCoverage==null?"—":`${liqCoverage.toFixed(liqCoverage>=100?0:1)}×`}</strong></div>
   </div>
   <div className="scenario-grid section">
    <section className="scenario-panel"><div className="scenario-panel-head"><div><h2>Yield impact</h2><p>Annualized market yield before and after the shock.</p></div><strong>{yieldDelta==null?"—":signedBps(yieldDelta)}</strong></div>
     <ComparisonRow label="Baseline" value={pct(baselineRate)} width={baselineYieldWidth}/>
     <ComparisonRow label="Stressed" value={pct(stressedRate)} width={stressedYieldWidth} stressed/>
    </section>
    <section className="scenario-panel"><div className="scenario-panel-head"><div><h2>Liquidity impact</h2><p>Available liquidity remaining after the selected shock.</p></div><strong>{liqDelta==null?"—":signedPct(liqDelta)}</strong></div>
     <ComparisonRow label="Baseline" value={usd(baselineLiq)} width={baselineLiqWidth}/>
     <ComparisonRow label="Stressed" value={usd(stressedLiq)} width={stressedLiqWidth} stressed/>
    </section>
   </div>
   <section className="scenario-capacity section">
    <div className="scenario-panel-head"><div><h2>Position capacity</h2><p>How large your requested position is relative to stressed market liquidity.</p></div><strong>{notionalShare==null?"—":pct(notionalShare,2)}</strong></div>
    <div className="capacity-track"><div className="capacity-fill" style={{width:`${Math.min(100,Math.max(0,(notionalShare??0)*100))}%`}}/></div>
    <div className="capacity-scale"><span>{usd(notional)} position</span><span>{usd(stressedLiq)} stressed liquidity</span></div>
   </section>
   <div className="notice section">{r.data.note} Utilization is excluded because the current live-provider path has no normalized utilization baseline for this market.</div>
  </>}
 </div>
}
function one(v:string|string[]|undefined){return Array.isArray(v)?v[0]:v}
function finite(v:string|undefined,fallback:number){const n=Number(v);return Number.isFinite(n)?n:fallback}
function clampPct(v:number){return Math.max(2,Math.min(100,Math.abs(v)*100))}
function signedBps(v:number){return `${v>0?"+":""}${Math.round(v).toLocaleString()} bps`}
function signedPct(v:number){return `${v>0?"+":""}${(v*100).toFixed(1)}%`}
function ComparisonRow({label,value,width,stressed=false}:{label:string;value:string;width:number;stressed?:boolean}){return <div className="scenario-row"><div className="scenario-row-meta"><span>{label}</span><strong>{value}</strong></div><div className="scenario-track"><div className={`scenario-fill ${stressed?"stressed":""}`} style={{width:`${width}%`}}/></div></div>}
