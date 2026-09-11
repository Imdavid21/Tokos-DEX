export function pct(v:number|null|undefined,d=2){if(v==null||!Number.isFinite(v))return "—";const n=Math.abs(v)<5e-7?0:v;return `${(n*100).toFixed(d)}%`}
export function usd(v:number|null|undefined){if(v==null||!Number.isFinite(v))return "—";const a=Math.abs(v);if(a>=1e9)return `$${(v/1e9).toFixed(a>=1e10?1:2)}B`;if(a>=1e6)return `$${(v/1e6).toFixed(a>=1e7?1:2)}M`;if(a>=1e3)return `$${(v/1e3).toFixed(a>=1e4?1:2)}K`;return `$${v.toFixed(0)}`}
export function bps(v:number|null|undefined){if(v==null||!Number.isFinite(v))return "—";return `${v>0?"+":""}${Math.round(v)} bp`}
export function ago(iso:string|null|undefined){if(!iso)return "—";const d=new Date(iso);if(!Number.isFinite(d.getTime()))return "—";return d.toISOString().slice(0,16).replace("T"," ")+" UTC"}
export function date(iso:string|null|undefined){if(!iso)return "—";return new Intl.DateTimeFormat("en",{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(iso))}
export function shortId(id:string){return id.length>28?`${id.slice(0,14)}…${id.slice(-8)}`:id}
