import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { productionWeek, stations, workOrders, items, models, sum } from "./data";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, HBars, Bar, Tabs, Drawer, Facts, Timeline, toast } from "./ui";
import { Mrp, FinishedGoods } from "./pagesExtra";
import { usePersist } from "./store";
import { useStock, CENTRAL, LINE } from "./stock";

// ---------- shared data ----------
export type WO = { no: string; model: string; qty: number; done: number; line: string; due: string; status: string };
const lines = ["Line 1", "Line 2"] as const;
const capacity: Record<string, number> = { "Line 1": 120, "Line 2": 140 };
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Parts each vehicle needs, with quantity per vehicle. */
export const kit: [string, number][] = [
	["Hub motor 2.5 kW", 1], ["Motor controller 48V", 1], ["Main frame — S1", 1], ["Front fork assembly", 1], ["Rear shock absorber", 1],
	["Wiring harness main", 1], ["TFT cluster 5in", 1], ["Alloy wheel 12in", 2], ["Tyre 90/90-12 tubeless", 2], ["Disc brake kit 220mm", 1], ["Seat assembly", 1], ["Headlamp LED unit", 1],
];
const itemByName = (n: string) => items.find((i) => i.name === n);

const baseIssued = (wo: string, part: string) => (wo === "WO-7731" ? 100 : wo === "WO-7733" ? 30 : 0) * (kit.find((k) => k[0] === part)?.[1] ?? 1);
/** Parts issued during this demo, so store stock can go down and line-side stock up. */
const demoIssued = (issued: Record<string, Record<string, number>>, part: string, woFilter?: (wo: string) => boolean) =>
	Object.entries(issued).filter(([wo]) => !woFilter || woFilter(wo)).reduce((a, [wo, m]) => a + Math.max(0, (m[part] ?? 0) - baseIssued(wo, part)), 0);
export function useWOs() { return usePersist<WO[]>("workorders", workOrders); }
export function useIssued() { return usePersist<Record<string, Record<string, number>>>("issued", { "WO-7731": Object.fromEntries(kit.map(([p, q]) => [p, 100 * q])), "WO-7733": Object.fromEntries(kit.map(([p, q]) => [p, 30 * q])) }); }

// ---------- Production page ----------
const tabs = ["Production plan", "Work orders", "MRP", "Material issue", "Line-side stock", "Bill of materials", "Quality & rework", "Finished goods"] as const;
type Tab = (typeof tabs)[number];

export function Production() {
	const [tab, setTab] = useState<Tab>("Production plan");
	const [woFormOpen, setWoFormOpen] = useState(false);
	const plan = sum(productionWeek.map((d) => d.plan));
	const act = sum(productionWeek.map((d) => d.actual));
	return (
		<Page title="Manufacturing" sub="Hosur plant · 2 assembly lines · 6 stations each"
			actions={<button className="btn" onClick={() => setWoFormOpen(true)}>New work order</button>}>
			<Stats>
				<Stat label="Built this week" value={act.toLocaleString("en-IN")} delta={`Plan ${plan.toLocaleString("en-IN")}`} tone="warn" />
				<Stat label="Work in progress" value={String(sum(stations.map((s) => s.wip)))} delta="Across both lines" />
				<Stat label="First-pass yield" value="96.8%" delta="+0.6 pts vs last week" tone="good" />
				<Stat label="Downtime today" value="22 min" delta="End-of-line test rig" tone="bad" />
			</Stats>
			<div className="grid-2">
				<Panel title="Plan vs actual" note="Vehicles per day, this week">
					<Chart labels={productionWeek.map((d) => d.day)} series={[
						{ name: "Plan", values: productionWeek.map((d) => d.plan), tone: "muted", kind: "ghost" },
						{ name: "Actual", values: productionWeek.map((d) => d.actual), tone: "accent" },
					]} />
				</Panel>
				<Panel title="Assembly stations — Line 1" note="Cycle time in minutes, target 4.3">
					<ul className="stations">
						{stations.map((s, i) => (
							<li key={s.name}>
								<span className="st-no">{i + 1}</span>
								<span className="st-name">{s.name}<small>{s.wip} in progress</small></span>
								<span className={`st-cycle ${s.cycle > s.target ? "neg" : ""}`}>{s.cycle.toFixed(1)}</span>
								<Badge>{s.status}</Badge>
							</li>
						))}
					</ul>
				</Panel>
			</div>
			<Panel right={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
				{tab === "Production plan" && <ProductionPlan onMade={() => setTab("Work orders")} />}
				{tab === "Work orders" && <WorkOrders />}
				{tab === "MRP" && <Mrp />}
				{tab === "Material issue" && <MaterialIssue />}
				{tab === "Line-side stock" && <LineSide />}
				{tab === "Bill of materials" && <Bom />}
				{tab === "Quality & rework" && <QualityRework />}
				{tab === "Finished goods" && <FinishedGoods />}
			</Panel>
			<WorkOrderForm open={woFormOpen} onClose={() => setWoFormOpen(false)} onDone={() => setTab("Work orders")} />
		</Page>
	);
}

// ---------- 1. Production plan ----------
type PlanRow = { line: string; model: string; qty: number[] };
const planSeed: PlanRow[] = [
	{ line: "Line 1", model: "E-Ride S1 Pro", qty: [60, 60, 70, 70, 60, 40] },
	{ line: "Line 1", model: "Cargo C2", qty: [40, 40, 40, 40, 50, 30] },
	{ line: "Line 2", model: "E-Ride S1", qty: [80, 80, 80, 90, 80, 60] },
	{ line: "Line 2", model: "E-Ride Lite", qty: [50, 50, 60, 50, 50, 40] },
];
function ProductionPlan({ onMade }: { onMade: () => void }) {
	const [rows, setRows] = usePersist<PlanRow[]>("plan", planSeed);
	const [published, setPublished] = usePersist<boolean>("planPublished", false);
	const [, setWOs] = useWOs();
	const lineTotal = (line: string, d: number) => rows.filter((r) => r.line === line).reduce((a, r) => a + (r.qty[d] || 0), 0);
	const over = lines.flatMap((l) => days.map((_, d) => (lineTotal(l, d) > capacity[l] ? `${l} on ${days[d]}` : ""))).filter(Boolean);
	const setQty = (ri: number, d: number, v: string) => { setPublished(false); setRows((rs) => rs.map((r, i) => (i === ri ? { ...r, qty: r.qty.map((q, j) => (j === d ? Math.max(0, Number(v) || 0) : q)) } : r))); };
	const publish = () => {
		if (over.length) { toast(`Over capacity: ${over.join(", ")}. Reduce quantities first.`); return; }
		const made: WO[] = rows.map((r, i) => ({ no: `WO-77${40 + i}`, model: r.model, qty: sum(r.qty), done: 0, line: r.line, due: "Sat 17 Oct", status: "Planned" }));
		setWOs((w) => [...made, ...w.filter((x) => !made.some((m) => m.no === x.no))]);
		setPublished(true);
		toast(`Plan published — ${made.length} production orders created for next week`);
		onMade();
	};
	return (
		<>
			<div className="row-btns spread">
				<p className="hint">Next week, 12–17 October. Change any number; each line's daily total is checked against its capacity.</p>
				<button className="btn" onClick={publish}>{published ? "Published — publish again" : "Publish plan"}</button>
			</div>
			<div className="table-wrap">
				<table className="plan">
					<thead><tr><th>Line</th><th>Model</th>{days.map((d) => <th key={d} className="num">{d}</th>)}<th className="num">Week</th></tr></thead>
					<tbody>
						{rows.map((r, ri) => (
							<tr key={ri}>
								<td>{r.line}</td><td>{r.model}</td>
								{r.qty.map((q, d) => <td key={d} className="num"><input aria-label={`${r.model} ${days[d]}`} id={`pl-${ri}-${d}`} type="number" min="0" value={q} onChange={(e) => setQty(ri, d, e.target.value)} /></td>)}
								<td className="num strong">{sum(r.qty)}</td>
							</tr>
						))}
						{lines.map((l) => (
							<tr key={l} className="tot">
								<td colSpan={2}>{l} total <small className="sub">capacity {capacity[l]}/day</small></td>
								{days.map((_, d) => { const t = lineTotal(l, d); return <td key={d} className={`num ${t > capacity[l] ? "neg" : ""}`}>{t}{t > capacity[l] && <small> over</small>}</td>; })}
								<td className="num">{sum(days.map((_, d) => lineTotal(l, d)))}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{over.length > 0 && <p className="form-err">Over capacity on {over.join(", ")}. Move some vehicles to another day or line.</p>}
		</>
	);
}

// ---------- 2. Work orders ----------
function WorkOrders() {
	const [wos, setWOs] = useWOs();
	const [issued] = useIssued();
	const [sel, setSel] = useState<string | null>(null);
	const wo = wos.find((w) => w.no === sel) ?? null;
	const release = (w: WO) => { setWOs((l) => l.map((x) => (x.no === w.no ? { ...x, status: "Released" } : x))); toast(`${w.no} released to ${w.line} — parts reserved`); };
	return (
		<>
			<Table cols={[
				{ key: "no", label: "Work order" }, { key: "model", label: "Model" }, { key: "line", label: "Line", hideSm: true },
				{ key: "prog", label: "Progress", render: (r: WO) => <span className="inline-bar"><Bar pct={(r.done / r.qty) * 100} />{r.done}/{r.qty}</span> },
				{ key: "due", label: "Due", hideSm: true }, { key: "status", label: "Status", render: (r: WO) => <Badge>{r.status}</Badge> },
				{ key: "a", label: "", render: (r: WO) => (r.status === "Planned" ? <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); release(r); }}>Release</button> : null) },
			]} rows={wos} onRow={(r) => setSel(r.no)} />
			<Drawer open={!!wo} onClose={() => setSel(null)} title={wo?.no ?? ""} sub={wo ? `${wo.model} · ${wo.qty} vehicles · ${wo.line}` : ""}>
				{wo && <WoDetail wo={wo} issued={issued[wo.no] ?? {}} onRelease={() => release(wo)} />}
			</Drawer>
		</>
	);
}
function WoDetail({ wo, issued, onRelease }: { wo: WO; issued: Record<string, number>; onRelease: () => void }) {
	const stageDone = stations.map((_, i) => Math.max(0, Math.min(wo.qty, wo.done + (stations.length - 1 - i) * 4 + (wo.status === "Planned" || wo.status === "Released" ? -999 : 0))));
	return (
		<>
			<Facts rows={[["Status", <Badge>{wo.status}</Badge>], ["Built", `${wo.done} of ${wo.qty}`], ["Line", wo.line], ["Due", wo.due], ["BOM", `${wo.model} · rev C`]]} />
			{wo.status === "Planned" && <button className="btn" onClick={onRelease}>Release to {wo.line}</button>}
			<h3 className="mini">Parts for this order</h3>
			<Table dense cols={[
				{ key: "p", label: "Part" }, { key: "need", label: "Needed", num: true },
				{ key: "iss", label: "Issued", num: true },
				{ key: "st", label: "", render: (r: { need: number; iss: number }) => (r.iss >= r.need ? <Badge tone="good">Done</Badge> : r.iss > 0 ? <Badge tone="warn">Part</Badge> : <Badge tone="muted">Not yet</Badge>) },
			]} rows={kit.map(([p, q]) => ({ p, need: q * wo.qty, iss: Math.min(q * wo.qty, issued[p] ?? 0) }))} />
			<h3 className="mini">Stations</h3>
			<ul className="wo-stages">
				{stations.map((s, i) => (
					<li key={s.name}><span>{i + 1}. {s.name}</span><Bar pct={(stageDone[i] / wo.qty) * 100} /><small>{stageDone[i]}/{wo.qty}</small></li>
				))}
			</ul>
			<h3 className="mini">History</h3>
			<Timeline items={[
				...(wo.done > 0 ? [{ when: "08 Oct 11:30", what: `${wo.done} vehicles passed end-of-line test` }] : []),
				...(wo.status !== "Planned" ? [{ when: "07 Oct 08:02", what: "Released and parts reserved", where: wo.line }] : []),
				{ when: "06 Oct", what: "Created from the weekly production plan" },
			]} />
		</>
	);
}
function WorkOrderForm({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
	const [wos, setWOs] = useWOs();
	const [model, setModel] = useState<string>(models[0]);
	const [qty, setQty] = useState("100");
	const [line, setLine] = useState<string>("Line 2");
	const [due, setDue] = useState("2026-10-14");
	const [release, setRelease] = useState(true);
	const [err, setErr] = useState<string | null>(null);
	const short = useMemo(() => kit.filter(([p, q]) => (itemByName(p)?.onHand ?? 0) < q * Number(qty || 0)).map(([p]) => p), [qty]);
	const submit = (e: FormEvent) => {
		e.preventDefault();
		const n = Number(qty);
		if (!(n > 0)) { setErr("Enter how many vehicles to build."); return; }
		if (n > capacity[line] * 6) { setErr(`${line} can build at most ${capacity[line] * 6} vehicles a week.`); return; }
		const no = `WO-77${50 + wos.length}`;
		const d = new Date(due);
		setWOs((l) => [{ no, model, qty: n, done: 0, line, due: isNaN(d.getTime()) ? due : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), status: release ? "Released" : "Planned" }, ...l]);
		setErr(null); onClose(); onDone();
		toast(`${no} created for ${n} × ${model}${release ? ` and released to ${line}` : ""}`);
	};
	return (
		<Drawer open={open} onClose={onClose} title="New work order" sub="Build a batch of vehicles on one line">
			<form className="rec-form" onSubmit={submit} noValidate>
				<label htmlFor="wo-model"><span>Model</span><select id="wo-model" value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m}>{m}</option>)}</select></label>
				<div className="form-row">
					<label htmlFor="wo-qty"><span>Vehicles</span><input id="wo-qty" className="search" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
					<label htmlFor="wo-line"><span>Line</span><select id="wo-line" value={line} onChange={(e) => setLine(e.target.value)}>{lines.map((l) => <option key={l}>{l}</option>)}</select></label>
				</div>
				<label htmlFor="wo-due"><span>Due date</span><input id="wo-due" className="search" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
				<label className="check" htmlFor="wo-rel"><input id="wo-rel" type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} /> Release now and reserve parts</label>
				<div className={`alloc-preview ${short.length ? "warn" : ""}`}>
					{short.length ? <p className="hint">Not enough stock for: {short.join(", ")}. MRP will suggest requisitions.</p> : <p className="hint">All {kit.length} parts are in stock for this quantity.</p>}
				</div>
				{err && <p className="form-err" role="alert">{err}</p>}
				<div className="row-btns"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn">Create work order</button></div>
			</form>
		</Drawer>
	);
}

// ---------- 3. Material issue ----------
function MaterialIssue() {
	const [wos] = useWOs();
	const [issued, setIssued] = useIssued();
	const open = wos.filter((w) => w.status !== "Completed" && w.status !== "Planned");
	const [woNo, setWoNo] = useState(open[0]?.no ?? "");
	const wo = wos.find((w) => w.no === woNo);
	const [qtys, setQtys] = useState<Record<string, string>>({});
	const { qty, post: postStock } = useStock();
	if (!wo) return <p className="empty">No released work orders. Release one from the Work orders tab to issue parts.</p>;
	const got = issued[wo.no] ?? {};
	const rows = kit.map(([p, q]) => {
		const need = q * wo.qty, has = got[p] ?? 0, stock = Math.max(0, qty(itemByName(p)!.code, CENTRAL));
		const remaining = Math.max(0, need - has);
		const next = Math.min(remaining, q * 20);
		return { p, need, has, stock, remaining, next };
	});
	const post = () => {
		const add: Record<string, number> = {};
		rows.forEach((r) => { const v = Math.max(0, Math.min(r.remaining, Number(qtys[r.p] ?? r.next) || 0)); if (v) add[r.p] = v; });
		const total = Object.values(add).reduce((a, b) => a + b, 0);
		if (!total) { toast("Nothing to issue. Every part for this order is already on the line."); return; }
		const shortOf = rows.filter((r) => (add[r.p] ?? 0) > r.stock);
		if (shortOf.length) { toast(`Not enough in Central WH for ${shortOf.map((r) => r.p).join(", ")} — lower the quantity or wait for receipts`); return; }
		const mi = `MI-${2200 + Math.floor(Math.random() * 99)}`;
		postStock(Object.entries(add).flatMap(([p, v]) => { const code = itemByName(p)!.code; return [
			{ type: "Issue to line" as const, code, loc: CENTRAL, qty: -v, ref: mi, by: "Stores — Hosur", note: `For ${wo.no}` },
			{ type: "Line receipt" as const, code, loc: LINE, qty: v, ref: mi, by: wo.line, note: `For ${wo.no}` },
		]; }));
		setIssued((m) => ({ ...m, [wo.no]: Object.fromEntries(kit.map(([p]) => [p, (m[wo.no]?.[p] ?? 0) + (add[p] ?? 0)])) }));
		setQtys({});
		toast(`Issue note ${mi} posted — ${total} parts moved from Central WH to ${wo.line} line-side`);
	};
	return (
		<>
			<div className="row-btns spread">
				<label className="inline-label" htmlFor="mi-wo"><span>Work order</span>
					<select id="mi-wo" value={wo.no} onChange={(e) => { setWoNo(e.target.value); setQtys({}); }}>{open.map((w) => <option key={w.no} value={w.no}>{w.no} · {w.model} × {w.qty} · {w.line}</option>)}</select>
				</label>
				<button className="btn" onClick={post}>Issue to line</button>
			</div>
			<p className="hint">Next issue suggests 20 vehicles' worth of each part. Change any quantity; stock moves from Central WH to the line-side store.</p>
			<Table dense cols={[
				{ key: "p", label: "Part" },
				{ key: "need", label: "Needed", num: true, hideSm: true },
				{ key: "has", label: "Issued", num: true, render: (r) => <span className="inline-bar"><Bar pct={(r.has / r.need) * 100} />{r.has}</span> },
				{ key: "stock", label: "In store", num: true, hideSm: true, render: (r) => <span className={r.stock < r.next ? "neg" : ""}>{r.stock.toLocaleString("en-IN")}</span> },
				{ key: "q", label: "Issue now", num: true, render: (r) => r.remaining ? <input className="qty-in" type="number" min="0" max={r.remaining} aria-label={`Issue ${r.p}`} value={qtys[r.p] ?? String(r.next)} onChange={(e) => setQtys((x) => ({ ...x, [r.p]: e.target.value }))} /> : <Badge tone="good">Done</Badge> },
			]} rows={rows} />
		</>
	);
}

// ---------- 4. Line-side stock ----------
const lsBase: Record<string, [number, number]> = { // [qty on line, used per hour] for Line 1
	"Hub motor 2.5 kW": [44, 16], "Motor controller 48V": [12, 16], "Main frame — S1": [38, 16], "Front fork assembly": [30, 16], "Rear shock absorber": [52, 16],
	"Wiring harness main": [26, 16], "TFT cluster 5in": [9, 16], "Alloy wheel 12in": [70, 32], "Tyre 90/90-12 tubeless": [64, 32], "Disc brake kit 220mm": [41, 16], "Seat assembly": [35, 16], "Headlamp LED unit": [58, 16],
};
function LineSide() {
	const [line, setLine] = useState<string>("Line 1");
	const [issued] = useIssued();
	const [wos] = useWOs();
	const [reqs, setReqs] = usePersist<{ no: string; part: string; qty: number; line: string; status: string }[]>("refills", []);
	const extra = (p: string) => demoIssued(issued, p, (no) => wos.some((w) => w.no === no && w.line === line));
	const rows = kit.map(([p]) => {
		const [q0, rate0] = lsBase[p];
		const qty = Math.round(q0 * (line === "Line 2" ? 1.2 : 1)) + extra(p);
		const rate = Math.round(rate0 * (line === "Line 2" ? 1.15 : 1));
		const hours = qty / rate;
		const pending = reqs.some((r) => r.part === p && r.line === line && r.status === "Requested");
		return { p, qty, rate, hours, pending, min: rate * 2 };
	});
	const request = (p: string, qty: number) => {
		const no = `MR-${3100 + reqs.length}`;
		setReqs((l) => [{ no, part: p, qty, line, status: "Requested" }, ...l]);
		toast(`${no}: ${qty} × ${p} requested from stores for ${line}`);
	};
	const low = rows.filter((r) => r.hours < 2 && !r.pending);
	return (
		<>
			<div className="row-btns spread">
				<Tabs tabs={lines} value={line as (typeof lines)[number]} onChange={setLine} />
				<button className="btn ghost" disabled={!low.length} onClick={() => low.forEach((r) => request(r.p, r.rate * 4))}>Refill all low parts ({low.length})</button>
			</div>
			<p className="hint">Stock sitting at the line, how fast it is used, and how long it lasts. Below 2 hours is low.</p>
			<Table dense cols={[
				{ key: "p", label: "Part" },
				{ key: "qty", label: "On line", num: true },
				{ key: "rate", label: "Used / hour", num: true, hideSm: true },
				{ key: "h", label: "Lasts", render: (r) => <span className="inline-bar"><Bar pct={Math.min(100, (r.hours / 6) * 100)} tone={r.hours < 2 ? "bad" : r.hours < 3 ? "warn" : "accent"} />{r.hours.toFixed(1)} h</span> },
				{ key: "s", label: "", render: (r) => r.pending ? <Badge tone="info">Refill requested</Badge> : r.hours < 2 ? <button className="btn sm" onClick={() => request(r.p, r.rate * 4)}>Request refill</button> : <span className="sub">OK</span> },
			]} rows={rows} />
			{reqs.length > 0 && (
				<>
					<h3 className="mini" style={{ marginTop: 18 }}>Refill requests</h3>
					<Table dense cols={[{ key: "no", label: "Request" }, { key: "part", label: "Part" }, { key: "qty", label: "Qty", num: true }, { key: "line", label: "Line" },
						{ key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
						{ key: "a", label: "", render: (r) => r.status === "Requested" ? <button className="btn sm ghost" onClick={() => setReqs((l) => l.map((x) => (x.no === r.no ? { ...x, status: "Delivered" } : x)))}>Mark delivered</button> : null }]} rows={reqs} />
				</>
			)}
		</>
	);
}

// ---------- 5. BOM by model and revision ----------
type BomLine = { level: number; part: string; qty: number; change?: string };
function bomFor(model: string, rev: string): BomLine[] {
	const cargo = model === "Cargo C2", lite = model === "E-Ride Lite";
	const b: BomLine[] = [
		{ level: 1, part: `${model} — complete vehicle`, qty: 1 },
		{ level: 2, part: cargo ? "Main frame — Cargo (reinforced)" : "Main frame — S1", qty: 1 },
		{ level: 2, part: "Drivetrain assembly", qty: 1 },
		{ level: 3, part: cargo ? "Hub motor 3.0 kW" : lite ? "Hub motor 1.8 kW" : "Hub motor 2.5 kW", qty: 1 },
		{ level: 3, part: "Motor controller 48V", qty: 1 },
		{ level: 2, part: "Electrical assembly", qty: 1 },
		{ level: 3, part: "Wiring harness main", qty: 1 },
		{ level: 3, part: rev === "Rev C" ? "TFT cluster 5in" : "LCD cluster 4in", qty: 1, change: rev === "Rev C" ? "Changed in Rev C (was LCD cluster 4in)" : undefined },
		{ level: 3, part: "IoT telematics unit", qty: 1, change: rev === "Rev C" ? "Added in Rev C" : undefined },
		{ level: 2, part: "Wheel set", qty: 1 },
		{ level: 3, part: "Alloy wheel 12in", qty: 2 },
		{ level: 3, part: "Tyre 90/90-12 tubeless", qty: 2 },
		{ level: 3, part: "Disc brake kit 220mm", qty: cargo ? 2 : 1 },
		{ level: 2, part: "Body panel set", qty: 1 },
		...(cargo ? [{ level: 2, part: "Rear cargo carrier", qty: 1 }] : []),
		{ level: 2, part: lite ? "Battery pack 48V 30Ah (allocated)" : "Battery pack 48V 50Ah (allocated)", qty: 1 },
	];
	return rev === "Rev C" ? b : b.filter((l) => l.part !== "IoT telematics unit");
}
function Bom() {
	const [model, setModel] = useState<string>("E-Ride S1 Pro");
	const [rev, setRev] = useState("Rev C");
	const rows = bomFor(model, rev);
	return (
		<>
			<div className="filters" style={{ marginBottom: 12 }}>
				<label className="inline-label" htmlFor="bom-m"><span>Model</span><select id="bom-m" value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m}>{m}</option>)}</select></label>
				<label className="inline-label" htmlFor="bom-r"><span>Revision</span><select id="bom-r" value={rev} onChange={(e) => setRev(e.target.value)}><option>Rev C</option><option>Rev B</option></select></label>
				<span className="hint" style={{ margin: 0 }}>{rev === "Rev C" ? "Current · effective from 01 Aug 2026" : "Old · used until 31 Jul 2026"}</span>
			</div>
			<Table dense cols={[
				{ key: "part", label: `${model} · BOM ${rev}`, render: (r: BomLine) => <span style={{ paddingLeft: (r.level - 1) * 20 }} className={r.level === 1 ? "strong" : r.level === 3 ? "sub" : ""}>{r.part}</span> },
				{ key: "change", label: "Change", hideSm: true, render: (r: BomLine) => (r.change ? <Badge tone="info">{r.change}</Badge> : null) },
				{ key: "qty", label: "Qty", num: true },
			]} rows={rows} />
		</>
	);
}

// ---------- 6. Quality and rework ----------
type Test = { vin: string; model: string; time: string; result: "Pass" | "Rework"; defect?: string };
type Rework = { vin: string; defect: string; station: string; status: "Open" | "In rework" | "Closed" | "Rejected"; opened: string };
const checks = ["Brakes", "Lights and horn", "Motor and throttle", "Battery communication", "Range simulation", "Body finish"] as const;
const defects: Record<string, [string, string]> = {
	Brakes: ["Brake bleed incomplete", "Frame & fork"], "Lights and horn": ["Harness connector loose", "Electricals & harness"], "Motor and throttle": ["Throttle calibration out", "Motor & drivetrain"],
	"Battery communication": ["Cluster pairing failed", "Battery fit & pairing"], "Range simulation": ["Range below spec", "Battery fit & pairing"], "Body finish": ["Panel gap out of spec", "Body panels"],
};
function QualityRework() {
	const [tests, setTests] = usePersist<Test[]>("eolTests", [
		{ vin: "MD9ZS1P26A052221", model: "E-Ride S1 Pro", time: "11:58", result: "Pass" },
		{ vin: "MD9ZS1P26A052220", model: "E-Ride S1 Pro", time: "11:54", result: "Rework", defect: "Harness connector loose" },
		{ vin: "MD9ZS1P26A052219", model: "E-Ride S1 Pro", time: "11:50", result: "Pass" },
		{ vin: "MD9ZS1P26A052218", model: "Cargo C2", time: "11:45", result: "Pass" },
	]);
	const [rework, setRework] = usePersist<Rework[]>("rework", [
		{ vin: "MD9ZS1P26A052220", defect: "Harness connector loose", station: "Electricals & harness", status: "Open", opened: "11:54" },
		{ vin: "MD9ZS1P26A052207", defect: "Panel gap out of spec", station: "Body panels", status: "In rework", opened: "10:12" },
		{ vin: "MD9ZS1P26A052199", defect: "Brake bleed incomplete", station: "Frame & fork", status: "Closed", opened: "09:30" },
	]);
	const [form, setForm] = useState(false);
	const [res, setRes] = useState<Record<string, "Pass" | "Fail">>({});
	const nextVin = `MD9ZS1P26A0522${22 + tests.length - 4}`;
	const save = () => {
		if (checks.some((c) => !res[c])) { toast("Mark every check as pass or fail"); return; }
		const failed = checks.filter((c) => res[c] === "Fail");
		const t: Test = { vin: nextVin, model: "E-Ride S1 Pro", time: "Now", result: failed.length ? "Rework" : "Pass", defect: failed.length ? defects[failed[0]][0] : undefined };
		setTests((l) => [t, ...l]);
		if (failed.length) setRework((l) => [...failed.map((c) => ({ vin: nextVin, defect: defects[c][0], station: defects[c][1], status: "Open" as const, opened: "Now" })), ...l]);
		setRes({}); setForm(false);
		toast(failed.length ? `${nextVin} sent to rework: ${failed.join(", ")}` : `${nextVin} passed — moved to finished goods`);
	};
	const move = (r: Rework, status: Rework["status"]) => {
		setRework((l) => l.map((x) => (x === r || (x.vin === r.vin && x.defect === r.defect) ? { ...x, status } : x)));
		toast(status === "Closed" ? `${r.vin} passed retest — moved to finished goods` : status === "Rejected" ? `${r.vin} rejected — parts returned for scrap review` : `${r.vin} rework started at ${r.station}`);
	};
	const passed = tests.filter((t) => t.result === "Pass").length;
	const counts = Object.values(defects).map(([d]) => ({ label: d, value: rework.filter((r) => r.defect === d).length + ({ "Harness connector loose": 13, "Panel gap out of spec": 8, "Brake bleed incomplete": 5, "Cluster pairing failed": 5, "Throttle calibration out": 2, "Range below spec": 1 } as Record<string, number>)[d] }));
	return (
		<>
			<div className="split">
				<div>
					<div className="row-btns spread"><h3 className="mini" style={{ margin: 0 }}>End-of-line tests today</h3><button className="btn sm" onClick={() => setForm((f) => !f)}>{form ? "Cancel" : "Record test"}</button></div>
					{form && (
						<div className="pick-box">
							<b>Test {nextVin}</b>
							<ul className="checks">
								{checks.map((c) => (
									<li key={c}><span>{c}</span><span className="seg">
										<button className={res[c] === "Pass" ? "on good" : ""} onClick={() => setRes((x) => ({ ...x, [c]: "Pass" }))}>Pass</button>
										<button className={res[c] === "Fail" ? "on bad" : ""} onClick={() => setRes((x) => ({ ...x, [c]: "Fail" }))}>Fail</button>
									</span></li>
								))}
							</ul>
							<div className="row-btns"><button className="btn sm" onClick={save}>Save test result</button></div>
						</div>
					)}
					<Table dense cols={[
						{ key: "vin", label: "VIN", render: (r: Test) => `…${r.vin.slice(-6)}` }, { key: "model", label: "Model", hideSm: true }, { key: "time", label: "Time" },
						{ key: "result", label: "Result", render: (r: Test) => <Badge tone={r.result === "Pass" ? "good" : "warn"}>{r.result}</Badge> },
						{ key: "defect", label: "Defect", hideSm: true, render: (r: Test) => r.defect ?? "—" },
					]} rows={tests} />
				</div>
				<div>
					<Facts rows={[["Tested today", String(tests.length + 214)], ["Passed first time", String(passed + 207)], ["First-pass yield", `${(((passed + 207) / (tests.length + 214)) * 100).toFixed(1)}%`], ["In rework now", String(rework.filter((r) => r.status === "Open" || r.status === "In rework").length)], ["Rejected this week", String(4 + rework.filter((r) => r.status === "Rejected").length)]]} />
					<h3 className="mini" style={{ marginTop: 16 }}>Defects this week</h3>
					<HBars rows={counts.sort((a, b) => b.value - a.value)} tone="bad" />
				</div>
			</div>
			<h3 className="mini" style={{ marginTop: 22 }}>Rework and rejection</h3>
			<Table dense cols={[
				{ key: "vin", label: "VIN", render: (r: Rework) => `…${r.vin.slice(-6)}` }, { key: "defect", label: "Defect" }, { key: "station", label: "Fix at", hideSm: true },
				{ key: "opened", label: "Opened", hideSm: true },
				{ key: "status", label: "Status", render: (r: Rework) => <Badge tone={r.status === "Closed" ? "good" : r.status === "Rejected" ? "bad" : r.status === "In rework" ? "info" : "warn"}>{r.status}</Badge> },
				{ key: "a", label: "", render: (r: Rework) => r.status === "Open" ? <button className="btn sm ghost" onClick={() => move(r, "In rework")}>Start rework</button>
					: r.status === "In rework" ? <span className="rw-btns"><button className="btn sm" onClick={() => move(r, "Closed")}>Passed retest</button><button className="btn sm ghost" onClick={() => move(r, "Rejected")}>Reject</button></span> : null },
			]} rows={rework} />
		</>
	);
}
