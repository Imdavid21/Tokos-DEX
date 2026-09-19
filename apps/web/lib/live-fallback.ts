import{resolveUnderlyingPath}from"./underlyings";
import{chainLabel}from"./chains";
type Envelope<T>={data:T;meta:{asOf:string;stale:boolean;requestId:string;nextCursor?:string|null;hasMore?:boolean}};

type TokenObject={address?:string|undefined;symbol?:string|undefined;name?:string|undefined;decimals?:number|undefined;price?:{usd?:number|null}|undefined};
type Token=TokenObject|string;
type PendleDetails={liquidity?:number|null;totalTvl?:number|null;tradingVolume?:number|null;underlyingApy?:number|null;impliedApy?:number|null};
type PendleMarket={chainId:string|number;address:string;expiry:string|number;impliedApy?:number|null;underlyingApy?:number|null;tvl?:{usd?:number|null};liquidity?:{usd?:number|null};volume24h?:{usd?:number|null};details?:PendleDetails;pt?:Token|undefined;yt?:Token|undefined;sy?:Token|undefined;underlyingAsset?:Token|undefined;name?:string;protocol?:string};
type Page={total?:number;totalCount?:number;markets?:PendleMarket[];results?:PendleMarket[];data?:{total?:number;totalCount?:number;markets?:PendleMarket[];results?:PendleMarket[]}};
type AssetMeta={chainId:string|number;address:string;symbol:string;name?:string};
type AssetPage={assets?:AssetMeta[];data?:{assets?:AssetMeta[]}};
type HistoricalPoint={timestamp:string;maxApy?:number|null;baseApy?:number|null;underlyingApy?:number|null;impliedApy?:number|null;tvl?:number|null};
type HistoricalPage={results?:HistoricalPoint[]};
type MarketHistory={market:PendleMarket;points:HistoricalPoint[]};

const PENDLE=(process.env.PENDLE_API_BASE_URL??"https://api-v2.pendle.finance/core").replace(/\/$/,"");
const slug=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const assetGroup=(s:string)=>{const x=s.toUpperCase();if(["USDC","USDBC"].includes(x))return"usdc";if(["USDT","USD₮0"].includes(x))return"usdt";if(["ETH","WETH"].includes(x))return"eth";if(["BTC","WBTC","CBBTC","TBTC"].includes(x))return"btc";if(["USDE","SUSDE"].includes(x))return"usde";return slug(x)};
const toMs=(x:string|number)=>typeof x==="number"?(x>1e12?x:x*1000):(/^\d+(?:\.\d+)?$/.test(x)?Number(x)*(Number(x)>1e12?1:1000):Date.parse(x));
const num=(x:unknown)=>typeof x==="number"&&Number.isFinite(x)?x:null;
const tokenSymbol=(t:Token|undefined)=>typeof t==="object"&&t!==null?t.symbol:undefined;
const impliedApyOf=(m:PendleMarket)=>num(m.impliedApy)??num(m.details?.impliedApy);
const underlyingApyOf=(m:PendleMarket)=>num(m.underlyingApy)??num(m.details?.underlyingApy);
const tvlOf=(m:PendleMarket)=>num(m.tvl?.usd)??num(m.details?.totalTvl);
const liquidityOf=(m:PendleMarket)=>num(m.liquidity?.usd)??num(m.details?.liquidity);

function pageRows(j:Page){return j.markets??j.results??j.data?.markets??j.data?.results??[]}
function pageTotal(j:Page){return j.total??j.totalCount??j.data?.total??j.data?.totalCount}
async function fetchPage(skip:number,limit:number){const r=await fetch(`${PENDLE}/v2/markets/all?limit=${limit}&skip=${skip}`,{headers:{accept:"application/json"},next:{revalidate:60}});if(!r.ok)throw new Error(`Pendle ${r.status}`);return await r.json() as Page}
async function assetMetadata(){try{const r=await fetch(`${PENDLE}/v1/assets/all`,{headers:{accept:"application/json"},next:{revalidate:300}});if(!r.ok)return new Map<string,AssetMeta>();const j=await r.json() as AssetPage,assets=j.assets??j.data?.assets??[];return new Map(assets.map(a=>[`${a.chainId}:${a.address.toLowerCase()}`,a] as const))}catch{return new Map<string,AssetMeta>()}}
function enrichToken(chainId:string|number,t:Token|undefined,assets:Map<string,AssetMeta>):Token|undefined{if(!t)return t;const raw=typeof t==="string"?t:t.address;if(!raw)return t;const address=raw.includes("-0x")?raw.slice(raw.indexOf("0x")):raw,meta=assets.get(`${chainId}:${address.toLowerCase()}`);if(!meta)return typeof t==="string"?{address}:t;return{...(typeof t==="object"?t:{}),address,symbol:meta.symbol,name:meta.name}}
async function markets(){const limit=100,first=await fetchPage(0,limit),firstRows=pageRows(first),total=pageTotal(first)??firstRows.length;const offsets=[];for(let skip=limit;skip<total;skip+=limit)offsets.push(skip);const [rest,assets]=await Promise.all([offsets.length?Promise.all(offsets.map(skip=>fetchPage(skip,limit))):[],assetMetadata()]);const all=[...firstRows,...rest.flatMap(pageRows)].map(m=>({...m,pt:enrichToken(m.chainId,m.pt,assets),yt:enrichToken(m.chainId,m.yt,assets),sy:enrichToken(m.chainId,m.sy,assets),underlyingAsset:enrichToken(m.chainId,m.underlyingAsset,assets)})),now=Date.now();return all.filter(m=>m?.address&&Number.isFinite(toMs(m.expiry))&&toMs(m.expiry)>now)}
function symbolOf(m:PendleMarket){return tokenSymbol(m.underlyingAsset)??tokenSymbol(m.sy)??tokenSymbol(m.pt)?.replace(/^PT-/,"")??m.name?.replace(/^PT[- ]/i,"")??"UNKNOWN"}
function nameOf(m:PendleMarket){return m.name??tokenSymbol(m.pt)??`Pendle ${symbolOf(m)}`}
function protocolNameOf(m:PendleMarket){return m.protocol?.trim()||"Pendle"}
function protocolIdOf(m:PendleMarket){return slug(protocolNameOf(m))||"pendle"}
function idOf(m:PendleMarket){return `pendle:${m.chainId}:${m.address.toLowerCase()}`}
function maturityOf(m:PendleMarket){return new Date(toMs(m.expiry)).toISOString()}
function chainName(id:string){return chainLabel(id)}
function median(v:number[]){if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]??null:((s[i-1]??0)+(s[i]??0))/2}
function std(v:number[]){if(v.length<2)return null;const mean=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/(v.length-1))}
function historyRef(p:HistoricalPoint){const underlying=num(p.underlyingApy);return underlying!=null&&underlying!==0?underlying:num(p.baseApy)}
function queryDays(path:string){try{const raw=Number(new URL(path,"https://tokos.local").searchParams.get("days")??30);return[7,30,90,365].includes(raw)?raw:30}catch{return 30}}

async function fetchHistory(m:PendleMarket,days:number):Promise<HistoricalPoint[]>{try{const end=new Date(),start=new Date(end.getTime()-Math.max(days,8)*86400000);const url=`${PENDLE}/v3/${m.chainId}/markets/${m.address}/historical-data?time_frame=day&timestamp_start=${encodeURIComponent(start.toISOString())}&timestamp_end=${encodeURIComponent(end.toISOString())}`;const r=await fetch(url,{headers:{accept:"application/json"},next:{revalidate:300}});if(!r.ok)return[];const j=await r.json() as HistoricalPage;return(j.results??[]).filter(p=>p.timestamp&&num(p.impliedApy)!=null).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp))}catch{return[]}}
async function sampleHistory(rows:PendleMarket[],days:number){const sample=[...rows].filter(m=>impliedApyOf(m)!=null).sort((a,b)=>(liquidityOf(b)??0)-(liquidityOf(a)??0)).slice(0,8);return Promise.all(sample.map(async market=>({market,points:await fetchHistory(market,days)})))}
function pointAtOrBefore(points:HistoricalPoint[],target:number){let best:HistoricalPoint|undefined;for(const p of points){const t=Date.parse(p.timestamp);if(Number.isFinite(t)&&t<=target&&(!best||t>Date.parse(best.timestamp)))best=p}return best}
function changeBps(current:number|null,prior:HistoricalPoint|undefined){const old=prior?num(prior.impliedApy):null;return current!=null&&old!=null?(current-old)*10000:null}
function aggregateHistory(series:MarketHistory[]){const byDay=new Map<string,Array<{fixed:number;floating:number|null;tvl:number|null}>>();for(const {points} of series)for(const p of points){const fixed=num(p.impliedApy);if(fixed==null)continue;const day=new Date(p.timestamp).toISOString().slice(0,10),list=byDay.get(day)??[];list.push({fixed,floating:historyRef(p),tvl:num(p.tvl)});byDay.set(day,list)}return[...byDay.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,list])=>{const fixed=list.map(x=>x.fixed),floating=list.map(x=>x.floating).filter((x):x is number=>x!=null),weighted=list.filter(x=>(x.tvl??0)>0),den=weighted.reduce((a,x)=>a+(x.tvl??0),0),weightedYield=den?weighted.reduce((a,x)=>a+x.fixed*(x.tvl??0),0)/den:null;return{observedAt:`${day}T00:00:00.000Z`,medianYield:median(fixed),weightedYield,fixedYield:weightedYield??median(fixed),floatingYield:median(floating),borrowRate:null,tvlUsd:list.reduce((a,x)=>a+(x.tvl??0),0)||null,liquidityUsd:null,utilization:null}})}
function moverRows(series:MarketHistory[],asOf:string){const now=Date.parse(asOf);return series.map(({market,points})=>{const current=impliedApyOf(market),d1=changeBps(current,pointAtOrBefore(points,now-86400000)),d7=changeBps(current,pointAtOrBefore(points,now-7*86400000));return{id:idOf(market),assetSymbol:symbolOf(market),assetId:slug(symbolOf(market)),marketName:nameOf(market),protocolName:protocolNameOf(market),change24hBps:d1,change7dBps:d7,liquidityUsd:liquidityOf(market)}}).filter(x=>x.change24hBps!=null||x.change7dBps!=null).sort((a,b)=>Math.max(Math.abs(b.change24hBps??0),Math.abs(b.change7dBps??0))-Math.max(Math.abs(a.change24hBps??0),Math.abs(a.change7dBps??0))).slice(0,8)}

function overview(rows:PendleMarket[],asOf:string,series:MarketHistory[]){const rates=rows.map(impliedApyOf).filter((x):x is number=>x!==null),tvl=rows.reduce((a,m)=>a+(tvlOf(m)??0),0),liq=rows.reduce((a,m)=>a+(liquidityOf(m)??0),0),weightedDen=rows.reduce((a,m)=>a+(tvlOf(m)??0),0),weightedNum=rows.reduce((a,m)=>a+(tvlOf(m)??0)*(impliedApyOf(m)??0),0),assets=new Map<string,{symbol:string;value:number;markets:number}>(),chains=new Map<string,{name:string;value:number;markets:number}>(),protocols=new Map<string,{id:string;name:string;value:number;markets:number}>();for(const m of rows){const s=symbolOf(m),a=assets.get(s)??{symbol:s,value:0,markets:0};a.value+=tvlOf(m)??0;a.markets++;assets.set(s,a);const c=String(m.chainId),q=chains.get(c)??{name:chainName(c),value:0,markets:0};q.value+=tvlOf(m)??0;q.markets++;chains.set(c,q);const pid=protocolIdOf(m),p=protocols.get(pid)??{id:pid,name:protocolNameOf(m),value:0,markets:0};p.value+=tvlOf(m)??0;p.markets++;protocols.set(pid,p)}return{summary:{trackedTvl:tvl||null,totalDebt:null,liquidity:liq||null,medianYield:median(rates),weightedYield:weightedDen?weightedNum/weightedDen:null,bestYield:rates.length?Math.max(...rates):null,activeMarkets:rows.length,assets:assets.size,protocols:protocols.size,chains:chains.size},history:aggregateHistory(series),structure:{protocols:[...protocols.values()].map(x=>({protocol_id:x.id,protocol_name:x.name,value:x.value,markets:x.markets})),chains:[...chains.entries()].map(([id,x])=>({chain_id:id,chain_name:x.name,value:x.value,markets:x.markets})),assets:[...assets.values()].map(x=>({asset_group:assetGroup(x.symbol),asset_symbol:x.symbol,value:x.value,markets:x.markets}))},heatmap:rows.map(m=>({asset:symbolOf(m),protocol_id:protocolIdOf(m),protocol:protocolNameOf(m),rate:impliedApyOf(m),liquidity_usd:liquidityOf(m),tvl_usd:tvlOf(m),as_of:asOf})),landscape:rows.map(m=>({id:idOf(m),market_name:nameOf(m),protocol_id:protocolIdOf(m),protocol_name:protocolNameOf(m),chain_id:String(m.chainId),chain_name:chainName(String(m.chainId)),asset_symbol:symbolOf(m),asset_group:assetGroup(symbolOf(m)),maturity:maturityOf(m),rate:impliedApyOf(m),liquidity_usd:liquidityOf(m),tvl_usd:tvlOf(m),rate_type:"fixed",observed_at:asOf})),movers:moverRows(series,asOf)}}

function screener(rows:PendleMarket[],asOf:string,series:MarketHistory[]){const histories=new Map(series.map(x=>[idOf(x.market),x.points])),now=Date.parse(asOf);return rows.map(m=>{const maturity=maturityOf(m),days=Math.max(0,(new Date(maturity).getTime()-Date.now())/86400000),s=symbolOf(m),points=histories.get(idOf(m))??[],current=impliedApyOf(m),rates=points.map(p=>num(p.impliedApy)).filter((x):x is number=>x!=null),diffs=rates.slice(1).map((x,i)=>(x-(rates[i]??x))*10000),rank=current==null||!rates.length?null:rates.filter(x=>x<=current).length/rates.length;return{id:idOf(m),assetId:slug(s),assetSymbol:s,assetGroup:assetGroup(s),marketName:nameOf(m),protocolId:protocolIdOf(m),protocolName:protocolNameOf(m),chainId:String(m.chainId),chainName:chainName(String(m.chainId)),rateType:"fixed",supplyApr:null,borrowApr:null,fixedApy:current,impliedApy:current,underlyingApy:underlyingApyOf(m),rewardApr:null,liquidityUsd:liquidityOf(m),tvlUsd:tvlOf(m),depositsUsd:null,debtUsd:null,utilization:null,change24hBps:changeBps(current,pointAtOrBefore(points,now-86400000)),change7dBps:changeBps(current,pointAtOrBefore(points,now-7*86400000)),change30dBps:changeBps(current,pointAtOrBefore(points,now-30*86400000)),change1hBps:null,liquidityChange24h:null,tvlChange24h:null,utilizationChange24h:null,rateChangeVolatility30d:std(diffs),headlineEffectiveGapBps:null,volatility30d:std(rates),ratePercentile:rank,daysToMaturity:days,maturity,observedAt:asOf,stale:false,rateTrend:points.map(p=>[p.timestamp,num(p.impliedApy)])}})}

function marketDetail(m:PendleMarket,asOf:string,points:HistoricalPoint[]){
 const current=impliedApyOf(m),now=Date.parse(asOf),s=symbolOf(m),maturity=maturityOf(m);
 return{id:idOf(m),marketName:nameOf(m),assetId:slug(s),assetSymbol:s,protocolId:protocolIdOf(m),protocolName:protocolNameOf(m),chainId:String(m.chainId),chainName:chainName(String(m.chainId)),marketType:"yield",rateType:"fixed",provider:"pendle",providerMarketId:m.address,status:"active",executionModel:"pendle-market",maturity,observedAt:asOf,sourceObservedAt:asOf,ingestedAt:asOf,supplyApr:null,borrowApr:null,fixedApy:current,impliedApy:current,underlyingApy:underlyingApyOf(m),liquidityUsd:liquidityOf(m),tvlUsd:tvlOf(m),depositsUsd:null,debtUsd:null,utilization:null,rewardApr:null,change24hBps:changeBps(current,pointAtOrBefore(points,now-86400000)),stale:false,provenance:{source:"Pendle",sourceEndpoint:`${PENDLE}/v2/markets/all`,observedAt:asOf,ingestedAt:asOf,freshnessSeconds:0,stale:false}};
}
function marketAnalytics(m:PendleMarket,asOf:string,points:HistoricalPoint[]){
 const market=marketDetail(m,asOf,points),values=points.map(p=>num(p.impliedApy)).filter((x):x is number=>x!=null),current=impliedApyOf(m),mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null,sorted=[...values].sort((a,b)=>a-b),med=median(values),low=sorted[0]??null,high=sorted.at(-1)??null,cut7=Date.parse(asOf)-7*86400000,cut30=Date.parse(asOf)-30*86400000,v7=points.filter(p=>Date.parse(p.timestamp)>=cut7).map(p=>num(p.impliedApy)).filter((x):x is number=>x!=null),v30=points.filter(p=>Date.parse(p.timestamp)>=cut30).map(p=>num(p.impliedApy)).filter((x):x is number=>x!=null),pctile=current==null||!v30.length?null:v30.filter(x=>x<=current).length/v30.length;
 const days=Math.max(0,(Date.parse(maturityOf(m))-Date.parse(asOf))/86400000),first=points[0]?.timestamp,age=first?Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(first))/86400000)):null;
 return{market,statistics:{observations:values.length,low,high,mean,median:med,volatility:std(values),low7d:v7.length?Math.min(...v7):null,high7d:v7.length?Math.max(...v7):null,low30d:v30.length?Math.min(...v30):null,high30d:v30.length?Math.max(...v30):null,percentile30d:pctile,marketAgeDays:age,daysToMaturity:days},history:points.map(p=>({observedAt:new Date(p.timestamp).toISOString(),rate:num(p.impliedApy),borrowApr:null,rewardApr:null,aprExRewards:null,liquidityUsd:null,tvlUsd:num(p.tvl),utilization:null,stale:false})),depth:[],basis:[],methodologyVersion:"pendle-live"};
}
function requestedMarketId(path:string,prefix:string){const raw=path.slice(prefix.length).split("?")[0]??"";try{return decodeURIComponent(raw)}catch{return raw}}


type Severity="low"|"moderate"|"elevated"|"high";
type RiskObservation={dimension:string;metricKey:string;value:number;unit:string;severity:Severity};
type LiveRating={rating:string;score:number|null;coverage:number;worstSeverity:Severity|null;methodologyVersion:string};
const severityRank:Record<Severity,number>={low:0,moderate:1,elevated:2,high:3};
const severityPoints:Record<Severity,number>={low:100,moderate:75,elevated:45,high:15};
function liquiditySeverity(v:number):Severity{return v<100000?"high":v<500000?"elevated":v<2000000?"moderate":"low"}
function volatilitySeverity(v:number):Severity{return v>=.25?"high":v>=.12?"elevated":v>=.05?"moderate":"low"}
function ratingFromEvidence(obs:RiskObservation[]):LiveRating{
 const weights:Record<string,number>={liquidity:.35,"rate-volatility":.20,utilization:.25,"price-impact":.20};
 const usable=obs.filter(o=>weights[o.dimension]!==undefined),coverage=usable.reduce((s,o)=>s+(weights[o.dimension]??0),0),coveragePct=Math.round(coverage*100);
 const worst=usable.reduce<Severity|null>((w,o)=>!w||severityRank[o.severity]>severityRank[w]?o.severity:w,null);
 if(coverage<.5)return{rating:"NR",score:null,coverage:coveragePct,worstSeverity:worst,methodologyVersion:"evidence-rating-v1-live"};
 const score=usable.reduce((s,o)=>s+severityPoints[o.severity]*(weights[o.dimension]??0),0)/coverage;
 let rating=score>=90?"AAA":score>=82?"AA":score>=72?"A":score>=62?"BBB":score>=50?"BB":score>=35?"B":"CCC";
 if(worst==="high"&&["AAA","AA","A","BBB"].includes(rating))rating="BB";
 else if(worst==="elevated"&&["AAA","AA","A"].includes(rating))rating="BBB";
 return{rating,score:Number(score.toFixed(1)),coverage:coveragePct,worstSeverity:worst,methodologyVersion:"evidence-rating-v1-live"};
}
function riskObservations(m:PendleMarket,points:HistoricalPoint[]):RiskObservation[]{
 const out:RiskObservation[]=[],liq=liquidityOf(m);
 if(liq!=null)out.push({dimension:"liquidity",metricKey:"liquidity_usd",value:liq,unit:"usd",severity:liquiditySeverity(liq)});
 const rates=points.map(p=>num(p.impliedApy)).filter((x):x is number=>x!=null),vol=std(rates);
 if(vol!=null)out.push({dimension:"rate-volatility",metricKey:"rate_volatility_30d",value:vol,unit:"ratio",severity:volatilitySeverity(vol)});
 return out;
}
async function liveRisk(rows:PendleMarket[],asOf:string,limit=150){
 const selected=[...rows].sort((a,b)=>(liquidityOf(b)??0)-(liquidityOf(a)??0)).slice(0,Math.min(limit,40));
 const series=await Promise.all(selected.map(async market=>({market,points:await fetchHistory(market,30)})));
 const history=new Map(series.map(x=>[idOf(x.market),x.points]));
 return rows.slice(0,limit).map(m=>{
  const observations=riskObservations(m,history.get(idOf(m))??[]),rating=ratingFromEvidence(observations);
  return{id:idOf(m),market_name:nameOf(m),asset_symbol:symbolOf(m),protocol_name:protocolNameOf(m),chain_name:chainName(String(m.chainId)),liquidity_usd:liquidityOf(m),rate:impliedApyOf(m),observations,rating,observed_at:asOf};
 });
}
function queryLimit(path:string,fallback=150){try{const n=Number(new URL(path,"https://tokos.local").searchParams.get("limit")??fallback);return Number.isFinite(n)?Math.max(1,Math.min(500,Math.floor(n))):fallback}catch{return fallback}}
function entityDirectory(rows:PendleMarket[],kind:"asset"|"protocol"|"chain"){
 const groups=new Map<string,PendleMarket[]>();
 for(const m of rows){const key=kind==="asset"?symbolOf(m):kind==="protocol"?protocolIdOf(m):String(m.chainId);const a=groups.get(key)??[];a.push(m);groups.set(key,a)}
 const result=[...groups.entries()].map(([id,ms])=>{const rates=ms.map(impliedApyOf).filter((x):x is number=>x!=null),assets=new Set(ms.map(symbolOf)),protocols=new Set(ms.map(protocolIdOf)),chains=new Set(ms.map(m=>String(m.chainId))),liquidity=ms.reduce((s,m)=>s+(liquidityOf(m)??0),0),tvl=ms.reduce((s,m)=>s+(tvlOf(m)??0),0);return{id,label:kind==="chain"?chainName(id):kind==="protocol"?protocolNameOf(ms[0]!):id,name:kind==="chain"?chainName(id):kind==="protocol"?protocolNameOf(ms[0]!):id,markets:ms.length,assets:assets.size,protocols:protocols.size,chains:chains.size,medianRate:median(rates),bestRate:rates.length?Math.max(...rates):null,depositsUsd:tvl||null,debtUsd:null,liquidityUsd:liquidity||null,utilization:null}}).sort((a,b)=>(b.liquidityUsd??0)-(a.liquidityUsd??0));
 return{kind,rows:result};
}
function tokenMeta(t:Token|undefined){if(typeof t!=="object"||t===null)return null;const symbol=t.symbol?.trim()||t.name?.trim()||null;if(!symbol)return null;return{symbol,name:t.name?.trim()||null,address:t.address?.toLowerCase()||null}}
function cleanMarketAsset(v:string|undefined|null){if(!v)return null;const x=v.trim().replace(/^(PT|YT|SY)[-\s]/i,"").replace(/[-\s]+\d{1,2}[A-Z]{3}\d{2,4}$/i,"").replace(/[-\s]+\d{4}-\d{2}-\d{2}$/,"").trim();return x||null}
function marketFacingUnderlying(m:PendleMarket){
 const candidates=[cleanMarketAsset(m.name),cleanMarketAsset(tokenSymbol(m.sy)),cleanMarketAsset(tokenSymbol(m.pt)),cleanMarketAsset(tokenSymbol(m.underlyingAsset))].filter((x):x is string=>Boolean(x));
 const protocol=protocolNameOf(m),network=chainName(String(m.chainId));
 for(const symbol of candidates){if(resolveUnderlyingPath({symbol,protocol,network},3).length)return symbol}
 return null;
}
function dependencyGraph(m:PendleMarket,asOf:string){
 const id=idOf(m),cid=String(m.chainId),pt=tokenMeta(m.pt),yt=tokenMeta(m.yt),sy=tokenMeta(m.sy),underlying=tokenMeta(m.underlyingAsset),edges:Array<Record<string,unknown>>=[];
 const add=(sourceType:string,sourceId:string,relationship:string,targetType:string,targetId:string,targetLabel:string,detail:string|null=null,depth=1,source:string|null=null)=>edges.push({source_type:sourceType,source_id:sourceId,relationship,target_type:targetType,target_id:targetId,target_label:targetLabel,detail,depth,source,exposure_usd:null,weight:null,observed_at:asOf});
 if(pt)add("market",id,"principal_token","principal token",pt.address??pt.symbol,pt.symbol,pt.name,1);
 if(yt)add("market",id,"yield_token","yield token",yt.address??yt.symbol,yt.symbol,yt.name,1);
 if(sy)add("market",id,"standardized_yield_wrapper","SY / wrapper",sy.address??sy.symbol,sy.symbol,sy.name,1);
 const marketRoot=marketFacingUnderlying(m),rootUnderlying=marketRoot?{symbol:marketRoot,name:null,address:null}:underlying??{symbol:symbolOf(m),name:null,address:null};
 add("market",id,"underlying_asset","underlying asset",rootUnderlying.address??rootUnderlying.symbol,rootUnderlying.symbol,rootUnderlying.name,1);
 const resolved=resolveUnderlyingPath({symbol:rootUnderlying.symbol,address:rootUnderlying.address,protocol:protocolNameOf(m),network:chainName(cid)},3);
 const underlyingPath:Array<{symbol:string;role:string;relation:string|null;source:string}>=[{symbol:rootUnderlying.symbol,role:"Market asset",relation:null,source:marketRoot?"Verified market-asset mapping":"Pendle market metadata"}];
 let parent=rootUnderlying.symbol;
 resolved.forEach((step,index)=>{add("asset",parent,step.relation,"underlying asset",step.symbol,step.symbol,step.role,index+2,step.source);underlyingPath.push({symbol:step.symbol,role:step.role,relation:step.relation,source:step.source});parent=step.symbol});
 add("market",id,"source_protocol","protocol",protocolIdOf(m),protocolNameOf(m),null,1);
 add("market",id,"network","network",cid,chainName(cid),null,1);
 return{root:{type:"market",id},market:{name:nameOf(m),asset:symbolOf(m),protocol:protocolNameOf(m),network:chainName(cid),maturity:maturityOf(m),tvlUsd:tvlOf(m),liquidityUsd:liquidityOf(m)},underlyingPath,edges};
}
async function compareLive(rows:PendleMarket[],path:string){
 const u=new URL(path,"https://tokos.local"),ids=(u.searchParams.get("marketIds")??"").split(",").filter(Boolean).slice(0,6),days=Number(u.searchParams.get("days")??90);
 const selected=rows.filter(m=>ids.includes(idOf(m))),series=await Promise.all(selected.map(async market=>({market,points:await fetchHistory(market,days)})));
 const marketsOut=selected.map(m=>({id:idOf(m),marketName:nameOf(m),assetSymbol:symbolOf(m),protocolName:protocolNameOf(m),chainId:String(m.chainId),chainName:chainName(String(m.chainId)),supplyApr:null,fixedApy:impliedApyOf(m),impliedApy:impliedApyOf(m),liquidityUsd:liquidityOf(m),tvlUsd:tvlOf(m),depositsUsd:null,debtUsd:null,utilization:null,maturity:maturityOf(m),change24hBps:null,effectiveRate:null,priceImpactBps:null,depthNotionalUsd:null}));
 const history=series.flatMap(({market,points})=>points.map(p=>({marketId:idOf(market),observedAt:new Date(p.timestamp).toISOString(),rate:num(p.impliedApy),liquidityUsd:null,tvlUsd:num(p.tvl),utilization:null})));
 return{markets:marketsOut,history,methodologyVersion:"pendle-live"};
}

export async function liveFallback<T>(path:string):Promise<Envelope<T>|null>{
 if(typeof window!=="undefined")return null;
 const supported=path.startsWith("/analytics/overview")||path.startsWith("/analytics/markets")||path.startsWith("/markets/")||path.startsWith("/market-trends")||path.startsWith("/analytics/market-changes")||path.startsWith("/risk/markets")||path.startsWith("/methodologies")||path.startsWith("/analytics/entities/")||path.startsWith("/risk/entities")||path.startsWith("/dependencies/")||path.startsWith("/analytics/compare");
 if(!supported)return null;
 try{
  const rows=await markets(),asOf=new Date().toISOString(),days=queryDays(path),meta={asOf,stale:false,requestId:"live-provider-mode:pendle"};
  if(path.startsWith("/analytics/overview")){const series=await sampleHistory(rows,days);return{data:overview(rows,asOf,series) as T,meta}}
  if(path.startsWith("/analytics/markets/")){const id=requestedMarketId(path,"/analytics/markets/"),m=rows.find(x=>idOf(x)===id);if(!m)return null;const points=await fetchHistory(m,90);return{data:marketAnalytics(m,asOf,points) as T,meta}}
  if(path.startsWith("/markets/")){const id=requestedMarketId(path,"/markets/"),m=rows.find(x=>idOf(x)===id);if(!m)return null;const points=await fetchHistory(m,30);return{data:marketDetail(m,asOf,points) as T,meta}}
  if(path.startsWith("/analytics/markets")){const series=await sampleHistory(rows,30);return{data:screener(rows,asOf,series) as T,meta}}
  if(path.startsWith("/market-trends")||path.startsWith("/analytics/market-changes"))return{data:{} as T,meta};
  if(path.startsWith("/methodologies"))return{data:[{slug:"evidence-rating-v1",name:"Tokos Evidence Rating",version:"v1-live",scope:"market",description:"Ordinal evidence rating computed from live provider observations. Live mode currently uses observed liquidity and 30-day rate volatility; unavailable dimensions remain missing rather than imputed."}] as T,meta};
  if(path.startsWith("/analytics/entities/")){const kind=path.split("/")[3] as "asset"|"protocol"|"chain";if(!["asset","protocol","chain"].includes(kind))return null;return{data:entityDirectory(rows,kind) as T,meta}}
  if(path.startsWith("/analytics/compare"))return{data:await compareLive(rows,path) as T,meta};
  if(path.startsWith("/risk/markets/")&&path.includes("/scenario")){
   const raw=decodeURIComponent(path.split("/risk/markets/")[1]?.split("/scenario")[0]??""),m=rows.find(x=>idOf(x)===raw);if(!m)return null;const u=new URL(path,"https://tokos.local"),rateShock=Number(u.searchParams.get("rateShockBps")??-200)/10000,liqShock=Number(u.searchParams.get("liquidityShockPct")??-.5),notional=Number(u.searchParams.get("notionalUsd")??100000),rate=impliedApyOf(m),liq=liquidityOf(m);return{data:{market:{id:idOf(m),name:nameOf(m)},inputs:{rateShockBps:rateShock*10000,liquidityShockPct:liqShock,notionalUsd:notional},baseline:{rate,liquidityUsd:liq,utilization:null},stressed:{rate:rate==null?null:rate+rateShock,liquidityUsd:liq==null?null:Math.max(0,liq*(1+liqShock)),utilization:null,notionalCapacity:liq==null||notional<=0?null:Math.min(1,Math.max(0,liq*(1+liqShock))/notional)},note:"Deterministic live-provider stress. No probability forecast."} as T,meta}
  }
  if(path.startsWith("/risk/markets"))return{data:await liveRisk(rows,asOf,queryLimit(path)) as T,meta};
  if(path.startsWith("/risk/entities/market/")){const id=requestedMarketId(path,"/risk/entities/market/"),m=rows.find(x=>idOf(x)===id);if(!m)return null;const points=await fetchHistory(m,30),observations=riskObservations(m,points);return{data:{observations:observations.map(o=>({dimension:o.dimension,metric_key:o.metricKey,value:o.value,unit:o.unit,severity:o.severity}))} as T,meta}}
  if(path.startsWith("/risk/entities")){const risk=await liveRisk(rows,asOf,80);return{data:risk.map(x=>({entity_type:"market",entity_id:x.id,observations:x.observations.length,as_of:asOf,metrics:x.observations.map(o=>({dimension:o.dimension,metricKey:o.metricKey,value:o.value,severity:o.severity}))})) as T,meta}}
  if(path.startsWith("/dependencies/")){const parts=path.split("/").filter(Boolean),type=parts[1],id=decodeURIComponent(parts[2]??"");if(type==="market"){const m=rows.find(x=>idOf(x)===id);if(!m)return null;const graph=dependencyGraph(m,asOf),outgoing=(graph.edges as Array<Record<string,unknown>>).map(e=>({relationship:e.relationship,source_type:e.source_type,source_id:e.source_id,target_type:e.target_type,target_id:e.target_id,target_label:e.target_label??null,detail:e.detail??null,depth:e.depth??null,source:e.source??null}));return{data:(path.includes("/graph")?graph:{outgoing,incoming:[]}) as T,meta}}if(type==="asset"||type==="protocol"||type==="chain"){const matches=rows.filter(m=>type==="asset"?symbolOf(m)===id:type==="protocol"?protocolIdOf(m)===id:String(m.chainId)===id);if(!matches.length)return null;const relation=type==="asset"?"used_by":type==="protocol"?"operates":"hosts",edges=matches.map(m=>({source_type:type,source_id:id,relationship:relation,target_type:"market",target_id:idOf(m),exposure_usd:tvlOf(m),weight:null,observed_at:asOf}));return{data:{root:{type,id},edges} as T,meta}}return null}
  return null;
 }catch{return null}
}
