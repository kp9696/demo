import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { items, counts, vendors, inr, lakh, sum } from "./data";
import type { Item } from "./data";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, HBars, Bar, Tabs, Drawer, Facts, Timeline, Search, toast } from "./ui";
import { usePersist, useOpenParam } from "./store";
import {
	useStock, useLevels, levelsOf, usePRs, useApprovalList, useAdjustments, useRequestAdjustment, useRecon,
	itemByCode, LOCS, CENTRAL, LINE, SITE, SERVICE,
} from "./stock";
import type { Move, Levels } from "./stock";
import { useWOs, useIssued, kit } from "./mfg";

// ---------- helpers ----------
const tabs = ["Stock", "Warehouses & bins", "Movements", "Transfers", "Batches & serials", "Reservations", "Levels & reorder", "Adjustments", "Physical count", "Reconciliation", "Reports"] as const;
type Tab = (typeof tabs)[number];
const n = (v: number) => v.toLocaleString("en-IN");
function useBins() { return usePersist<Record<string, string>>("binMap", {}); }
const binOf = (i: Item, bm: Record<string, string>) => bm[i.code] ?? i.bin;
function stateOf(total: number, l: Levels, age: number) {
	if (total < l.min) return "Below min";
	if (total < l.reorder) return "Reorder";
	if (total > l.max) return "Excess";
	if (age > 180) return "Non-moving";
	if (age > 120) return "Slow-moving";
	return "OK";
}
const stateTone = (s: string) => (s === "Below min" || s === "Reorder" ? "bad" : s === "OK" ? "good" : "warn");

/** Stock reserved for released work orders and open job cards. */
function useReservations() {
	const [wos] = useWOs();
	const [issued] = useIssued();
	const [jobs] = usePersist<{ no: string; parts: { part: string; qty: number; status: string }[] }[]>("svcJobs", [{ no: "JC-31203", parts: [{ part: "Brake pad set", qty: 1, status: "Requested" }] }]);
	return useMemo(() => {
		const r: Record<string, { total: number; lines: { ref: string; what: string; qty: number }[] }> = {};
		const add = (name: string, ref: string, what: string, q: number) => {
			const it = items.find((i) => i.name === name); if (!it || q <= 0) return;
			r[it.code] ??= { total: 0, lines: [] };
			r[it.code].total += q; r[it.code].lines.push({ ref, what, qty: q });
		};
		wos.filter((w) => ["Released", "In progress", "Material short"].includes(w.status)).forEach((w) =>
			kit.forEach(([p, per]) => add(p, w.no, `${w.model} × ${w.qty} · ${w.line}`, per * w.qty - (issued[w.no]?.[p] ?? 0))));
		jobs.forEach((j) => j.parts.filter((p) => p.status === "Requested").forEach((p) => add(p.part, j.no, "Service job card", p.qty)));
		return r;
	}, [wos, issued, jobs]);
}

function useAccuracy() {
	return usePersist<{ no: string; date: string; acc: number }[]>("accuracy", [
		{ no: "PC-0405", date: "16 Sep", acc: 97.2 }, { no: "PC-0408", date: "23 Sep", acc: 97.9 }, { no: "PC-0410", date: "30 Sep", acc: 98.4 },
		{ no: "PC-0412", date: "07 Oct", acc: 100 }, { no: "PC-0413", date: "08 Oct", acc: 98.6 }, { no: "PC-0414", date: "08 Oct", acc: 100 },
	]);
}

// ---------- page ----------
export function Inventory() {
	const [tab, setTab] = useState<Tab>("Stock");
	const { qty } = useStock();
	const [lv] = useLevels();
	const [acc] = useAccuracy();
	const [sel, setSel] = useState<string | null>(null);
	const open = useOpenParam();
	useEffect(() => { if (open.id && items.some((i) => i.code === open.id)) { setTab("Stock"); setSel(open.id); } }, [open]);
	const value = sum(items.map((i) => qty(i.code) * i.unitCost));
	const below = items.filter((i) => qty(i.code) < levelsOf(i, lv).min);
	const accNow = acc.slice(-3).reduce((a, x) => a + x.acc, 0) / Math.min(3, acc.length);
	return (
		<Page title="Inventory & warehouses" sub="One stock ledger for every location — receipts, issues, transfers and adjustments update it as they happen"
			actions={<><button className="btn ghost" onClick={() => setTab("Transfers")}>Transfer stock</button><button className="btn ghost" onClick={() => setTab("Adjustments")}>Adjust stock</button><button className="btn" onClick={() => toast("Exported inventory_08-Oct-2026.xlsx")}>Export</button></>}>
			<Stats>
				<Stat label="Inventory value" value={lakh(value)} delta={`${items.length} SKUs across ${LOCS.length} locations`} onClick={() => setTab("Reports")} />
				<Stat label="Below minimum" value={String(below.length)} delta={below.length ? below.map((i) => i.name.split(" ")[0]).slice(0, 3).join(", ") : "All items stocked"} tone={below.length ? "bad" : "good"} onClick={() => setTab("Levels & reorder")} />
				<Stat label="Slow or non-moving" value={lakh(sum(items.filter((i) => i.ageDays > 120).map((i) => qty(i.code) * i.unitCost)))} delta="Stock older than 120 days" tone="warn" onClick={() => setTab("Reports")} />
				<Stat label="Stock accuracy" value={`${accNow.toFixed(1)}%`} delta="Last 3 RFID counts" tone={accNow >= 98 ? "good" : "warn"} onClick={() => setTab("Physical count")} />
			</Stats>
			<Panel right={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
				{tab === "Stock" && <StockTab onOpen={setSel} />}
				{tab === "Warehouses & bins" && <WarehousesTab onOpen={setSel} />}
				{tab === "Movements" && <MovementsTab />}
				{tab === "Transfers" && <TransfersTab />}
				{tab === "Batches & serials" && <BatchesTab />}
				{tab === "Reservations" && <ReservationsTab />}
				{tab === "Levels & reorder" && <LevelsTab />}
				{tab === "Adjustments" && <AdjustmentsTab />}
				{tab === "Physical count" && <CountTab onDone={() => setTab("Reconciliation")} />}
				{tab === "Reconciliation" && <ReconTab />}
				{tab === "Reports" && <ReportsTab />}
			</Panel>
			<Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? itemByCode(sel).name : ""} sub={sel ? `${sel} · ${itemByCode(sel).category}` : ""}>
				{sel && <ItemDetail code={sel} />}
			</Drawer>
		</Page>
	);
}

// ---------- 1. Stock ----------
function StockTab({ onOpen }: { onOpen: (code: string) => void }) {
	const { qty } = useStock();
	const [lv] = useLevels();
	const res = useReservations();
	const [loc, setLoc] = useState("All locations");
	const [q, setQ] = useState("");
	const [st, setSt] = useState("All");
	const rows = items.map((i) => {
		const total = qty(i.code), here = loc === "All locations" ? total : qty(i.code, loc), l = levelsOf(i, lv);
		const reserved = res[i.code]?.total ?? 0, central = qty(i.code, CENTRAL);
		return { i, total, here, l, reserved, free: central - reserved, state: stateOf(total, l, i.ageDays) };
	}).filter((r) => (r.i.name + r.i.code).toLowerCase().includes(q.toLowerCase()) && (st === "All" || r.state === st) && (loc === "All locations" || r.here !== 0));
	return (
		<>
			<div className="filters" style={{ marginBottom: 12 }}>
				<Search value={q} onChange={setQ} placeholder="Search item or code" />
				<select value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location"><option>All locations</option>{LOCS.map((w) => <option key={w}>{w}</option>)}</select>
				<select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Status">{["All", "Below min", "Reorder", "Excess", "Slow-moving", "Non-moving", "OK"].map((s) => <option key={s}>{s}</option>)}</select>
			</div>
			<Table cols={[
				{ key: "code", label: "Code", hideSm: true, render: (r: typeof rows[number]) => r.i.code },
				{ key: "name", label: "Item", render: (r) => r.i.name },
				{ key: "here", label: loc === "All locations" ? "On hand" : "Here", num: true, render: (r) => `${n(r.here)} ${r.i.uom}` },
				{ key: "res", label: "Reserved", num: true, hideSm: true, render: (r) => (r.reserved ? n(r.reserved) : "—") },
				{ key: "free", label: "Free at Central", num: true, hideSm: true, render: (r) => <span className={r.free < 0 ? "neg" : ""}>{n(r.free)}</span> },
				{ key: "lvl", label: "Min / max", hideSm: true, render: (r) => <span className="inline-bar"><Bar pct={(r.total / r.l.max) * 100} tone={r.total < r.l.min ? "bad" : r.total > r.l.max ? "warn" : "accent"} /></span> },
				{ key: "val", label: "Value", num: true, hideSm: true, render: (r) => inr(r.here * r.i.unitCost) },
				{ key: "st", label: "Status", render: (r) => (r.state === "OK" ? <span className="sub">OK</span> : <Badge tone={stateTone(r.state)}>{r.state}</Badge>) },
			]} rows={rows} onRow={(r) => onOpen(r.i.code)} />
			{rows.length === 0 && <p className="empty">No items match. Clear the search or pick another location or status.</p>}
		</>
	);
}

function ItemDetail({ code }: { code: string }) {
	const i = itemByCode(code);
	const { qty, all } = useStock();
	const [lv] = useLevels();
	const [bm] = useBins();
	const res = useReservations();
	const l = levelsOf(i, lv);
	const total = qty(code), reserved = res[code]?.total ?? 0;
	const moves = all.filter((m) => m.code === code && m.type !== "Bin move").slice(0, 8);
	return (
		<>
			<Facts rows={[
				["On hand, all locations", `${n(total)} ${i.uom}`], ["Reserved", `${n(reserved)} ${i.uom}`], ["Free at Central WH", `${n(qty(code, CENTRAL) - reserved)} ${i.uom}`],
				["Min / reorder / max", `${l.min} / ${l.reorder} / ${l.max}`], ["Status", <Badge tone={stateTone(stateOf(total, l, i.ageDays))}>{stateOf(total, l, i.ageDays)}</Badge>],
				["Bin at Central WH", binOf(i, bm)], ["Tracking", `${i.tracking}${i.rfid ? " + RFID" : ""}`], ["Unit cost (weighted avg)", inr(i.unitCost)], ["Value", inr(total * i.unitCost)], ["Oldest stock", `${i.ageDays} days`],
			]} />
			<h3 className="mini">By location</h3>
			<Table dense cols={[{ key: "l", label: "Location" }, { key: "q", label: "Qty", num: true, render: (r: { q: number }) => n(r.q) }, { key: "v", label: "Value", num: true, render: (r: { q: number }) => inr(r.q * i.unitCost) }]}
				rows={LOCS.map((l2) => ({ l: l2, q: qty(code, l2) }))} />
			{res[code] && (
				<>
					<h3 className="mini">Reserved for</h3>
					<Table dense cols={[{ key: "ref", label: "Order" }, { key: "what", label: "For" }, { key: "qty", label: "Qty", num: true }]} rows={res[code].lines} />
				</>
			)}
			<h3 className="mini">Movements</h3>
			{moves.length ? <Timeline items={moves.map((m) => ({ when: m.when, what: `${m.type}: ${m.qty > 0 ? "+" : ""}${n(m.qty)} ${i.uom}`, where: m.loc, detail: `${m.ref} · ${m.by}${m.note ? ` · ${m.note}` : ""}` }))} /> : <p className="hint">No movements yet.</p>}
		</>
	);
}

// ---------- 2. Warehouses and bins ----------
const binTotals: Record<string, number> = { [CENTRAL]: 48, [LINE]: 12, [SITE]: 24, [SERVICE]: 16 };
const aisles = ["A", "B", "C", "D"], racks = Array.from({ length: 12 }, (_, k) => String(k + 1).padStart(2, "0"));
function WarehousesTab({ onOpen }: { onOpen: (code: string) => void }) {
	const { qty, post } = useStock();
	const [bm, setBm] = useBins();
	const [loc, setLoc] = useState(CENTRAL);
	const [cell, setCell] = useState<string | null>(null);
	const [moveCode, setMoveCode] = useState("");
	const [target, setTarget] = useState("A-01");
	const inCell = (c: string) => items.filter((i) => qty(i.code, CENTRAL) > 0 && binOf(i, bm).startsWith(c));
	const summary = LOCS.map((l) => {
		const here = items.filter((i) => qty(i.code, l) > 0);
		const used = l === CENTRAL ? new Set(here.map((i) => binOf(i, bm).slice(0, 4))).size : Math.min(binTotals[l], Math.ceil(here.length * 0.6));
		return { l, skus: here.length, units: sum(here.map((i) => qty(i.code, l))), value: sum(here.map((i) => qty(i.code, l) * i.unitCost)), used };
	});
	const doMove = () => {
		const it = items.find((i) => i.code === moveCode);
		if (!it) { toast("Pick the item to move"); return; }
		const from = binOf(it, bm);
		const to = `${target}-${from.split("-")[2] ?? "1"}`;
		if (to.startsWith(from.slice(0, 4))) { toast("Pick a different bin"); return; }
		setBm((b) => ({ ...b, [it.code]: to }));
		post([{ type: "Bin move", code: it.code, loc: CENTRAL, qty: 0, ref: `BM-${Date.now() % 10000}`, by: "Handheld HH-03", note: `${from} → ${to}` }]);
		toast(`${it.name} moved from ${from} to ${to}`);
		setCell(target); setMoveCode("");
	};
	return (
		<>
			<div className="wh-cards">
				{summary.map((s) => (
					<button key={s.l} className={`wh-card ${loc === s.l ? "on" : ""}`} onClick={() => { setLoc(s.l); setCell(null); }}>
						<b>{s.l}</b>
						<span>{lakh(s.value)}</span>
						<small>{s.skus} SKUs · {n(s.units)} units</small>
						<span className="inline-bar"><Bar pct={(s.used / binTotals[s.l]) * 100} />{s.used}/{binTotals[s.l]} bins</span>
					</button>
				))}
			</div>
			{loc === CENTRAL ? (
				<div className="split">
					<div>
						<h3 className="mini">Bin map — Central WH, aisles A–D, racks 01–12</h3>
						<div className="bin-grid" role="grid" aria-label="Bin map">
							{aisles.map((a) => (
								<div key={a} className="bin-row" role="row">
									<span className="bin-aisle">{a}</span>
									{racks.map((r) => {
										const c = `${a}-${r}`, its = inCell(c), units = sum(its.map((i) => qty(i.code, CENTRAL)));
										const fill = Math.min(100, Math.round(units / 20));
										return (
											<button key={c} role="gridcell" aria-label={`Bin ${c}, ${its.length} items, ${fill}% full`} className={`bin ${cell === c ? "on" : ""} ${!its.length ? "empty" : fill > 80 ? "full" : fill > 40 ? "mid" : "low"}`} onClick={() => setCell(c)}>
												<small>{r}</small>
											</button>
										);
									})}
								</div>
							))}
						</div>
						<p className="slot-legend"><span><i className="bl-e" />Empty</span><span><i className="bl-l" />Under 40% full</span><span><i className="bl-m" />40–80%</span><span><i className="bl-f" />Over 80%</span></p>
					</div>
					<div>
						{cell ? (
							<>
								<h3 className="mini">Bin {cell}</h3>
								{inCell(cell).length ? (
									<Table dense cols={[{ key: "n", label: "Item", render: (i: Item) => i.name }, { key: "b", label: "Bin", render: (i: Item) => binOf(i, bm) }, { key: "q", label: "Qty", num: true, render: (i: Item) => n(qty(i.code, CENTRAL)) }]} rows={inCell(cell)} onRow={(i) => onOpen(i.code)} />
								) : <p className="hint">Empty bin. Move an item here below.</p>}
								<div className="pick-box" style={{ marginTop: 12 }}>
									<b>Move an item to another bin</b>
									<div className="inline-add">
										<select aria-label="Item to move" value={moveCode} onChange={(e) => setMoveCode(e.target.value)}><option value="">Item</option>{(inCell(cell).length ? inCell(cell) : items.filter((i) => qty(i.code, CENTRAL) > 0)).map((i) => <option key={i.code} value={i.code}>{i.name} · {binOf(i, bm)}</option>)}</select>
										<select aria-label="Target bin" value={target} onChange={(e) => setTarget(e.target.value)}>{aisles.flatMap((a) => racks.map((r) => `${a}-${r}`)).map((b) => <option key={b}>{b}</option>)}</select>
										<button className="btn sm" onClick={doMove}>Move</button>
									</div>
								</div>
							</>
						) : <p className="empty">Click a bin to see what is in it.</p>}
					</div>
				</div>
			) : (
				<>
					<h3 className="mini">{loc}</h3>
					<Table dense cols={[{ key: "n", label: "Item", render: (i: Item) => i.name }, { key: "c", label: "Category", hideSm: true, render: (i: Item) => i.category }, { key: "q", label: "Qty", num: true, render: (i: Item) => `${n(qty(i.code, loc))} ${i.uom}` }, { key: "v", label: "Value", num: true, render: (i: Item) => inr(qty(i.code, loc) * i.unitCost) }]}
						rows={items.filter((i) => qty(i.code, loc) !== 0)} onRow={(i) => onOpen(i.code)} />
				</>
			)}
		</>
	);
}

// ---------- 3. Movements ----------
const moveTypes = ["All", "Receipt", "Issue to line", "Line receipt", "Issue to service", "Transfer out", "Transfer in", "Adjustment", "Return to vendor", "Bin move"];
const inTypes = new Set(["Receipt", "Line receipt", "Transfer in"]);
function MovementsTab() {
	const { all } = useStock();
	const [t, setT] = useState("All");
	const [q, setQ] = useState("");
	const rows = all.filter((m) => (t === "All" || m.type === t) && (itemByCode(m.code).name + m.ref).toLowerCase().includes(q.toLowerCase()));
	const today = all.filter((m) => !m.hist);
	return (
		<>
			<div className="mini-stats">
				<span><small>Movements in this demo</small><b>{today.length}</b></span>
				<span><small>Units received</small><b>{n(sum(today.filter((m) => m.type === "Receipt").map((m) => m.qty)))}</b></span>
				<span><small>Units issued</small><b>{n(-sum(today.filter((m) => m.type.startsWith("Issue")).map((m) => m.qty)))}</b></span>
				<span><small>Adjustments posted</small><b>{today.filter((m) => m.type === "Adjustment" || m.type === "Return to vendor").length}</b></span>
			</div>
			<div className="filters" style={{ marginBottom: 12 }}>
				<Search value={q} onChange={setQ} placeholder="Item or reference" />
				<select aria-label="Movement type" value={t} onChange={(e) => setT(e.target.value)}>{moveTypes.map((x) => <option key={x}>{x}</option>)}</select>
				<button className="btn ghost sm" onClick={() => toast("Stock ledger exported to Excel")}>Excel</button>
			</div>
			<Table dense cols={[
				{ key: "when", label: "When", render: (m: Move) => <>{m.when}{!m.hist && <> <Badge tone="info">New</Badge></>}</> },
				{ key: "type", label: "Type", render: (m: Move) => <Badge tone={m.type === "Bin move" ? "muted" : inTypes.has(m.type) || (m.type === "Adjustment" && m.qty > 0) ? "good" : "warn"}>{m.type}</Badge> },
				{ key: "item", label: "Item", render: (m: Move) => itemByCode(m.code).name },
				{ key: "loc", label: "Location", hideSm: true },
				{ key: "qty", label: "Qty", num: true, render: (m: Move) => (m.type === "Bin move" ? m.note : <span className={m.qty < 0 ? "neg" : "pos"}>{m.qty > 0 ? "+" : ""}{n(m.qty)}</span>) },
				{ key: "ref", label: "Reference" },
				{ key: "by", label: "By", hideSm: true, render: (m: Move) => <>{m.by}{m.note && m.type !== "Bin move" ? <small className="sub"> · {m.note}</small> : null}</> },
			]} rows={rows} />
			{rows.length === 0 && <p className="empty">No movements match.</p>}
		</>
	);
}

// ---------- 4. Transfers ----------
type Transfer = { no: string; from: string; to: string; lines: { code: string; qty: number }[]; status: "Pending approval" | "In transit" | "Delivered"; eta: string };
const trSeed: Transfer[] = [
	{ no: "TR-0931", from: CENTRAL, to: SITE, lines: [{ code: items[23].code, qty: 400 }, { code: items[9].code, qty: 120 }], status: "In transit", eta: "09 Oct" },
	{ no: "TR-0930", from: CENTRAL, to: LINE, lines: [{ code: items[0].code, qty: 60 }, { code: items[1].code, qty: 60 }], status: "Delivered", eta: "08 Oct" },
	{ no: "TR-0929", from: SITE, to: SERVICE, lines: [{ code: items[21].code, qty: 25 }], status: "Pending approval", eta: "11 Oct" },
	{ no: "TR-0927", from: CENTRAL, to: SITE, lines: [{ code: items[19].code, qty: 60 }], status: "Delivered", eta: "03 Oct" },
];
function TransfersTab() {
	const { qty, post } = useStock();
	const [rows, setRows] = usePersist<Transfer[]>("stockTransfers", trSeed);
	const [from, setFrom] = useState(CENTRAL);
	const [to, setTo] = useState(SITE);
	const [code, setCode] = useState(items[0].code);
	const [q, setQ] = useState("50");
	const out = (t: Transfer, ref = t.no) => post(t.lines.map((l) => ({ type: "Transfer out" as const, code: l.code, loc: t.from, qty: -l.qty, ref, by: "Stores", note: `To ${t.to}` })));
	const submit = (e: FormEvent) => {
		e.preventDefault();
		const v = Number(q);
		if (from === to) { toast("Pick two different locations"); return; }
		if (!(v > 0)) { toast("Enter a quantity above zero"); return; }
		if (v > qty(code, from)) { toast(`Only ${n(qty(code, from))} at ${from}`); return; }
		const no = `TR-0${932 + rows.length - 4}`;
		const t: Transfer = { no, from, to, lines: [{ code, qty: v }], status: "In transit", eta: "Tomorrow" };
		setRows((r) => [t, ...r]); out(t);
		toast(`${no}: ${v} × ${itemByCode(code).name} left ${from} — in transit to ${to}`);
	};
	const receive = (t: Transfer) => {
		post(t.lines.map((l) => ({ type: "Transfer in" as const, code: l.code, loc: t.to, qty: l.qty, ref: t.no, by: "Receiving stores", note: `From ${t.from}` })));
		setRows((r) => r.map((x) => (x.no === t.no ? { ...x, status: "Delivered", eta: "Today" } : x)));
		toast(`${t.no} received at ${t.to} — stock updated`);
	};
	const approve = (t: Transfer) => {
		const short = t.lines.find((l) => l.qty > qty(l.code, t.from));
		if (short) { toast(`Not enough ${itemByCode(short.code).name} at ${t.from}`); return; }
		out(t); setRows((r) => r.map((x) => (x.no === t.no ? { ...x, status: "In transit" } : x)));
		toast(`${t.no} approved and dispatched from ${t.from}`);
	};
	return (
		<>
			<form className="inline-form" onSubmit={submit}>
				<label>From<select id="tr-from" value={from} onChange={(e) => setFrom(e.target.value)}>{LOCS.map((w) => <option key={w}>{w}</option>)}</select></label>
				<label>To<select id="tr-to" value={to} onChange={(e) => setTo(e.target.value)}>{LOCS.map((w) => <option key={w}>{w}</option>)}</select></label>
				<label>Item<select id="tr-item" value={code} onChange={(e) => setCode(e.target.value)}>{items.map((i) => <option key={i.code} value={i.code}>{i.name} · {n(qty(i.code, from))} at source</option>)}</select></label>
				<label>Qty<input id="tr-qty" className="search" type="number" min="1" value={q} onChange={(e) => setQ(e.target.value)} /></label>
				<button className="btn" type="submit">Send transfer</button>
			</form>
			<Table cols={[
				{ key: "no", label: "Transfer" }, { key: "from", label: "From", hideSm: true }, { key: "to", label: "To" },
				{ key: "lines", label: "Items", render: (t: Transfer) => t.lines.map((l) => `${itemByCode(l.code).name} × ${n(l.qty)}`).join(", ") },
				{ key: "eta", label: "Arrives", hideSm: true },
				{ key: "status", label: "Status", render: (t: Transfer) => <Badge>{t.status}</Badge> },
				{ key: "a", label: "", render: (t: Transfer) => (t.status === "In transit" ? <button className="btn sm" onClick={() => receive(t)}>Receive</button> : t.status === "Pending approval" ? <button className="btn sm ghost" onClick={() => approve(t)}>Approve and send</button> : null) },
			]} rows={rows} />
		</>
	);
}

// ---------- 5. Batches and serials ----------
const vendorFor = (i: Item) => (i.category === "Battery" ? vendors[0].name : i.category === "Drivetrain" ? vendors[1].name : i.category === "Chassis" ? vendors[2].name : i.category === "Lighting" || i.category === "Brakes" ? vendors[3].name : i.category === "Wheels" ? vendors[4].name : vendors[5].name);
function BatchesTab() {
	const { qty, moves } = useStock();
	const tracked = items.filter((i) => i.tracking !== "None");
	const [code, setCode] = useState(items[2].code);
	const [sq, setSq] = useState("");
	const i = itemByCode(code);
	const total = qty(code);
	const opening = i.onHand;
	const batches = useMemo(() => {
		const exp = i.category === "Battery" ? 24 : i.category === "Wheels" ? 36 : 0;
		const base = [["02 Sep", 0.5, 2609], ["18 Sep", 0.3, 2609], ["03 Oct", 0.2, 2610]].map(([d, f, ym], k) => ({ no: `${i.code.slice(4)}-${ym}-${String(k + 3).padStart(2, "0")}`, date: d as string, vendor: vendorFor(i), qty: Math.round(opening * (f as number)), exp }));
		const rec = moves.filter((m) => m.code === code && m.type === "Receipt").reverse().map((m) => ({ no: m.batch ?? m.ref, date: m.when.slice(0, 6), vendor: m.note ?? vendorFor(i), qty: m.qty, exp }));
		const all = [...base, ...rec];
		let used = Math.max(0, sum(all.map((b) => b.qty)) - total);
		return all.map((b) => { const take = Math.min(used, b.qty); used -= take; return { ...b, left: b.qty - take }; });
	}, [code, moves, total, opening, i]);
	const serials = useMemo(() => {
		const pre = { "Hub motor 2.5 kW": "HM25", "Motor controller 48V": "MC48", "BMS board v4": "BMS4", "Main frame — S1": "FR-S1", "TFT cluster 5in": "TFT5", "DC-DC converter": "DCDC", "Charger 48V 10A": "CHG48", "IoT telematics unit": "IOT" }[i.name] ?? "SN";
		const where = (k: number) => k < 5 ? [`In store · ${CENTRAL}`, "info"] : k < 7 ? ["At line-side · Line 1", "warn"] : k < 10 ? [`Fitted · VIN …0521${String(10 + k * 3)}`, "good"] : k < 11 ? [`In store · ${SERVICE}`, "info"] : ["Returned to vendor (RMA)", "bad"];
		return Array.from({ length: 12 }, (_, k) => ({ sn: `${pre}-${88300 + k * 17}`, at: where(k)[0], tone: where(k)[1] }));
	}, [i]);
	const sFound = serials.filter((s) => s.sn.toLowerCase().includes(sq.toLowerCase()));
	return (
		<>
			<div className="filters" style={{ marginBottom: 12 }}>
				<select aria-label="Item" value={code} onChange={(e) => { setCode(e.target.value); setSq(""); }}>{tracked.map((t) => <option key={t.code} value={t.code}>{t.name} · {t.tracking}</option>)}</select>
				<span className="hint" style={{ margin: 0 }}>{n(total)} {i.uom} on hand · tracked by {i.tracking.toLowerCase()}</span>
			</div>
			{i.tracking === "Batch" ? (
				<>
					<p className="hint">Issues use the oldest batch first (FIFO). A goods receipt creates a new batch.</p>
					<Table cols={[
						{ key: "no", label: "Batch / lot" }, { key: "date", label: "Received" }, { key: "vendor", label: "Vendor", hideSm: true },
						{ key: "qty", label: "Received qty", num: true, hideSm: true, render: (b: typeof batches[number]) => n(b.qty) },
						{ key: "left", label: "Left", num: true, render: (b: typeof batches[number]) => <span className="inline-bar"><Bar pct={(b.left / Math.max(1, b.qty)) * 100} />{n(b.left)}</span> },
						{ key: "exp", label: "Use by", hideSm: true, render: (b: typeof batches[number]) => (b.exp ? `${b.date.slice(0, 6)} ${2026 + b.exp / 12}` : "—") },
						{ key: "s", label: "", render: (b: typeof batches[number]) => <Badge tone={b.left === 0 ? "muted" : "good"}>{b.left === 0 ? "Used up" : "In stock"}</Badge> },
					]} rows={batches} />
				</>
			) : (
				<>
					<div className="mini-stats">{LOCS.map((l) => <span key={l}><small>{l}</small><b>{n(qty(code, l))}</b></span>)}</div>
					<div className="filters" style={{ marginBottom: 10 }}><Search value={sq} onChange={setSq} placeholder="Find a serial number" /><span className="hint" style={{ margin: 0 }}>Showing a sample of serials</span></div>
					<Table dense cols={[{ key: "sn", label: "Serial number" }, { key: "at", label: "Where it is now", render: (s: { at: string; tone: string }) => <Badge tone={s.tone}>{s.at}</Badge> }]} rows={sFound} />
					{sFound.length === 0 && <p className="empty">No serial matches “{sq}”.</p>}
				</>
			)}
		</>
	);
}

// ---------- 6. Reservations ----------
function ReservationsTab() {
	const { qty } = useStock();
	const res = useReservations();
	const rows = Object.entries(res).map(([code, r]) => ({ code, i: itemByCode(code), reserved: r.total, central: qty(code, CENTRAL), lines: r.lines })).sort((a, b) => (a.central - a.reserved) - (b.central - b.reserved));
	return (
		<>
			<p className="hint">Released work orders reserve their parts until they are issued to the line; open job cards reserve requested spares. Free stock = Central WH stock − reserved.</p>
			<Table cols={[
				{ key: "i", label: "Item", render: (r: typeof rows[number]) => r.i.name },
				{ key: "central", label: "At Central", num: true, render: (r) => n(r.central) },
				{ key: "reserved", label: "Reserved", num: true, render: (r) => n(r.reserved) },
				{ key: "free", label: "Free", num: true, render: (r) => <span className={r.central - r.reserved < 0 ? "neg" : ""}>{n(r.central - r.reserved)}</span> },
				{ key: "for", label: "Reserved for", hideSm: true, render: (r) => r.lines.map((l) => `${l.ref} (${n(l.qty)})`).join(", ") },
				{ key: "s", label: "", render: (r) => (r.central - r.reserved < 0 ? <Badge tone="bad">Short</Badge> : <Badge tone="good">Covered</Badge>) },
			]} rows={rows} />
			{rows.length === 0 && <p className="empty">Nothing reserved. Release a work order in Manufacturing to reserve its parts.</p>}
		</>
	);
}

// ---------- 7. Levels and reorder ----------
function LevelsTab() {
	const { qty } = useStock();
	const [lv, setLv] = useLevels();
	const [prs, setPrs] = usePRs();
	const [, setAp] = useApprovalList();
	const openPR = (i: Item) => prs.find((p) => p.item === i.name && !["Rejected", "PO raised"].includes(p.status) && !p.link?.startsWith("PO"));
	const due = items.filter((i) => qty(i.code) < levelsOf(i, lv).reorder && !openPR(i));
	const set = (i: Item, k: keyof Levels, v: string) => setLv((m) => ({ ...m, [i.code]: { ...levelsOf(i, m), [k]: Math.max(0, Number(v) || 0) } }));
	const raiseAll = () => {
		const made = due.map((i, k) => { const l = levelsOf(i, lv); return { no: `PR-${1950 + prs.length + k}`, i, q: Math.max(10, Math.ceil((l.max - qty(i.code)) / 10) * 10) }; });
		setPrs((l) => [...made.map((m) => ({ no: m.no, item: m.i.name, qty: m.q, need: "20 Oct", by: "Reorder check", reason: `Below reorder level ${levelsOf(m.i, lv).reorder}`, source: "Reorder" as const, status: "Pending approval" })), ...l]);
		setAp((l) => [...made.map((m) => ({ id: m.no, type: "Purchase requisition", title: `${n(m.q)} × ${m.i.name} (reorder)`, by: "Reorder check", value: m.q * m.i.unitCost, age: "just now", step: "Plant head" })), ...l]);
		toast(`${made.length} requisition${made.length === 1 ? "" : "s"} raised and sent for approval`);
	};
	return (
		<>
			<div className="row-btns spread">
				<p className="hint" style={{ margin: 0 }}>Auto-reorder is on: when any movement takes an item below its reorder level, a requisition is raised and sent for approval. Change a level and it applies at once.</p>
				<button className="btn" disabled={!due.length} onClick={raiseAll}>Raise requisitions ({due.length})</button>
			</div>
			<Table dense cols={[
				{ key: "n", label: "Item", render: (i: Item) => i.name },
				{ key: "q", label: "On hand", num: true, render: (i: Item) => n(qty(i.code)) },
				...(["min", "reorder", "max"] as const).map((k) => ({ key: k, label: k === "min" ? "Min" : k === "reorder" ? "Reorder at" : "Max", num: true, render: (i: Item) => <input className="qty-in" type="number" min="0" aria-label={`${k} for ${i.name}`} value={levelsOf(i, lv)[k]} onChange={(e) => set(i, k, e.target.value)} /> })),
				{ key: "s", label: "Status", render: (i: Item) => { const l = levelsOf(i, lv); const bad = l.min > l.reorder || l.reorder > l.max; const s = stateOf(qty(i.code), l, 0); return bad ? <Badge tone="bad">Min ≤ reorder ≤ max</Badge> : s === "OK" ? <span className="sub">OK</span> : <Badge tone={stateTone(s)}>{s}</Badge>; } },
				{ key: "pr", label: "Requisition", render: (i: Item) => { const p = openPR(i); return p ? <Badge tone="info">{`${p.no} · ${p.status}`}</Badge> : null; } },
			]} rows={items} />
		</>
	);
}

// ---------- 8. Adjustments ----------
const reasons = ["Damaged in storage", "Scrap", "Found in count", "Expired", "Return to vendor", "Other"];
function AdjustmentsTab() {
	const { qty } = useStock();
	const [adjs] = useAdjustments();
	const request = useRequestAdjustment();
	const [code, setCode] = useState(items[0].code);
	const [loc, setLoc] = useState(CENTRAL);
	const [dir, setDir] = useState<"-" | "+">("-");
	const [q, setQ] = useState("");
	const [reason, setReason] = useState(reasons[0]);
	const submit = (e: FormEvent) => {
		e.preventDefault();
		const v = Number(q);
		if (!(v > 0)) { toast("Enter a quantity above zero"); return; }
		if (dir === "-" && v > qty(code, loc)) { toast(`Only ${n(qty(code, loc))} at ${loc}`); return; }
		const no = request({ code, loc, qty: dir === "-" ? -v : v, reason });
		setQ("");
		toast(`${no} sent for approval — stock changes only after it is approved`);
	};
	return (
		<>
			<form className="inline-form" onSubmit={submit}>
				<label>Item<select id="adj-i" value={code} onChange={(e) => setCode(e.target.value)}>{items.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}</select></label>
				<label>Location<select id="adj-l" value={loc} onChange={(e) => setLoc(e.target.value)}>{LOCS.map((l) => <option key={l}>{l}</option>)}</select></label>
				<label>Change<select id="adj-d" value={dir} onChange={(e) => setDir(e.target.value as "-" | "+")}><option value="-">Reduce</option><option value="+">Increase</option></select></label>
				<label>Qty<input id="adj-q" className="search" type="number" min="1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${n(qty(code, loc))} now`} /></label>
				<label>Reason<select id="adj-r" value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((r) => <option key={r}>{r}</option>)}</select></label>
				<button className="btn" type="submit">Send for approval</button>
			</form>
			<Table cols={[
				{ key: "no", label: "Adjustment" }, { key: "when", label: "Raised", hideSm: true },
				{ key: "item", label: "Item", render: (a: typeof adjs[number]) => itemByCode(a.code).name }, { key: "loc", label: "Location", hideSm: true },
				{ key: "qty", label: "Qty", num: true, render: (a: typeof adjs[number]) => <span className={a.qty < 0 ? "neg" : "pos"}>{a.qty > 0 ? "+" : ""}{n(a.qty)}</span> },
				{ key: "val", label: "Value", num: true, hideSm: true, render: (a: typeof adjs[number]) => inr(a.qty * itemByCode(a.code).unitCost) },
				{ key: "reason", label: "Reason", hideSm: true },
				{ key: "status", label: "Status", render: (a: typeof adjs[number]) => <Badge tone={a.status === "Approved" ? "good" : a.status === "Rejected" ? "bad" : "warn"}>{a.status === "Pending approval" ? "In Approvals" : a.status}</Badge> },
			]} rows={adjs} />
		</>
	);
}

// ---------- 9. Physical count ----------
type CountRec = (typeof counts)[number];
function CountTab({ onDone }: { onDone: () => void }) {
	const { qty } = useStock();
	const [bm] = useBins();
	const [list, setList] = usePersist<CountRec[]>("counts", counts);
	const [, setAcc] = useAccuracy();
	const [, setRecon] = useRecon();
	const [loc, setLoc] = useState(CENTRAL);
	const [aisle, setAisle] = useState("B");
	const [vals, setVals] = useState<Record<string, string>>({});
	const lines = items.filter((i) => qty(i.code, loc) > 0 && (loc !== CENTRAL || binOf(i, bm).startsWith(aisle)));
	const readTags = () => {
		const v: Record<string, string> = {};
		lines.forEach((i, k) => { const s = qty(i.code, loc); v[i.code] = String(k === 1 && lines.length > 2 ? Math.max(0, s - 3) : s); });
		setVals(v); toast(`${lines.length} items read by handheld HH-03`);
	};
	const submit = () => {
		if (lines.some((i) => vals[i.code] === undefined || vals[i.code] === "")) { toast("Enter a count for every item, or use Read tags"); return; }
		const diffs = lines.map((i) => ({ i, sys: qty(i.code, loc), phys: Number(vals[i.code]) })).filter((d) => d.phys !== d.sys);
		const sysUnits = sum(lines.map((i) => qty(i.code, loc))) || 1;
		const acc = Math.round((1 - sum(diffs.map((d) => Math.abs(d.phys - d.sys))) / sysUnits) * 1000) / 10;
		const no = `PC-0${416 + list.length - 4}`;
		setList((l) => [{ no, area: loc === CENTRAL ? `Aisle ${aisle}` : loc, method: "RFID handheld", items: lines.length, counted: lines.length, variance: sum(diffs.map((d) => d.phys - d.sys)), status: diffs.length ? "Variance found" : "Completed", date: "Today" }, ...l]);
		setAcc((l) => [...l, { no, date: "Today", acc }]);
		if (diffs.length) setRecon((l) => [...diffs.map((d) => ({ item: d.i.name, code: d.i.code, loc, system: d.sys, physical: d.phys, diff: d.phys - d.sys, value: (d.phys - d.sys) * d.i.unitCost, reason: "To be checked", status: "Investigating" })), ...l]);
		setVals({});
		toast(diffs.length ? `${no}: ${diffs.length} difference${diffs.length > 1 ? "s" : ""} sent to Reconciliation · accuracy ${acc}%` : `${no}: all ${lines.length} items matched · accuracy 100%`);
		if (diffs.length) onDone();
	};
	return (
		<div className="split">
			<div>
				<div className="row-btns spread" style={{ marginTop: 0 }}>
					<div className="filters">
						<select aria-label="Location" value={loc} onChange={(e) => { setLoc(e.target.value); setVals({}); }}>{LOCS.map((l) => <option key={l}>{l}</option>)}</select>
						{loc === CENTRAL && <select aria-label="Aisle" value={aisle} onChange={(e) => { setAisle(e.target.value); setVals({}); }}>{aisles.map((a) => <option key={a} value={a}>Aisle {a}</option>)}</select>}
					</div>
					<button className="btn ghost sm" onClick={readTags}>Read tags (RFID)</button>
				</div>
				<p className="hint">Count sheet with {lines.length} items. Counters do not see system stock until the count is submitted.</p>
				<Table dense cols={[
					{ key: "n", label: "Item", render: (i: Item) => i.name }, { key: "b", label: "Bin", hideSm: true, render: (i: Item) => (loc === CENTRAL ? binOf(i, bm) : "—") },
					{ key: "c", label: "Counted", num: true, render: (i: Item) => <input className="qty-in" type="number" min="0" aria-label={`Count of ${i.name}`} value={vals[i.code] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [i.code]: e.target.value }))} /> },
				]} rows={lines} />
				{lines.length > 0 ? <div className="row-btns"><button className="btn" onClick={submit}>Submit count</button></div> : <p className="empty">No stock in this area.</p>}
			</div>
			<div>
				<h3 className="mini">Counts</h3>
				<Table dense cols={[
					{ key: "no", label: "Count" }, { key: "area", label: "Area" }, { key: "date", label: "Date", hideSm: true },
					{ key: "variance", label: "Variance", num: true, render: (r: CountRec) => <span className={r.variance ? "neg" : ""}>{r.variance > 0 ? "+" : ""}{r.variance}</span> },
					{ key: "status", label: "Status", render: (r: CountRec) => <Badge>{r.status}</Badge> },
				]} rows={list} />
			</div>
		</div>
	);
}

// ---------- 10. Reconciliation ----------
function ReconTab() {
	const [rows, setRows] = useRecon();
	const [adjs] = useAdjustments();
	const request = useRequestAdjustment();
	const [why, setWhy] = useState<Record<number, string>>({});
	const linked = (r: typeof rows[number]) => r.adj ?? adjs.find((a) => a.status === "Pending approval" && (a.code === r.code || itemByCode(a.code).name === r.item) && a.qty === r.diff)?.no;
	const postAdj = (r: typeof rows[number], k: number) => {
		const code = r.code ?? items.find((i) => i.name === r.item)!.code;
		const reason = why[k] ?? (r.reason !== "To be checked" ? r.reason : "Found in count");
		const no = request({ code, loc: r.loc ?? CENTRAL, qty: r.diff, reason });
		setRows((l) => l.map((x, j) => (j === k ? { ...x, status: "Sent for approval", adj: no, reason } : x)));
		toast(`${no} sent for approval to correct ${r.item}`);
	};
	return (
		<>
			<p className="hint">Differences from physical counts. Pick the reason and post an adjustment; stock changes when the adjustment is approved.</p>
			<Table cols={[
				{ key: "item", label: "Item" }, { key: "loc", label: "Location", hideSm: true, render: (r: typeof rows[number]) => r.loc ?? CENTRAL },
				{ key: "system", label: "System", num: true, hideSm: true, render: (r: typeof rows[number]) => n(r.system) }, { key: "physical", label: "Counted", num: true, hideSm: true, render: (r: typeof rows[number]) => n(r.physical) },
				{ key: "diff", label: "Difference", num: true, render: (r: typeof rows[number]) => <span className={r.diff < 0 ? "neg" : r.diff > 0 ? "pos" : ""}>{r.diff > 0 ? "+" : ""}{r.diff}</span> },
				{ key: "value", label: "Value", num: true, render: (r: typeof rows[number]) => inr(r.value) },
				{ key: "reason", label: "Reason", render: (r: typeof rows[number]) => { const k = rows.indexOf(r); return (r.status === "Investigating" || r.status === "Write-off pending") && !linked(r) ? <select aria-label="Reason" value={why[k] ?? (r.reason === "To be checked" ? "Found in count" : r.reason)} onChange={(e) => setWhy((w) => ({ ...w, [k]: e.target.value }))}>{[...new Set([r.reason !== "To be checked" ? r.reason : "", "Found in count", "Issued without scan", "Damaged in storage", "Receipt not booked", "Counting error"].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}</select> : r.reason; } },
				{ key: "status", label: "Status", render: (r: typeof rows[number]) => { const l = linked(r); return l && r.status !== "Adjusted" ? <Badge tone="info">{`${l} in Approvals`}</Badge> : <Badge>{r.status}</Badge>; } },
				{ key: "a", label: "", render: (r: typeof rows[number]) => ((r.status === "Investigating" || r.status === "Write-off pending") && !linked(r) && r.diff !== 0 ? <button className="btn sm ghost" onClick={() => postAdj(r, rows.indexOf(r))}>Post adjustment</button> : null) },
			]} rows={rows} />
		</>
	);
}

// ---------- 11. Reports: valuation, ageing, accuracy ----------
function ReportsTab() {
	const { qty } = useStock();
	const [acc] = useAccuracy();
	const [lv] = useLevels();
	const request = useRequestAdjustment();
	const cats = Array.from(new Set(items.map((i) => i.category)));
	const byCat = cats.map((c) => { const its = items.filter((i) => i.category === c); return { c, units: sum(its.map((i) => qty(i.code))), value: sum(its.map((i) => qty(i.code) * i.unitCost)) }; }).sort((a, b) => b.value - a.value);
	const total = sum(byCat.map((x) => x.value));
	const bands = [["0–30 days", 0, 30], ["31–90 days", 31, 90], ["91–180 days", 91, 180], ["Over 180 days", 181, 9999]] as const;
	const old = items.filter((i) => i.ageDays > 120 || qty(i.code) > levelsOf(i, lv).max);
	return (
		<>
			<div className="row-btns spread">
				<p className="hint" style={{ margin: 0 }}>Valued at weighted average cost, all locations. Total {inr(total)} · carrying cost at 18% a year ≈ {inr(Math.round((total * 0.18) / 12))} a month.</p>
				<span className="rw-btns"><button className="btn ghost sm" onClick={() => toast("Inventory reports exported to Excel")}>Excel</button><button className="btn ghost sm" onClick={() => toast("Inventory reports exported to PDF")}>PDF</button></span>
			</div>
			<div className="split">
				<div>
					<h3 className="mini">Valuation by category</h3>
					<Table dense cols={[
						{ key: "c", label: "Category" }, { key: "units", label: "Units", num: true, render: (r: typeof byCat[number]) => n(r.units) },
						{ key: "value", label: "Value", num: true, render: (r: typeof byCat[number]) => lakh(r.value) },
						{ key: "s", label: "Share", num: true, render: (r: typeof byCat[number]) => `${((r.value / total) * 100).toFixed(1)}%` },
					]} rows={byCat} />
					<h3 className="mini" style={{ marginTop: 18 }}>Valuation by location</h3>
					<HBars rows={LOCS.map((l) => ({ label: l, value: sum(items.map((i) => qty(i.code, l) * i.unitCost)) }))} fmt={lakh} tone="info" />
				</div>
				<div>
					<h3 className="mini">Stock accuracy by count</h3>
					<Chart labels={acc.map((a) => a.no)} fmt={(v) => `${v}%`} height={180} series={[{ name: "Accuracy %", values: acc.map((a) => a.acc), tone: "accent", kind: "line" }]} />
					<h3 className="mini" style={{ marginTop: 18 }}>Ageing (value)</h3>
					<HBars rows={bands.map(([b, a, z]) => ({ label: b, value: sum(items.filter((i) => i.ageDays >= a && i.ageDays <= z).map((i) => qty(i.code) * i.unitCost)) }))} fmt={lakh} tone="warn" />
				</div>
			</div>
			<h3 className="mini" style={{ marginTop: 22 }}>Slow, non-moving and excess stock — what to do</h3>
			<Table dense cols={[
				{ key: "n", label: "Item", render: (i: Item) => i.name }, { key: "a", label: "Oldest", num: true, render: (i: Item) => `${i.ageDays} d` },
				{ key: "q", label: "Qty", num: true, render: (i: Item) => n(qty(i.code)) }, { key: "v", label: "Value", num: true, render: (i: Item) => inr(qty(i.code) * i.unitCost) },
				{ key: "max", label: "Max", num: true, hideSm: true, render: (i: Item) => n(levelsOf(i, lv).max) },
				{ key: "t", label: "Type", render: (i: Item) => <Badge tone="warn">{qty(i.code) > levelsOf(i, lv).max ? "Excess" : i.ageDays > 180 ? "Non-moving" : "Slow-moving"}</Badge> },
				{ key: "x", label: "", render: (i: Item) => (
					<span className="rw-btns">
						<button className="btn sm ghost" onClick={() => { const no = request({ code: i.code, loc: CENTRAL, qty: -Math.max(1, Math.round(qty(i.code, CENTRAL) * 0.3)), reason: "Return to vendor" }); toast(`${no}: return of 30% of ${i.name} to vendor sent for approval`); }}>Return to vendor</button>
						<button className="btn sm ghost" onClick={() => { const no = request({ code: i.code, loc: CENTRAL, qty: -Math.max(1, Math.round(qty(i.code, CENTRAL) * 0.1)), reason: "Scrap" }); toast(`${no}: scrap of 10% of ${i.name} sent for approval`); }}>Scrap</button>
					</span>
				) },
			]} rows={old} />
		</>
	);
}
