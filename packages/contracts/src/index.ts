export type Provider="1delta"|"pendle";
export type MarketType="lending"|"pt"|"yt"|"fixed-term"|"orderbook-rate";
export type RateType="floating"|"fixed"|"hybrid";
export type MarketStatus="active"|"matured"|"paused"|"stale"|"unknown";
export type ExecutionModel="provider-exact"|"provider-simulated"|"tokos-modeled"|"spot-only";

export interface Asset {id:string;symbol:string;name:string;assetGroup:string|null;decimals:number|null;logoUrl:string|null;category:"stablecoin"|"eth"|"btc"|"lst"|"lrt"|"rwa"|"other";stablecoinPeg:string|null;}
export interface Chain {id:string;slug:string;name:string;logoUrl:string|null;nativeAssetSymbol:string|null;active:boolean;}
export interface Protocol {id:string;slug:string;name:string;logoUrl:string|null;providerKeys:string[];categories:string[];websiteUrl:string|null;}
export interface Market {id:string;provider:Provider;providerMarketId:string;protocolId:string;chainId:string;assetId:string;quoteAssetId:string|null;marketType:MarketType;rateType:RateType;maturity:string|null;marketAddress:string|null;marketName:string;status:MarketStatus;executionModel:ExecutionModel;}
export interface MarketSnapshot {marketId:string;observedAt:string;sourceObservedAt:string|null;ingestedAt:string;supplyApr:number|null;borrowApr:number|null;fixedApy:number|null;impliedApy:number|null;underlyingApy:number|null;depositsUsd:number|null;debtUsd:number|null;liquidityUsd:number|null;tvlUsd:number|null;utilization:number|null;volume24hUsd:number|null;rewardApr:number|null;intrinsicApr:number|null;aprExRewards:number|null;stale:boolean;rawPayloadHash:string|null;}
export interface Provenance {source:Provider|"tokos";sourceEndpoint?:string;observedAt:string;ingestedAt?:string;calculatedAt?:string;freshnessSeconds:number;stale:boolean;methodologyVersion?:string;}
export interface ApiMeta {asOf:string;stale:boolean;requestId:string;nextCursor?:string|null;hasMore?:boolean;}
export interface ApiEnvelope<T>{data:T;meta:ApiMeta;}
export interface DatasetDefinition {slug:string;description:string;tableName:string;updateFrequency:string;sources:string[];}
