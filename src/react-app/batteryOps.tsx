import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { batteries, swapStations, approvals } from "./data";
import type { Approval } from "./data";
import { Drawer, Cell, Badge, Table, toast } from "./ui";
import { usePersist } from "./store";

// ---------- Allocation ----------
export type Allocation = { no: string; from: string; to: string; packs: number; minHealth: number; status: string; when: string };
const destinations = ["Production line 1", "Production line 2", ...swapStations.map((s) => s.name)];
const sources = ["Central battery store — Hosur", ...swapStations.map((s) => s.name)];

export function useAllocations() {
	return usePersist<Allocation[]>("allocations", [
		{ no: "BA-1170", from: "Central battery store — Hosur", to: "HSR Layout Sector 2", packs: 60, minHealth: 90, status: "Pending approval", when: "08 Oct, 10:58" },
		{ no: "BA-1168", from: "Central battery store — Hosur", to: "Production line 1", packs: 120, minHealth: 95, status: "Delivered", when: "07 Oct, 16:20" },
	]);
}

export function AllocateDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [, setAllocs] = useAllocations();
	const [, setApprovals] = usePersist<Approval[]>("approvals", approvals);
	const [from, setFrom] = useState(sources[0]);
	const [to, setTo] = useState(destinations[1]);
	const [packs, setPacks] = useState("40");
	const [minHealth, setMinHealth] = useState("90");
	const [err, setErr] = useState<string | null>(null);
	const eligible = useMemo(() => batteries.filter((b) => (b.status === "Ready at station" || b.status === "Charging") && b.soh >= Number(minHealth)), [minHealth]);
	const available = eligible.length * 30;
	const submit = (e: FormEvent) => {
		e.preventDefault();
		const n = Number(packs);
		if (!n || n < 1) { setErr("Enter how many packs to allocate."); return; }
		if (n > available) { setErr(`Only ${available} packs meet ${minHealth}% health right now. Lower the number or the health limit.`); return; }
		if (from === to) { setErr("Pick a destination different from the source."); return; }
		const no = `BA-${1171 + Math.floor(Math.random() * 800)}`;
		setAllocs((a) => [{ no, from, to, packs: n, minHealth: Number(minHealth), status: "Pending approval", when: "Just now" }, ...a]);
		setApprovals((l) => [{ id: no, type: "Battery allocation", title: `${n} packs (health ${minHealth}%+) → ${to}`, by: "Demo User", age: "just now", step: "Network manager" }, ...l]);
		setErr(null); onClose();
		toast(`${no} created for ${n} packs — sent to the network manager for approval`);
	};
	return (
		<Drawer open={open} onClose={onClose} title="Allocate batteries" sub="Send charged packs to a production line or swap station">
			<form className="rec-form" onSubmit={submit} noValidate>
				<label htmlFor="al-from"><span>From</span><select id="al-from" value={from} onChange={(e) => setFrom(e.target.value)}>{sources.map((s) => <option key={s}>{s}</option>)}</select></label>
				<label htmlFor="al-to"><span>Send to</span><select id="al-to" value={to} onChange={(e) => setTo(e.target.value)}>{destinations.map((s) => <option key={s}>{s}</option>)}</select></label>
				<div className="form-row">
					<label htmlFor="al-n"><span>Number of packs</span><input id="al-n" className="search" type="number" min="1" value={packs} onChange={(e) => setPacks(e.target.value)} /></label>
					<label htmlFor="al-h"><span>Minimum health</span><select id="al-h" value={minHealth} onChange={(e) => setMinHealth(e.target.value)}>{["80", "85", "90", "95"].map((h) => <option key={h} value={h}>{h}%</option>)}</select></label>
				</div>
				<div className="alloc-preview">
					<p className="hint">{available} packs available at {minHealth}% health or better. First packs picked:</p>
					<ul>
						{eligible.slice(0, 5).map((b) => <li key={b.id}><span>{b.id}</span><Cell pct={b.soh} size="sm" /><small>{b.soh}% · {b.cycles} cycles</small></li>)}
					</ul>
				</div>
				{err && <p className="form-err" role="alert">{err}</p>}
				<div className="row-btns">
					<button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
					<button type="submit" className="btn">Create allocation</button>
				</div>
			</form>
		</Drawer>
	);
}

export function AllocationList() {
	const [allocs] = useAllocations();
	return (
		<Table dense cols={[
			{ key: "no", label: "Allocation" }, { key: "to", label: "Send to" }, { key: "from", label: "From", hideSm: true },
			{ key: "packs", label: "Packs", num: true }, { key: "minHealth", label: "Health", num: true, hideSm: true, render: (r: Allocation) => `${r.minHealth}%+` },
			{ key: "when", label: "Created", hideSm: true }, { key: "status", label: "Status", render: (r: Allocation) => <Badge>{r.status}</Badge> },
		]} rows={allocs} />
	);
}

// ---------- Rebalancing ----------
export type Rebal = { no: string; from: string; to: string; qty: number; van: string; status: string };
export function useRebal() {
	return usePersist<Rebal[]>("rebal", []);
}
export function useStationAdj() {
	return usePersist<Record<string, number>>("stationAdj", {});
}
type Move = { from: string; to: string; qty: number; city: string };
function plan(adj: Record<string, number>, inFlight: Rebal[]): Move[] {
	const target = (s: (typeof swapStations)[number]) => Math.ceil(s.slots * 0.4);
	const ready = (s: (typeof swapStations)[number]) => s.ready + (adj[s.id] ?? 0) + inFlight.filter((r) => r.to === s.name).reduce((a, r) => a + r.qty, 0) - inFlight.filter((r) => r.from === s.name).reduce((a, r) => a + r.qty, 0);
	const moves: Move[] = [];
	const spare = new Map(swapStations.map((s) => [s.id, ready(s) - target(s)]));
	swapStations.filter((s) => ready(s) < target(s)).forEach((short) => {
		let need = target(short) - ready(short);
		swapStations.filter((s) => s.city === short.city && (spare.get(s.id) ?? 0) > 0).sort((a, b) => (spare.get(b.id) ?? 0) - (spare.get(a.id) ?? 0)).forEach((src) => {
			if (need <= 0) return;
			const q = Math.min(need, spare.get(src.id) ?? 0);
			if (q > 0) { moves.push({ from: src.name, to: short.name, qty: q, city: short.city }); spare.set(src.id, (spare.get(src.id) ?? 0) - q); need -= q; }
		});
	});
	return moves;
}

export function RebalanceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [rebal, setRebal] = useRebal();
	const [adj] = useStationAdj();
	const inFlight = rebal.filter((r) => r.status === "In transit");
	const moves = useMemo(() => plan(adj, inFlight), [adj, inFlight]);
	const [qty, setQty] = useState<Record<number, string>>({});
	const [van, setVan] = useState("Van KA-01-AB-1123");
	const create = () => {
		const list = moves.map((m, i) => ({ ...m, qty: Number(qty[i] ?? m.qty) })).filter((m) => m.qty > 0);
		if (!list.length) { toast("Set at least one move above zero packs"); return; }
		const base = 931 + rebal.length;
		setRebal((r) => [...list.map((m, i) => ({ no: `RB-0${base + i}`, from: m.from, to: m.to, qty: m.qty, van, status: "In transit" })), ...r]);
		setQty({}); onClose();
		toast(`${list.length} rebalancing transfer${list.length > 1 ? "s" : ""} created — ${list.reduce((a, m) => a + m.qty, 0)} packs on ${van}`);
	};
	return (
		<Drawer open={open} onClose={onClose} title="Rebalance batteries" sub="Move charged packs from full stations to short ones in the same city">
			{moves.length === 0 ? (
				<p className="empty">Every station has at least 40% of its slots ready, or transfers are already on the way. Nothing to move right now.</p>
			) : (
				<>
					<p className="hint">Suggested so every station keeps at least 40% of its slots charged. Change any quantity before creating the transfers.</p>
					<ul className="moves">
						{moves.map((m, i) => (
							<li key={i}>
								<div><b>{m.from}</b><small>to {m.to} · {m.city}</small></div>
								<label htmlFor={`mv-${i}`} className="mv-qty"><span>Packs</span><input id={`mv-${i}`} className="search" type="number" min="0" value={qty[i] ?? String(m.qty)} onChange={(e) => setQty((q) => ({ ...q, [i]: e.target.value }))} /></label>
							</li>
						))}
					</ul>
					<label htmlFor="rb-van" className="rec-form-inline"><span>Vehicle</span><select id="rb-van" value={van} onChange={(e) => setVan(e.target.value)}><option>Van KA-01-AB-1123</option><option>Van KA-05-CD-8841</option><option>Van MH-12-EF-2290</option></select></label>
					<div className="row-btns">
						<button className="btn ghost" onClick={onClose}>Cancel</button>
						<button className="btn" onClick={create}>Create transfers</button>
					</div>
				</>
			)}
		</Drawer>
	);
}

export function RebalanceList() {
	const [rebal, setRebal] = useRebal();
	const [, setAdj] = useStationAdj();
	if (!rebal.length) return <p className="empty">No rebalancing transfers yet. Use Rebalance batteries to move packs to short stations.</p>;
	const receive = (r: Rebal) => {
		const from = swapStations.find((s) => s.name === r.from)!;
		const to = swapStations.find((s) => s.name === r.to)!;
		setAdj((a) => ({ ...a, [from.id]: (a[from.id] ?? 0) - r.qty, [to.id]: (a[to.id] ?? 0) + r.qty }));
		setRebal((l) => l.map((x) => (x.no === r.no ? { ...x, status: "Received" } : x)));
		toast(`${r.qty} packs received at ${r.to} — station stock updated`);
	};
	return (
		<Table dense cols={[
			{ key: "no", label: "Transfer" }, { key: "from", label: "From" }, { key: "to", label: "To" },
			{ key: "qty", label: "Packs", num: true }, { key: "van", label: "Vehicle", hideSm: true },
			{ key: "status", label: "Status", render: (r: Rebal) => <Badge>{r.status}</Badge> },
			{ key: "a", label: "", render: (r: Rebal) => (r.status === "In transit" ? <button className="btn sm ghost" onClick={() => receive(r)}>Mark received</button> : null) },
		]} rows={rebal} />
	);
}
