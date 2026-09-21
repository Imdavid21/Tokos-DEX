export type UnderlyingContext={symbol:string;address?:string|null;protocol?:string|null;network?:string|null};
export type UnderlyingStep={symbol:string;relation:string;role:string;source:string};

type Rule={
 symbol:string;
 underlying:string;
 relation:string;
 role:string;
 source:string;
 protocol?:string;
 network?:string;
 address?:string;
};

const norm=(v:string|undefined|null)=>(v??"").trim().toUpperCase();

const RULES:Rule[]=[
 {
  symbol:"WSTHYPE",
  underlying:"STHYPE",
  relation:"wrapped_representation_of",
  role:"Rebasing liquid staking token",
  protocol:"STAKEDHYPE",
  network:"HYPEREVM",
  source:"stHYPE SDK and protocol documentation"
 },
 {
  symbol:"STHYPE",
  underlying:"HYPE",
  relation:"liquid_staking_backed_by",
  role:"Native staked asset",
  protocol:"STAKEDHYPE",
  network:"HYPEREVM",
  source:"StakedHYPE institutional documentation"
 },
 {
  symbol:"KHYPE",
  underlying:"HYPE",
  relation:"liquid_staking_backed_by",
  role:"Native staked asset",
  protocol:"KINETIQ",
  network:"HYPEREVM",
  source:"Kinetiq liquid staking docs"
 },
 {
  symbol:"WSTETH",
  underlying:"STETH",
  relation:"wraps",
  role:"Wrapped staking token",
  source:"Lido wstETH docs"
 },
 {
  symbol:"STETH",
  underlying:"ETH",
  relation:"liquid_staking_backed_by",
  role:"Native staked asset",
  source:"Lido token integration docs"
 }
];

function matches(rule:Rule,ctx:UnderlyingContext){
 if(norm(rule.symbol)!==norm(ctx.symbol))return false;
 if(rule.protocol&&norm(rule.protocol)!==norm(ctx.protocol))return false;
 if(rule.network&&norm(rule.network)!==norm(ctx.network))return false;
 if(rule.address&&norm(rule.address)!==norm(ctx.address))return false;
 return true;
}

export function resolveUnderlyingPath(input:UnderlyingContext,maxDepth=3){
 const out:UnderlyingStep[]=[];
 let current=input;
 const seen=new Set<string>([norm(input.symbol)]);
 for(let depth=0;depth<maxDepth;depth++){
  const rule=RULES.find(r=>matches(r,current));
  if(!rule)break;
  const next=norm(rule.underlying);
  if(!next||seen.has(next))break;
  out.push({symbol:rule.underlying,relation:rule.relation,role:rule.role,source:rule.source});
  seen.add(next);
  current={symbol:rule.underlying};
 }
 return out;
}
