import Link from "next/link";
import {Nav} from "./Nav";
import {Search} from "./Search";
import {ThemeToggle} from "./ThemeToggle";
import {maybeApi} from "@/lib/api";

export async function Shell({children}:{children:React.ReactNode}){const health=await maybeApi<{summary:{activeMarkets:number}}>("/analytics/overview?days=30");const live=Boolean(health&&health.data.summary.activeMarkets>0);
  return <div className="shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Tokos Data overview"><b>tokos</b><span>&nbsp;data</span></Link>
      <Search/>
      <div className="top-actions">
        <div className="health" title={live?"Live provider data is available":"Live provider data is unavailable"}><span className={`health-dot ${live?"":"offline"}`}/>{live?"Live provider data":"Data unavailable"}</div>
        <ThemeToggle/>
      </div>
    </header>
    <Nav/>
    <main className="main">{children}</main>
  </div>
}
