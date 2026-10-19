import Link from "next/link";
import {Nav} from "./Nav";
import {Search} from "./Search";
import {ThemeToggle} from "./ThemeToggle";
import {Ticker} from "./Ticker";
import {maybeApi} from "@/lib/api";

type Summary={rated:number;graded:number};
export async function Shell({children}:{children:React.ReactNode}){const summary=await maybeApi<Summary>("/ratings/summary");const live=Boolean(summary&&summary.data.rated>0);const demo=Boolean(summary?.meta.demo);
  return <div className="shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Indenture overview"><span className="brand-mark" aria-hidden="true"/><b>Indenture</b><span>ratings</span></Link>
      <Search/>
      <div className="top-actions">
        <div className="health" title={live?`${summary?.data.graded} graded markets`:"Ratings unavailable"}><span className={`health-dot ${live?(demo?"stale":""):"offline"}`}/>{live?`${summary?.data.graded.toLocaleString()} rated${demo?" · demo":""}`:"Ratings offline"}</div>
        <ThemeToggle/>
      </div>
    </header>
    <Nav/>
    <main className="main">{demo&&<div className="demo-bar"><b>Demonstration data</b><span>Ratings computed by the real engine from an illustrative market universe, not live observations</span><Link href="/methodology/indenture-psl-v1">How ratings are made</Link></div>}<Ticker/>{children}</main>
  </div>
}
