// Precompute the demonstration universe with the real rating engine so the web app can run without a data API.
// Output: lib/mock-ratings.json. Run from the web package: pnpm mock:build
import {writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {notchDelta,rateMarket,type Grade,type Outlook} from "@tokos-data/ratings";
import {MOCK_MARKETS,factsFor} from "../lib/mock-universe";

const DAYS=14;const base=Date.UTC(2026,9,19,6,0,0);
const dayIso=(offset:number)=>new Date(base-offset*86400000).toISOString();
type Run={computedAt:string;grade:Grade;outlook:Outlook;psl:number;pslLow:number;pslHigh:number;expectedLoss:number;riskAdjustedApy:number|null;coverage:number};
const out:{generatedAt:string;markets:Record<string,unknown>[];actions:Record<string,unknown>[]}={generatedAt:new Date().toISOString(),markets:[],actions:[]};
const started=Date.now();
for(const m of MOCK_MARKETS){
  const history:Run[]=[];let prev:{grade:Grade;psl:number;outlook:Outlook}|null=null;let latest:ReturnType<typeof rateMarket>|null=null;let prevFacts=null as ReturnType<typeof factsFor>|null;
  for(let d=DAYS-1;d>=0;d--){
    const facts=factsFor(m,d);const final=d===0;
    const r=rateMarket(facts,{paths:final?4000:2000,driverPaths:final?1000:100,previous:prev?{grade:prev.grade,psl:prev.psl,outlook:prev.outlook}:null});
    const run:Run={computedAt:dayIso(d),grade:r.grade,outlook:r.outlook,psl:r.psl,pslLow:r.pslLow,pslHigh:r.pslHigh,expectedLoss:r.expectedLoss,riskAdjustedApy:r.riskAdjustedApy,coverage:r.coverage};
    history.push(run);
    let action:string|null=null,reason="";const notches=prev?notchDelta(prev.grade,r.grade):0;
    if(!prev){action="initiate";reason=`Initial ${r.grade} rating, PSL ${(r.psl*100).toFixed(2)}%, top driver ${r.drivers[0]?.label}`}
    else if(prev.grade!=="NR"&&r.grade==="NR"){action="withdraw";reason="Coverage fell below the published floor"}
    else if(prev.grade!==r.grade){action=notches>0?"upgrade":"downgrade";reason=`${prev.grade} to ${r.grade} (${Math.abs(notches)} notch${Math.abs(notches)===1?"":"es"}), PSL ${(prev.psl*100).toFixed(2)}% to ${(r.psl*100).toFixed(2)}%, driver ${r.drivers[0]?.label}`}
    else if(prev.outlook!==r.outlook){action="outlook";reason=`Outlook ${prev.outlook} to ${r.outlook}, PSL ${(r.psl*100).toFixed(2)}%`}
    if(action)out.actions.push({id:`act_${m.id}_${d}`,entityType:"market",entityId:m.id,action,fromGrade:prev?.grade??null,toGrade:r.grade,fromPsl:prev?.psl??null,toPsl:r.psl,fromOutlook:prev?.outlook??null,toOutlook:r.outlook,notches,reason,runId:null,methodologyVersion:r.methodologyVersion,observedAt:dayIso(d),market:{name:m.name,assetSymbol:m.assetSymbol,protocolName:m.protocolName,chainName:m.chainName,supplyUsd:facts.supplyUsd}});
    prev={grade:r.grade,psl:r.psl,outlook:r.outlook};if(final){latest=r;prevFacts=facts}
  }
  const r=latest!,facts=prevFacts!;
  out.markets.push({entityType:"market",entityId:m.id,runId:`run_${m.id}`,methodologyVersion:r.methodologyVersion,grade:r.grade,outlook:r.outlook,psl:r.psl,pslLow:r.pslLow,pslHigh:r.pslHigh,lgd:r.lgd,expectedLoss:r.expectedLoss,supplyApy:facts.supplyApy,riskAdjustedApy:r.riskAdjustedApy,coverage:r.coverage,topDriver:r.drivers[0]?.label??null,computedAt:dayIso(0),
    market:{id:m.id,name:m.name,provider:facts.provider,protocolId:m.protocolSlug,protocolName:m.protocolName,protocolSlug:m.protocolSlug,chainId:m.chainId,chainName:m.chainName,chainSlug:m.chainSlug,assetId:m.assetSymbol.toLowerCase(),assetSymbol:m.assetSymbol,assetGroup:m.assetGroup,marketType:m.marketType,rateType:m.rateType,maturity:null,supplyUsd:facts.supplyUsd,liquidityUsd:facts.liquidityUsd,utilization:facts.utilization,stale:false,observedAt:dayIso(0)},
    run:{id:`run_${m.id}`,seed:String(r.seed),paths:r.paths,inputsHash:r.inputsHash,durationMs:null,inputs:{records:r.inputs,archetypes:r.archetypes,facts},drivers:r.drivers,simulation:{psl:r.psl,pslLow:r.pslLow,pslHigh:r.pslHigh,lgd:r.lgd,expectedLoss:r.expectedLoss,quantiles:r.simulation.quantiles,histogram:r.simulation.histogram,channels:r.simulation.channels,samplePaths:r.simulation.samplePaths,band:r.band},limitations:r.limitations},
    history,dependencies:[{relationship:"uses_asset",targetType:"asset",targetId:m.assetSymbol.toLowerCase()},{relationship:"operated_by",targetType:"protocol",targetId:m.protocolSlug},{relationship:"deployed_on",targetType:"chain",targetId:m.chainId}]});
  process.stdout.write(`${m.name.padEnd(28)} ${r.grade.padEnd(4)} ${(r.psl*100).toFixed(2)}%\n`);
}
out.actions.sort((a,b)=>String(b.observedAt).localeCompare(String(a.observedAt)));
writeFileSync(resolve(import.meta.dirname,"../lib/mock-ratings.json"),JSON.stringify(out));
console.log(`wrote ${out.markets.length} markets, ${out.actions.length} actions in ${((Date.now()-started)/1000).toFixed(0)}s`);
