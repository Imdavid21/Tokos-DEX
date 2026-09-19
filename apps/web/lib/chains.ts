export const CHAIN_NAMES:Record<string,string>={
"1":"Ethereum","10":"Optimism","56":"BNB Chain","100":"Gnosis","130":"Unichain","143":"Monad","146":"Sonic","196":"X Layer","999":"HyperEVM","4663":"Robinhood Chain","5000":"Mantle","8453":"Base","9745":"Plasma","42161":"Arbitrum","43114":"Avalanche","57073":"Ink","80094":"Berachain","747474":"Katana"
};
export function chainLabel(id:string|number|undefined|null,fallback?:string|null){
 const key=id==null?"":String(id),known=CHAIN_NAMES[key];
 if(known)return known;
 const f=(fallback??"").trim();
 if(f&&!/^chain\s+\d+$/i.test(f)&&!/^\d+$/.test(f))return f;
 return "Unknown network";
}
