import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Dashboard, MaterialFlow, Inventory } from "./pagesOps";
import { Procurement } from "./procure";
import { Production } from "./mfg";
import { Batteries, Swap } from "./pagesAssets";
import { Vehicles } from "./vehicles";
import { Finance, Approvals, Reports } from "./pagesBiz";
import { Service } from "./service";
import { Masters } from "./masters";
import { Mobile } from "./mobileApp";
import { Toaster } from "./ui";
import { GlobalSearch, Notifications } from "./topbar";
import { usePersist, resetDemo } from "./store";
import { approvals } from "./data";

const I = (d: string) => (
	<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const icons = {
	dashboard: I("M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"),
	flow: I("M3 12h4l3-7 4 14 3-7h4"),
	procurement: I("M6 6h15l-1.5 9h-12L5 3H2M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01"),
	inventory: I("M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"),
	production: I("M3 21V10l6 4V10l6 4V6l6-3v18zM7 18h2M12 18h2M17 18h2"),
	batteries: I("M3 8h15v8H3zM18 11h3v2h-3M7 10v4M11 10v4"),
	vehicles: I("M5 17a2.5 2.5 0 1 0 0 .01M19 17a2.5 2.5 0 1 0 0 .01M5 17l4-7h5l3 7M9 10l-1-3h3M14 10l2-4h3"),
	swap: I("M4 9h13l-3-3M20 15H7l3 3"),
	service: I("M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"),
	finance: I("M4 20V10M10 20V4M16 20v-7M22 20H2"),
	approvals: I("M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"),
	reports: I("M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6"),
	masters: I("M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"),
	mobile: I("M7 2h10v20H7zM11 18h2"),
};
type Route = keyof typeof icons;
const nav: { group: string; items: [Route, string, () => ReactNode, string?][] }[] = [
	{ group: "Overview", items: [["dashboard", "Dashboard", Dashboard], ["approvals", "Approvals", Approvals, "9"]] },
	{ group: "Supply chain", items: [["procurement", "Procurement", Procurement], ["inventory", "Inventory", Inventory], ["flow", "Material flow & RFID", MaterialFlow]] },
	{ group: "Make", items: [["production", "Manufacturing", Production], ["vehicles", "Vehicles", Vehicles]] },
	{ group: "Energy", items: [["batteries", "Batteries", Batteries], ["swap", "Swap network", Swap]] },
	{ group: "Sell & serve", items: [["service", "Dealers & service", Service], ["finance", "Finance & P&L", Finance], ["reports", "Reports", Reports]] },
	{ group: "Setup", items: [["masters", "Master data", Masters], ["mobile", "Mobile app", Mobile]] },
];
const all = nav.flatMap((g) => g.items);

function useRoute(): Route {
	const read = () => (window.location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard") as Route;
	const [r, setR] = useState<Route>(read);
	useEffect(() => {
		const h = () => setR(read());
		window.addEventListener("hashchange", h);
		return () => window.removeEventListener("hashchange", h);
	}, []);
	return all.some(([k]) => k === r) ? r : "dashboard";
}

export default function App() {
	const route = useRoute();
	const [menu, setMenu] = useState(false);
	const [apList] = usePersist("approvals", approvals);
	const [armed, setArmed] = useState(false);
	const Cur = all.find(([k]) => k === route)![2];
	useEffect(() => { setMenu(false); }, [route]);
	return (
		<div className={`shell ${menu ? "menu-open" : ""}`}>
			<aside className="side">
				<div className="brand">
					<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect x="2" y="8" width="24" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="26" y="13" width="4" height="6" rx="1" fill="currentColor" /><path d="M15 10l-5 7h5l-2 5 6-8h-5z" fill="var(--charge)" /></svg>
					<div><b>Voltera ERP</b><small>Demo</small></div>
				</div>
				<nav aria-label="Modules">
					{nav.map((g) => (
						<div key={g.group} className="nav-group">
							<span className="nav-title">{g.group}</span>
							{g.items.map(([k, label, , count]) => (
								<a key={k} href={`#/${k}`} className={route === k ? "on" : ""} aria-current={route === k ? "page" : undefined}>
									{icons[k]}<span>{label}</span>{(k === "approvals" ? (apList.length ? String(apList.length) : "") : count) && <em>{k === "approvals" ? apList.length : count}</em>}
								</a>
							))}
						</div>
					))}
				</nav>
				<div className="side-foot">
					<span className="avatar">DU</span>
					<div><b>Demo User</b><small>Plant head</small></div>
				</div>
				<button className={`reset ${armed ? "armed" : ""}`} onClick={() => { if (armed) resetDemo(); else { setArmed(true); window.setTimeout(() => setArmed(false), 4000); } }}>
					{armed ? "Click again to clear all demo changes" : "Reset demo data"}
				</button>
			</aside>
			<div className="scrim" onClick={() => setMenu(false)} />
			<main className="main">
				<div className="topbar">
					<button className="btn ghost menu-btn" onClick={() => setMenu(true)} aria-label="Open menu">☰</button>
					<GlobalSearch />
					<span className="demo-tag" title="Changes you make are kept in this browser until you reset">Demo data · saved in this browser</span>
					<Notifications />
				</div>
				<Cur />
			</main>
			<Toaster />
		</div>
	);
}
