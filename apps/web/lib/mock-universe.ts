/**
 * Illustrative market universe for demonstration deployments without a live data API.
 * Every number here is an input to the real rating engine; the ratings shown are computed, not typed.
 * The interface labels this data as demonstration data wherever it appears.
 */
import type {MarketFacts} from "@tokos-data/ratings";

export type MockMarket={id:string;name:string;protocolSlug:string;protocolName:string;chainId:string;chainName:string;chainSlug:string;assetSymbol:string;assetGroup:string;collateral:string;supplyUsd:number;utilization:number;supplyApy:number;depthBps:number;depthNotional:number;liquidityUsd:number;rateVol:number;lltv:number|null;marketType:"lending"|"pt";rateType:"floating"|"fixed"};

const chains:Record<string,[string,string]>={"1":["Ethereum","ethereum"],"8453":["Base","base"],"42161":["Arbitrum","arbitrum"],"999":["HyperEVM","hyperevm"],"10":["Optimism","optimism"]};
const groupOf=(s:string)=>/usd|dai|gho|usds|usde|eur/i.test(s)?(/eur/i.test(s)?"eur":"usd"):/eth/i.test(s)?"eth":/btc/i.test(s)?"btc":s.toLowerCase();

type Row=[protocol:string,chain:string,asset:string,collateral:string,supplyM:number,util:number,apy:number,depthBps:number,lltv:number|null];
const rows:Row[]=[
 ["Aave V3","1","USDC","WETH",2400,.84,.041,3,.78],["Aave V3","1","USDT","WETH",1900,.88,.045,3,.75],["Aave V3","1","WETH","wstETH",3100,.79,.019,8,.825],["Aave V3","1","wstETH","WETH",4200,.12,.0004,12,.81],["Aave V3","1","weETH","WETH",2800,.05,.0001,25,.78],["Aave V3","1","cbBTC","WBTC",1600,.03,.0001,10,.75],["Aave V3","1","GHO","WETH",210,.91,.062,25,null],["Aave V3","1","DAI","WETH",410,.86,.047,3,.77],["Aave V3","1","sUSDe","USDC",820,.02,0,25,.72],["Aave V3","1","LINK","WETH",380,.21,.0012,40,.66],
 ["Aave V3","8453","USDC","WETH",610,.87,.049,3,.78],["Aave V3","8453","WETH","wstETH",440,.81,.021,9,.825],["Aave V3","8453","cbBTC","WBTC",390,.04,.0001,12,.75],["Aave V3","42161","USDC","WETH",520,.89,.052,4,.78],["Aave V3","42161","WETH","wstETH",270,.77,.018,10,.825],["Aave V3","42161","USDT","WETH",140,.92,.058,4,.75],
 ["Morpho","1","USDC","WETH",1400,.9,.055,3,.86],["Morpho","1","USDT","WETH",430,.88,.051,4,.86],["Morpho","1","WETH","wstETH",610,.86,.026,8,.945],["Morpho","1","wstETH","WETH",980,0,0,12,.945],["Morpho","1","USDe","USDC",220,.93,.071,25,.915],["Morpho","8453","USDC","WETH",770,.91,.063,3,.86],["Morpho","8453","WETH","cbBTC",190,.84,.024,10,.86],["Morpho","1","PEPE","PEPE",21,.55,.034,180,.6],
 ["Compound V3","1","USDC","WETH",890,.86,.046,3,.83],["Compound V3","1","WETH","wstETH",550,.74,.017,8,.9],["Compound V3","1","USDT","WETH",310,.9,.05,4,.83],["Compound V3","8453","USDC","WETH",290,.88,.051,4,.83],
 ["Euler V2","1","USDC","WETH",340,.82,.058,4,.85],["Euler V2","1","WETH","wstETH",180,.8,.027,9,.9],["Euler V2","1","sUSDe","USDC",110,.65,.082,25,.88],["Euler V2","8453","USDC","WETH",91,.85,.066,5,.85],["Euler V2","1","PEPE","PEPE",8.4,.71,.11,180,.6],
 ["Spark","1","USDS","WETH",2600,.71,.045,3,.8],["Spark","1","USDC","WETH",1100,.78,.042,3,.8],["Spark","1","WETH","wstETH",720,.69,.016,8,.825],
 ["HyperLend","999","USDC","HYPE",460,.9,.081,25,.8],["HyperLend","999","HYPE","HYPE",630,.44,.012,35,.7],["HyperLend","999","USDe","HYPE",120,.88,.09,30,.75],["HyperLend","999","WETH","HYPE",81,.62,.014,30,.75],["HyperLend","999","PEPE","PEPE",3.1,.83,.19,180,.6],
 ["Fluid","1","USDC","WETH",680,.93,.059,3,.9],["Fluid","1","USDT","WETH",540,.95,.061,3,.9],["Fluid","1","WETH","wstETH",320,.88,.028,8,.95],["Fluid","42161","USDC","WETH",110,.96,.072,5,.9],
 ["Kamino","10","USDC","WETH",150,.82,.064,6,.8],["Silo","42161","USDC","wstETH",72,.79,.067,9,.8],["Silo","1","WETH","weETH",95,.71,.022,12,.85]
];

export const MOCK_MARKETS:MockMarket[]=rows.map(([protocolName,chainId,asset,collateral,supplyM,util,apy,depthBps,lltv])=>{
  const slug=protocolName.toLowerCase().replace(/\s+/g,"-");const [chainName,chainSlug]=chains[chainId]!;
  const supplyUsd=supplyM*1e6;
  return{id:`1delta:${slug}:${chainId}:${asset.toLowerCase()}`,name:`${protocolName} ${asset}`,protocolSlug:slug,protocolName,chainId,chainName,chainSlug,assetSymbol:asset,assetGroup:groupOf(asset),collateral,supplyUsd,utilization:util,supplyApy:apy,depthBps,depthNotional:250000,liquidityUsd:supplyUsd*(1-util),rateVol:/usd/i.test(asset)?.004:.012,lltv,marketType:"lending",rateType:"floating"};
});
MOCK_MARKETS.push(
 {id:"pendle:1:0xaa",name:"PT sUSDe 26 Mar 2027",protocolSlug:"pendle",protocolName:"Pendle",chainId:"1",chainName:"Ethereum",chainSlug:"ethereum",assetSymbol:"PT-sUSDe-26MAR2027",assetGroup:"usd",collateral:"PT-sUSDe",supplyUsd:3.2e8,utilization:.5,supplyApy:.094,depthBps:60,depthNotional:250000,liquidityUsd:4.1e7,rateVol:.02,lltv:null,marketType:"pt",rateType:"fixed"},
 {id:"pendle:1:0xbb",name:"PT weETH 25 Jun 2027",protocolSlug:"pendle",protocolName:"Pendle",chainId:"1",chainName:"Ethereum",chainSlug:"ethereum",assetSymbol:"PT-weETH-25JUN2027",assetGroup:"eth",collateral:"PT-weETH",supplyUsd:9.5e7,utilization:.5,supplyApy:.036,depthBps:90,depthNotional:250000,liquidityUsd:1.2e7,rateVol:.02,lltv:null,marketType:"pt",rateType:"fixed"}
);

/** Deterministic daily drift so history and actions exist without inventing numbers by hand. */
export function factsFor(m:MockMarket,dayOffset=0):MarketFacts{
  const wobble=(k:number)=>Math.sin((dayOffset+1)*0.9+k)*0.5+Math.sin((dayOffset+1)*0.37+k*2)*0.5;
  const util=Math.max(0,Math.min(0.99,m.utilization+(m.utilization>0.3?wobble(1)*0.03:0)));
  const supply=m.supplyUsd*(1+wobble(2)*0.04);
  const depth=m.depthBps*(1+wobble(3)*0.12);
  const pendle=m.marketType==="pt";
  return{marketId:m.id,marketName:m.name,provider:pendle?"pendle":"1delta",protocolSlug:m.protocolSlug,
    loanSymbol:pendle?"USDC":m.assetSymbol,loanAssetGroup:pendle?"usd":m.assetGroup,
    collateralSymbol:m.collateral,collateralAssetGroup:m.assetGroup,marketType:m.marketType,
    supplyUsd:supply,utilization:pendle?null:util,lltv:m.lltv,liquidationBonus:m.lltv?0.05:null,observedVol:null,
    priceImpact:depth/10000,depthNotionalUsd:m.depthNotional,liquidityUsd:supply*(1-util),rateVolatility30d:m.rateVol*(1+Math.abs(wobble(4))),
    oracleLagDays:null,protocolPd:null,supplyApy:m.supplyApy*(1+wobble(5)*0.08)};
}
