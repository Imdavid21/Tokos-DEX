"use client";
import Link from"next/link";import{usePathname}from"next/navigation";
type Item={href:string;label:string;exact?:boolean};const groups:Array<{label:string;items:Item[]}>= [
{label:"Ratings",items:[{href:"/",label:"Overview",exact:true},{href:"/ratings",label:"Rated markets"},{href:"/actions",label:"Rating actions"},{href:"/frontier",label:"Yield vs risk"},{href:"/scale",label:"Scale"},{href:"/methodology/indenture-psl-v1",label:"Methodology"}]},
{label:"Intelligence",items:[{href:"/dependencies",label:"Dependency map"},{href:"/scenarios",label:"Stress testing"},{href:"/compare",label:"Compare"},{href:"/portfolio-risk",label:"Portfolio"},{href:"/alerts",label:"Alerts"},{href:"/risk",label:"Evidence ratings"}]},
{label:"Universe",items:[{href:"/markets",label:"Markets"},{href:"/assets",label:"Assets"},{href:"/protocols",label:"Protocols"},{href:"/chains",label:"Networks"}]},
{label:"Rates data",items:[{href:"/rates",label:"Rates"},{href:"/yield-curve",label:"Yield curve"},{href:"/basis",label:"Basis"},{href:"/execution",label:"Liquidity"},{href:"/correlations",label:"Correlations"},{href:"/datasets",label:"Datasets"}]}];
export function Nav(){const path=usePathname();let n=0;return <nav className="rail" aria-label="Primary">{groups.map(group=><div key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(({href,label,exact})=>{n++;const active=exact?path===href:path.startsWith(href);return <Link key={href} href={href} className={`nav-link ${active?"active":""}`}><span>{label}</span></Link>})}</div>)}</nav>}
