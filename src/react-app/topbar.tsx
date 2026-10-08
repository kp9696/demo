import { useEffect, useMemo, useRef, useState } from "react";
import { vehicles, batteries, purchaseOrders, items, swapStations, jobCards } from "./data";
import { go } from "./nav";
import { usePersist } from "./store";

type Hit = { type: string; title: string; sub: string; route: string; open?: string };

function searchAll(q: string): Hit[] {
	const s = q.trim().toLowerCase();
	if (s.length < 2) return [];
	const has = (...f: (string | undefined)[]) => f.some((x) => x && x.toLowerCase().includes(s));
	const out: Hit[] = [];
	vehicles.filter((v) => has(v.vin, v.reg, v.customer)).slice(0, 3).forEach((v) => out.push({ type: "Vehicle", title: v.vin, sub: `${v.model} · ${v.status}${v.reg !== "—" ? ` · ${v.reg}` : ""}`, route: "vehicles", open: v.vin }));
	batteries.filter((b) => has(b.id, b.rfid, b.vehicle)).slice(0, 3).forEach((b) => out.push({ type: "Battery", title: b.id, sub: `${b.status} · health ${b.soh}%`, route: "batteries", open: b.id }));
	purchaseOrders.filter((p) => has(p.no, p.vendor)).slice(0, 3).forEach((p) => out.push({ type: "Purchase order", title: p.no, sub: `${p.vendor} · ${p.status}`, route: "procurement", open: p.no }));
	items.filter((i) => has(i.code, i.name)).slice(0, 3).forEach((i) => out.push({ type: "Item", title: i.name, sub: `${i.code} · ${i.onHand.toLocaleString("en-IN")} ${i.uom} on hand`, route: "inventory", open: i.code }));
	swapStations.filter((st) => has(st.id, st.name, st.city)).slice(0, 2).forEach((st) => out.push({ type: "Swap station", title: st.name, sub: `${st.id} · ${st.ready} ready`, route: "swap" }));
	jobCards.filter((j) => has(j.no, j.customer)).slice(0, 2).forEach((j) => out.push({ type: "Job card", title: j.no, sub: `${j.complaint} · ${j.status}`, route: "service" }));
	return out.slice(0, 8);
}

export function GlobalSearch() {
	const [q, setQ] = useState("");
	const [openList, setOpenList] = useState(false);
	const [idx, setIdx] = useState(0);
	const box = useRef<HTMLDivElement>(null);
	const hits = useMemo(() => searchAll(q), [q]);
	useEffect(() => {
		const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpenList(false); };
		document.addEventListener("mousedown", h);
		return () => document.removeEventListener("mousedown", h);
	}, []);
	const pick = (h: Hit) => { go(h.route, h.open); setQ(""); setOpenList(false); };
	return (
		<div className="global-search" ref={box}>
			<input id="global-search" value={q} placeholder="Search VIN, battery ID, PO, item, station…" aria-label="Search everything" autoComplete="off"
				onChange={(e) => { setQ(e.target.value); setOpenList(true); setIdx(0); }}
				onFocus={() => setOpenList(true)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
					else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
					else if (e.key === "Enter" && hits[idx]) pick(hits[idx]);
					else if (e.key === "Escape") setOpenList(false);
				}} />
			{openList && q.trim().length >= 2 && (
				<ul className="search-hits" role="listbox">
					{hits.length === 0 && <li className="hit-empty">Nothing matches “{q}”. Try a VIN ending, battery ID or PO number.</li>}
					{hits.map((h, i) => (
						<li key={h.type + h.title} role="option" aria-selected={i === idx} className={i === idx ? "on" : ""} onMouseEnter={() => setIdx(i)} onMouseDown={(e) => { e.preventDefault(); pick(h); }}>
							<span className="hit-type">{h.type}</span>
							<span className="hit-main"><b>{h.title}</b><small>{h.sub}</small></span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

type Notif = { id: string; kind: "Approval" | "Stock" | "Swap" | "Quality" | "Service"; text: string; when: string; route: string; open?: string; email: boolean };
const seed: Notif[] = [
	{ id: "n1", kind: "Approval", text: "PO-26-4131 for ₹22.9 L is waiting for your approval", when: "5 min ago", route: "approvals", email: true },
	{ id: "n2", kind: "Stock", text: "BMS board v4 fell below minimum stock at Hosur", when: "22 min ago", route: "inventory", open: "MAT-1022", email: true },
	{ id: "n3", kind: "Swap", text: "Kharadi EON IT Park has only 2 charged packs left", when: "34 min ago", route: "swap", email: true },
	{ id: "n4", kind: "Quality", text: "GRN-88140 (6,000 LFP cells) is waiting for inspection", when: "48 min ago", route: "procurement", email: false },
	{ id: "n5", kind: "Service", text: "Warranty claim WC-0926 (battery pack) needs a decision", when: "1 h ago", route: "service", email: true },
	{ id: "n6", kind: "Approval", text: "Battery allocation BA-1170 for 120 packs submitted", when: "2 h ago", route: "approvals", email: false },
	{ id: "n7", kind: "Stock", text: "Cycle count PC-0413 found a difference of 2 units", when: "3 h ago", route: "inventory", email: false },
];

export function Notifications() {
	const [read, setRead] = usePersist<string[]>("notifs.read", []);
	const [emailOn, setEmailOn] = usePersist<boolean>("notifs.email", true);
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const unread = seed.filter((n) => !read.includes(n.id)).length;
	useEffect(() => {
		const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
		const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("mousedown", h);
		document.addEventListener("keydown", k);
		return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
	}, []);
	return (
		<div className="notif" ref={box}>
			<button className="bell" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
				{unread > 0 && <em>{unread}</em>}
			</button>
			{open && (
				<div className="notif-panel" role="dialog" aria-label="Notifications">
					<div className="notif-head">
						<b>Notifications</b>
						<button className="btn ghost sm" disabled={unread === 0} onClick={() => setRead(seed.map((n) => n.id))}>Mark all as read</button>
					</div>
					<ul>
						{seed.map((n) => {
							const isNew = !read.includes(n.id);
							return (
								<li key={n.id} className={isNew ? "new" : ""}>
									<button onClick={() => { setRead((r) => (r.includes(n.id) ? r : [...r, n.id])); setOpen(false); go(n.route, n.open); }}>
										<span className={`nk ${n.kind.toLowerCase()}`}>{n.kind}</span>
										<span className="nt">{n.text}</span>
										<small>{n.when} · In app{n.email && emailOn ? " and by email" : ""}</small>
									</button>
								</li>
							);
						})}
					</ul>
					<label className="notif-foot">
						<input type="checkbox" id="email-alerts" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} />
						Also send approvals and urgent alerts by email
					</label>
				</div>
			)}
		</div>
	);
}
