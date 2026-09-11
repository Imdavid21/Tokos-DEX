import {AlertTriangle} from "lucide-react";

type StateKind="unavailable"|"empty"|"filtered"|"provider"|"history"|"unsupported"|"quote";
const labels:Record<StateKind,string>={unavailable:"Unavailable",empty:"No data",filtered:"No matches",provider:"Provider unavailable",history:"Insufficient history",unsupported:"Unsupported",quote:"No execution quote"};

export function DataState({kind="unavailable",title,detail,compact=false}:{kind?:StateKind;title?:string;detail?:string;compact?:boolean}){
  return <div className={`state ${compact?"state-compact":""}`}>
    <div>
      <h2>{title??labels[kind]}</h2>
      {detail&&<p>{detail}</p>}
      <div className="state-code">{labels[kind]}</div>
    </div>
  </div>
}

export function Unavailable({title="Data unavailable",detail="No current normalized observation is available. Tokos does not substitute demo values."}:{title?:string;detail?:string}){
  return <DataState kind="unavailable" title={title} detail={detail}/>;
}

export function InsufficientHistory({detail="This view needs more historical observations before the metric is statistically meaningful."}:{detail?:string}){
  return <DataState kind="history" detail={detail}/>;
}

export function StaleNotice({asOf}:{asOf:string}){
  return <div className="notice warn"><AlertTriangle size={14}/><div>Stale observations detected. Last normalized update: {new Date(asOf).toLocaleString("en",{timeZone:"UTC"})} UTC.</div></div>;
}
