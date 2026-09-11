import{z}from"zod";import{fetchJson}from"./http.js";
const envelope=<T extends z.ZodTypeAny>(data:T)=>z.object({success:z.literal(true),data,actions:z.unknown().nullable().optional()});
const chainSchema=z.object({chainId:z.string(),name:z.string()}).passthrough();
const lenderSchema=z.object({chainId:z.string(),lenderInfo:z.object({key:z.string(),name:z.string(),logoURI:z.string().nullable().optional()}).passthrough(),tvlUsd:z.number().nullable().optional(),lastFetched:z.number().nullable().optional()}).passthrough();
const assetMetaSchema=z.object({address:z.string().optional(),symbol:z.string().optional(),name:z.string().optional(),decimals:z.number().optional(),logoURI:z.string().nullable().optional()}).passthrough();
const latestMarketSchema=z.object({
 lenderKey:z.string().optional(),poolId:z.string().optional(),marketUid:z.string().optional(),depositRate:z.number().nullable().optional(),variableBorrowRate:z.number().nullable().optional(),stableBorrowRate:z.number().nullable().optional(),intrinsicYield:z.number().nullable().optional(),
 totalDepositsUsd:z.number().nullable().optional(),totalDebtUsd:z.number().nullable().optional(),totalDebtStableUsd:z.number().nullable().optional(),totalLiquidityUsd:z.number().nullable().optional(),utilization:z.number().nullable().optional(),decimals:z.number().nullable().optional(),
 underlyingInfo:z.object({asset:assetMetaSchema.nullable().optional()}).passthrough().nullable().optional(),underlying:assetMetaSchema.nullable().optional(),terms:z.array(z.unknown()).optional(),flags:z.record(z.string(),z.unknown()).optional(),termSheet:z.unknown().optional(),rewards:z.unknown().optional()
}).passthrough();
const latestItemSchema=z.object({chainId:z.string(),lenderInfo:z.object({key:z.string(),name:z.string(),logoURI:z.string().nullable().optional()}).passthrough(),lastFetched:z.number(),totalDepositsUsd:z.number().nullable().optional(),totalDebtUsd:z.number().nullable().optional(),tvlUsd:z.number().nullable().optional(),fixedTerm:z.object({model:z.string().optional(),maturity:z.number().optional()}).passthrough().nullable().optional(),markets:z.array(latestMarketSchema)}).passthrough();
const latestResponseSchema=envelope(z.object({count:z.number(),items:z.array(latestItemSchema)}).passthrough());
const comparableItemSchema=z.object({
 rank:z.number().optional(),chainId:z.string(),lender:z.string(),lenderName:z.string().optional(),marketUid:z.string(),marketName:z.string().optional(),rateType:z.enum(["fixed","float"]),rateModel:z.string().optional(),aprPct:z.number().nullable().optional(),aprAtAmountPct:z.number().nullable().optional(),rewardAprPct:z.number().nullable().optional(),aprExRewardsPct:z.number().nullable().optional(),effectiveAprPct:z.number().nullable().optional(),costPct:z.number().nullable().optional(),horizon:z.object({basis:z.enum(["flat-forward","early-exit","held-to-maturity","rolled"]),locked:z.boolean(),priceRisk:z.boolean(),assumptions:z.array(z.string()).default([])}).passthrough(),termId:z.string().nullable().optional(),durationDays:z.number().nullable().optional(),maturity:z.number().nullable().optional(),termDays:z.number().nullable().optional(),obtainable:z.boolean().optional(),obtainableReason:z.string().nullable().optional(),quoteBasis:z.enum(["live","last-clearing"]).optional(),depth:z.object({fillable:z.number().nullable().optional(),capped:z.boolean().nullable().optional(),liquidityUsd:z.number().nullable().optional(),utilization:z.number().nullable().optional()}).passthrough().optional()
}).passthrough();
const comparablesResponseSchema=envelope(z.object({side:z.enum(["borrow","supply"]),horizonDays:z.number(),amountUsd:z.number().nullable().optional(),chainIds:z.array(z.string()).default([]),droppedIlliquid:z.number().optional(),droppedStale:z.number().optional(),items:z.array(comparableItemSchema).default([])}).passthrough());
const depthResponseSchema=envelope(z.object({count:z.number().optional(),items:z.array(z.object({marketUid:z.string(),protocol:z.string().optional(),lenderKey:z.string(),chainId:z.string(),underlyingAddress:z.string().optional(),utilization:z.number().nullable().optional(),variableBorrowRate:z.number().nullable().optional(),rateAtAmount:z.array(z.object({side:z.enum(["borrow","supply"]),size:z.number().optional(),amountUsd:z.number().nullable().optional(),utilization:z.number().nullable().optional(),borrowAprPct:z.number().nullable().optional(),depositAprPct:z.number().nullable().optional(),fillable:z.number().nullable().optional(),capped:z.boolean().nullable().optional()}).passthrough()).optional()}).passthrough())}).passthrough());
export type OneDeltaLatestItem=z.infer<typeof latestItemSchema>;export type OneDeltaLatestMarket=z.infer<typeof latestMarketSchema>;
export interface OneDeltaClientOptions{baseUrl:string;apiKey?:string|undefined;}
const qs=(input:Record<string,string|number|boolean|undefined>)=>{const p=new URLSearchParams();for(const[k,v]of Object.entries(input))if(v!==undefined)p.set(k,String(v));return p.toString()};
export class OneDeltaClient{
 constructor(private readonly options:OneDeltaClientOptions){}
 private headers():HeadersInit{return this.options.apiKey?{"x-api-key":this.options.apiKey}:{}}
 async chains(){const{data}=await fetchJson<unknown>("1delta",`${this.options.baseUrl}/data/chains`,{headers:this.headers()});return envelope(z.object({items:z.array(chainSchema)}).passthrough()).parse(data).data.items;}
 async lenders(chains:string[]){const{data}=await fetchJson<unknown>("1delta",`${this.options.baseUrl}/data/lending/lenders?${qs({chains:chains.join(",")})}`,{headers:this.headers()});return envelope(z.object({items:z.array(lenderSchema)}).passthrough()).parse(data).data.items;}
 async latest(chains:string[],lenderKeys:string[],options?:{terms?:"digest"|"full"|"none"}){
  if(!lenderKeys.length||lenderKeys.length>20)throw new RangeError("1delta latest requires 1-20 lender keys");
  const url=`${this.options.baseUrl}/data/lending/latest?${qs({chains:chains.join(","),lenders:lenderKeys.join(","),terms:options?.terms??"digest"})}`;
  const{data,status}=await fetchJson<unknown>("1delta",url,{headers:this.headers()});return{parsed:latestResponseSchema.parse(data),raw:data,status,endpoint:url};
 }
 async comparables(query:{chainId?:string|undefined;chainIds?:string|undefined;collateral?:string|undefined;collateralGroups?:string|undefined;debt?:string|undefined;debtGroups?:string|undefined;amountUsd:number;horizonDays:number;side?:"supply"|"borrow"|undefined;rateType?:"all"|"fixed"|"float"|undefined;limit?:number|undefined;includeStale?:boolean|undefined;includeIlliquid?:boolean|undefined;}){
  const url=`${this.options.baseUrl}/data/lending/comparables?${qs({chainId:query.chainId,chainIds:query.chainIds,collateral:query.collateral,collateralGroups:query.collateralGroups,debt:query.debt,debtGroups:query.debtGroups,amountUsd:query.amountUsd,horizonDays:query.horizonDays,side:query.side??"supply",rateType:query.rateType??"all",limit:Math.min(query.limit??25,25),includeStale:query.includeStale,includeIlliquid:query.includeIlliquid})}`;
  const{data,status}=await fetchJson<unknown>("1delta",url,{headers:this.headers()});return{parsed:comparablesResponseSchema.parse(data),raw:data,status,endpoint:url};
 }
 async depth(marketUids:string[],notionalUsd:number,side:"supply"|"borrow"="supply"){
  const url=`${this.options.baseUrl}/data/lending/irm/depth?${qs({marketUids:marketUids.join(","),side,amountsUsd:notionalUsd,grid:false})}`;
  const{data,status}=await fetchJson<unknown>("1delta",url,{headers:this.headers()});return{parsed:depthResponseSchema.parse(data),raw:data,status,endpoint:url};
 }
}
export function chunkLenders(keys:string[],size=20){if(size<1||size>20)throw new RangeError("1delta batch size must be 1-20");const out:string[][]=[];for(let i=0;i<keys.length;i+=size)out.push(keys.slice(i,i+size));return out;}
