/**
 * Serves the precomputed demonstration universe (lib/mock-ratings.json) through the same envelope shape as the
 * data API, so every page runs end to end without a backend. Active when MOCK_RATINGS=1 or when the API is unreachable.
 */
import data from "./mock-ratings.json";
import {BANDS,GRADES,INVESTMENT_GRADE} from "./ratings";

type Envelope<T>={data:T;meta:{asOf:string;stale:boolean;requestId:string;nextCursor?:string|null;hasMore?:boolean;demo?:boolean}};
type Market=(typeof data.markets)[number];
const markets=data.markets as unknown as Array<Market&{grade:string;outlook:string;psl:number;pslLow:number;pslHigh:number;expectedLoss:number;supplyApy:number|null;riskAdjustedApy:number|null;coverage:number;computedAt:string;market:{id:string;name:string;protocolSlug:string;protocolId:string;chainId:string;assetSymbol:string;assetId:string;protocolName:string;chainName:string;supplyUsd:number;liquidityUsd:number}}>;
const actions=data.actions as Array<{id:string;entityId:string;action:string;observedAt:string;notches:number;toGrade:string;toPsl:number}&Record<string,unknown>>;
export const MOCK_GENERATED_AT=data.generatedAt;
export const isMockForced=()=>process.env.MOCK_RATINGS==="1"||process.env.NEXT_PUBLIC_MOCK_RATINGS==="1";

const env=<T,>(d:T,extra:Partial<Envelope<T>["meta"]>={}):Envelope<T>=>({data:d,meta:{asOf:markets[0]?.computedAt??new Date().toISOString(),stale:false,requestId:"demo",demo:true,...extra}});
const SORTS:Record<string,(a:(typeof markets)[number],b:(typeof markets)[number])=>number>={
  riskAdjustedApy:(a,b)=>(b.riskAdjustedApy??-1)-(a.riskAdjustedApy??-1),psl:(a,b)=>a.psl-b.psl,grade:(a,b)=>a.psl-b.psl,apy:(a,b)=>(b.supplyApy??-1)-(a.supplyApy??-1),
  supply:(a,b)=>(b.market.supplyUsd??0)-(a.market.supplyUsd??0),liquidity:(a,b)=>(b.market.liquidityUsd??0)-(a.market.liquidityUsd??0),expectedLoss:(a,b)=>a.expectedLoss-b.expectedLoss,updated:(a,b)=>b.computedAt.localeCompare(a.computedAt)};

export function mockApi<T>(path:string):Envelope<T>|null{
  const u=new URL(path,"https://indenture.local");const p=u.pathname;const q=u.searchParams;
  if(p==="/ratings/scale")return env({methodologyVersion:"indenture-psl-v1",lossThreshold:0.01,horizonDays:365,investmentGrade:INVESTMENT_GRADE,bands:BANDS.map(b=>({grade:b.grade,label:b.label,lowerPsl:b.lower,upperPsl:b.upper}))} as T);
  if(p==="/ratings/summary"){
    const graded=markets.filter(m=>m.grade!=="NR");const since=Date.now()-30*86400000;
    const distribution=[...GRADES,"NR"].map(g=>{const rows=markets.filter(m=>m.grade===g);return{grade:g,markets:rows.length,supplyUsd:rows.reduce((a,m)=>a+(m.market.supplyUsd??0),0),avgPsl:rows.length?rows.reduce((a,m)=>a+m.psl,0)/rows.length:null,avgRiskAdjustedApy:rows.length?rows.reduce((a,m)=>a+(m.riskAdjustedApy??0),0)/rows.length:null}});
    const actions30d=actions.filter(a=>new Date(a.observedAt).getTime()>=since).reduce<Record<string,number>>((acc,a)=>{acc[a.action]=(acc[a.action]??0)+1;return acc},{});
    return env({methodologyVersion:"indenture-psl-v1",rated:markets.length,graded:graded.length,protocols:new Set(markets.map(m=>m.market.protocolSlug)).size,chains:new Set(markets.map(m=>m.market.chainId)).size,assets:new Set(markets.map(m=>m.market.assetSymbol)).size,ratedSupplyUsd:markets.reduce((a,m)=>a+(m.market.supplyUsd??0),0),watch:markets.filter(m=>m.outlook==="watch"||m.outlook==="negative").length,distribution,actions30d} as T);
  }
  if(p==="/ratings/actions"){const limit=Number(q.get("limit")??50),days=Number(q.get("days")??90),filter=q.get("action")?.split(",");const since=Date.now()-days*86400000;return env(actions.filter(a=>new Date(a.observedAt).getTime()>=since&&(!filter||filter.includes(a.action))).slice(0,limit) as T)}
  if(p==="/ratings/frontier")return env(markets.filter(m=>m.grade!=="NR"&&m.supplyApy!=null).sort(SORTS.riskAdjustedApy!).map(m=>({id:m.entityId,name:m.market.name,assetSymbol:m.market.assetSymbol,protocolName:m.market.protocolName,chainName:m.market.chainName,grade:m.grade,psl:m.psl,supplyApy:m.supplyApy,expectedLoss:m.expectedLoss,riskAdjustedApy:m.riskAdjustedApy,supplyUsd:m.market.supplyUsd})) as T);
  if(p==="/ratings"){
    let rows=[...markets];
    const grades=q.get("grades")?.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);if(grades?.length)rows=rows.filter(m=>grades.includes(m.grade));
    if(q.get("investmentGrade")==="true")rows=rows.filter(m=>(INVESTMENT_GRADE as string[]).includes(m.grade));
    if(q.get("outlook"))rows=rows.filter(m=>m.outlook===q.get("outlook"));
    if(q.get("protocol"))rows=rows.filter(m=>m.market.protocolSlug===q.get("protocol")||m.market.protocolId===q.get("protocol"));
    if(q.get("chains"))rows=rows.filter(m=>q.get("chains")!.split(",").includes(m.market.chainId));
    if(q.get("asset"))rows=rows.filter(m=>m.market.assetSymbol.toLowerCase()===q.get("asset")!.toLowerCase()||m.market.assetId===q.get("asset"));
    if(q.get("minSupplyUsd"))rows=rows.filter(m=>(m.market.supplyUsd??0)>=Number(q.get("minSupplyUsd")));
    if(q.get("maxPsl"))rows=rows.filter(m=>m.psl<=Number(q.get("maxPsl")));
    if(q.get("q")){const s=q.get("q")!.toLowerCase();rows=rows.filter(m=>m.market.name.toLowerCase().includes(s)||m.market.assetSymbol.toLowerCase().includes(s)||m.market.protocolName.toLowerCase().includes(s))}
    const key=q.get("sort")??"riskAdjustedApy";const sort=SORTS[key]??SORTS.riskAdjustedApy!;rows.sort(sort);const natural=["psl","grade","expectedLoss"].includes(key)?"asc":"desc";if(q.get("order")&&q.get("order")!==natural)rows.reverse();
    const limit=Number(q.get("limit")??100);
    return env(rows.slice(0,limit).map(m=>{const copy:Record<string,unknown>={...m};delete copy.run;delete copy.history;delete copy.dependencies;return copy}) as T,{hasMore:rows.length>limit,nextCursor:null});
  }
  const detail=p.match(/^\/ratings\/market\/(.+?)(\/rerun)?$/);
  if(detail&&!detail[2]){const id=decodeURIComponent(detail[1]!);const m=markets.find(x=>x.entityId===id);if(!m)return null;return env({...m,actions:actions.filter(a=>a.entityId===id).slice(0,100)} as T)}
  return null;
}

export function mockFacts(id:string){const m=markets.find(x=>x.entityId===id);return m?(m.run as {inputs:{facts:unknown}}).inputs.facts:null}
