import Link from "next/link";
import {Nav} from "./Nav";
import {Search} from "./Search";
import {ThemeToggle} from "./ThemeToggle";
import {Ticker} from "./Ticker";
import {maybeApi} from "@/lib/api";

type Summary={rated:number;graded:number};
export async function Shell({children}:{children:React.ReactNode}){const summary=await maybeApi<Summary>("/ratings/summary");const live=Boolean(summary&&summary.data.rated>0);
  return <div className="shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Indenture overview"><b>Indenture</b><span>ratings</span></Link>
      <Search/>
      <div className="top-actions">
        <div className="health" title={live?`${summary?.data.graded} graded markets, live`:"Ratings unavailable"}><span className={`health-dot ${live?"":"offline"}`}/>{live?`${summary?.data.graded.toLocaleString()} rated`:"Ratings offline"}</div>
        <ThemeToggle/>
      </div>
    </header>
    <Nav/>
    <main className="main"><Ticker/>{children}</main>
  </div>
}
