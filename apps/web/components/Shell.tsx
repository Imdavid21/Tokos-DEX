import Link from "next/link";
import {Nav} from "./Nav";
import {Search} from "./Search";
import {ThemeToggle} from "./ThemeToggle";

export function Shell({children}:{children:React.ReactNode}){
  return <div className="shell">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Tokos Data overview"><b>tokos</b><span>&nbsp;data</span></Link>
      <Search/>
      <div className="top-actions">
        <div className="health" title="Normalized provider data health"><span className="health-dot"/>Data health</div>
        <ThemeToggle/>
      </div>
    </header>
    <Nav/>
    <main className="main">{children}</main>
  </div>
}
