import {AlertTriangle} from "lucide-react";
export function Unavailable({title="Data unavailable",detail="The normalized Tokos dataset has no current observation for this view. No fallback value has been substituted."}:{title?:string;detail?:string}){return <div className="empty"><div><h2>{title}</h2><p>{detail}</p></div></div>}
export function StaleNotice({asOf}:{asOf:string}){return <div className="notice warn"><AlertTriangle size={15}/><div>Some observations are stale. Last normalized update: {new Date(asOf).toLocaleString("en",{timeZone:"UTC"})} UTC.</div></div>}
