import { useEffect, useMemo, useState } from "react";
import { useOpenParam } from "./store";
import { QuotationComparison, useExtraPOs } from "./rfq";
import {
	items, purchaseOrders, requisitions, vendors, productionWeek, stations,
	batteries, swapStations, swapDaily, jobCards, pnl, pnlMonths, flowStages, rfidEvents, rfidHardware,
	inr, lakh, crore, sum, warehouses,
} from "./data";
import type { Item, PO } from "./data";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, HBars, Bar, Cell, Tabs, Drawer, Facts, Timeline, Search, toast } from "./ui";
import { go } from "./nav";
import { GoodsReceipt, Transfers, PhysicalCount, Reconciliation } from "./pagesExtra";

// ================= Dashboard =================
export function Dashboard() {
	const plan = sum(productionWeek.map((d) => d.plan));
	const act = sum(productionWeek.map((d) => d.actual));
	const invValue = sum(items.map((i) => i.onHand * i.unitCost));
	const avgSoh = Math.round(sum(batteries.map((b) => b.soh)) / batteries.length);
	const swapsToday = sum(swapStations.map((s) => s.swapsToday));
	const rev = pnl.vehicleRevenue.map((v, i) => v + pnl.swapRevenue[i] + pnl.serviceRevenue[i] + pnl.sparesRevenue[i]);
	const gp = rev[5] - pnl.cogs[5];
	const [area, setArea] = useState<"Manufacturing" | "Inventory" | "Battery & swap" | "Service" | "Finance">("Manufacturing");

	return (
		<Page title="Good morning" sub="Thursday 8 October 2026 · Hosur plant, 6 cities, 8 swap stations">
			<FlowTrack />

			<Stats>
				<Stat label="Vehicles built this week" value={act.toLocaleString("en-IN")} delta={`${((act / plan) * 100).toFixed(1)}% of plan`} tone="warn" onClick={() => go("production")} />
				<Stat label="Swaps today" value={swapsToday.toLocaleString("en-IN")} delta="+6.2% vs last Thu" tone="good" onClick={() => go("swap")} />
				<Stat label="Inventory value" value={lakh(invValue)} delta="2 SKUs below minimum" tone="bad" onClick={() => go("inventory")} />
				<Stat label="Fleet battery health" value={`${avgSoh}%`} delta="120 packs at end of life" tone="warn" onClick={() => go("batteries")} />
				<Stat label="Open service jobs" value={String(jobCards.filter((j) => j.status !== "Closed").length + 46)} delta="Avg turnaround 7.1 h" onClick={() => go("service")} />
				<Stat label="Gross margin (Sep)" value={`${((gp / rev[5]) * 100).toFixed(1)}%`} delta={`${crore(gp)} gross profit`} tone="good" onClick={() => go("finance")} />
			</Stats>

			<Panel title="Business at a glance" right={<Tabs tabs={["Manufacturing", "Inventory", "Battery & swap", "Service", "Finance"] as const} value={area} onChange={setArea} />}>
				{area === "Manufacturing" && (
					<div className="split">
						<Chart labels={productionWeek.map((d) => d.day)} series={[
							{ name: "Plan", values: productionWeek.map((d) => d.plan), tone: "muted", kind: "ghost" },
							{ name: "Actual", values: productionWeek.map((d) => d.actual), tone: "accent" },
						]} />
						<div>
							<h3 className="mini">Line performance today</h3>
							<HBars rows={stations.map((s) => ({ label: s.name, value: Math.round((s.target / s.cycle) * 100), sub: s.status !== "Running" ? s.status : undefined }))} fmt={(n) => `${n}%`} />
						</div>
					</div>
				)}
				{area === "Inventory" && (
					<div className="split">
						<div>
							<h3 className="mini">Inventory ageing (value)</h3>
							<HBars rows={ageing().map((a) => ({ label: a.band, value: a.value }))} fmt={lakh} tone="info" />
						</div>
						<div>
							<h3 className="mini">Needs attention</h3>
							<Table dense cols={[
								{ key: "name", label: "Item" },
								{ key: "onHand", label: "On hand", num: true },
								{ key: "s", label: "Status", render: (r: Item) => <Badge>{stockState(r)}</Badge> },
							]} rows={items.filter((i) => stockState(i) !== "OK").slice(0, 6)} onRow={() => go("inventory")} />
						</div>
					</div>
				)}
				{area === "Battery & swap" && (
					<div className="split">
						<Chart labels={swapDaily.map((d) => d.day)} series={[{ name: "Swaps per day", values: swapDaily.map((d) => d.swaps), tone: "accent" }]} />
						<div>
							<h3 className="mini">Charged packs ready by station</h3>
							<ul className="station-cells">
								{swapStations.map((s) => (
									<li key={s.id}><span>{s.name}</span><Cell pct={Math.round((s.ready / s.slots) * 100)} label={`${s.ready}/${s.slots}`} /></li>
								))}
							</ul>
						</div>
					</div>
				)}
				{area === "Service" && (
					<div className="split">
						<Chart labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]} series={[
							{ name: "Opened", values: [41, 38, 45, 33, 47, 52], tone: "warn" },
							{ name: "Closed", values: [39, 44, 40, 37, 45, 49], tone: "accent" },
						]} />
						<div>
							<h3 className="mini">Turnaround by dealer (hours)</h3>
							<HBars rows={[
								{ label: "Marina E-Mobility", value: 5.1 }, { label: "Greenline Motors", value: 6.2 },
								{ label: "Sahyadri EV World", value: 7.8 }, { label: "Capital EV Hub", value: 8.1 }, { label: "Deccan Electric Wheels", value: 9.4 },
							]} fmt={(n) => `${n} h`} tone="warn" />
						</div>
					</div>
				)}
				{area === "Finance" && (
					<div className="split">
						<Chart labels={pnlMonths} stacked fmt={(n) => crore(n)} series={[
							{ name: "Vehicles", values: pnl.vehicleRevenue, tone: "accent" },
							{ name: "Swap", values: pnl.swapRevenue, tone: "info" },
							{ name: "Service & spares", values: pnl.serviceRevenue.map((v, i) => +(v + pnl.sparesRevenue[i]).toFixed(1)), tone: "warn" },
							{ name: "Budget", values: pnl.budgetRevenue, tone: "ink", kind: "line" },
						]} />
						<Facts rows={[
							["Revenue (Sep)", crore(+rev[5].toFixed(2))],
							["Cost of goods", crore(pnl.cogs[5])],
							["Gross profit", crore(+gp.toFixed(2))],
							["Operating expenses", crore(pnl.opex[5])],
							["Operating profit", <b>{crore(+(gp - pnl.opex[5]).toFixed(2))}</b>],
							["Revenue vs budget", <span className="neg">{(((rev[5] - pnl.budgetRevenue[5]) / pnl.budgetRevenue[5]) * 100).toFixed(1)}%</span>],
						]} />
					</div>
				)}
			</Panel>

			<div className="grid-2">
				<Panel title="Exceptions" note="Things that need a decision today">
					<ul className="exceptions">
						<li onClick={() => go("production")}><Badge tone="bad">Line</Badge>End-of-line test down 22 min — WO-7731 at risk for today</li>
						<li onClick={() => go("inventory")}><Badge tone="bad">Stock</Badge>BMS board v4 below minimum; WO-7734 blocked</li>
						<li onClick={() => go("swap")}><Badge tone="warn">Swap</Badge>Kharadi has 2 charged packs left — 13 still charging</li>
						<li onClick={() => go("procurement")}><Badge tone="warn">Vendor</Badge>Rapid Tyres on-time delivery fell to 82%</li>
						<li onClick={() => go("approvals")}><Badge tone="info">Approve</Badge>9 approvals waiting, ₹1.99 Cr in value</li>
					</ul>
				</Panel>
				<Panel title="Vehicles by stage" note="Where every vehicle is in its lifecycle" right={<button className="btn ghost sm" onClick={() => go("vehicles")}>Open vehicles</button>}>
					<HBars rows={[["In production", 90], ["Finished goods", 214], ["Dispatched", 168], ["At dealer", 132], ["Sold (this quarter)", 5410], ["In service today", 51]].map(([label, value]) => ({ label: label as string, value: value as number }))}
						fmt={(n) => n.toLocaleString("en-IN")} tone="info" />
				</Panel>
			</div>
		</Page>
	);
}

function FlowTrack() {
	const [active, setActive] = useState(7);
	const dest: Record<string, string> = { supplier: "procurement", po: "procurement", dispatch: "procurement", grn: "flow", inspection: "flow", warehouse: "inventory", issue: "inventory", assembly: "production", fg: "vehicles", battery: "batteries", out: "vehicles", customer: "service" };
	return (
		<section className="flow" aria-label="Material flow from supplier to customer">
			<div className="flow-head">
				<h2>Supplier to customer, live</h2>
				<button className="btn ghost sm" onClick={() => go("flow")}>Open material flow</button>
			</div>
			<ol className="flow-track">
				{flowStages.map((s, i) => (
					<li key={s.key} className={i === active ? "on" : ""}>
						<button onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => go(dest[s.key])}>
							<span className="flow-count">{s.count.toLocaleString("en-IN")}</span>
							<span className="flow-label">{s.label}</span>
							<span className="flow-unit">{s.unit}</span>
						</button>
					</li>
				))}
			</ol>
		</section>
	);
}

function ageing() {
	const bands = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["91–180 days", 91, 180], ["Over 180 days", 181, 9999]] as const;
	return bands.map(([band, a, b]) => ({ band, value: sum(items.filter((i) => i.ageDays >= a && i.ageDays <= b).map((i) => i.onHand * i.unitCost)) }));
}
export function stockState(i: Item) {
	if (i.onHand < i.min) return "Below min";
	if (i.onHand < i.reorder) return "Reorder";
	if (i.onHand > i.max) return "Excess";
	if (i.ageDays > 180) return "Non-moving";
	if (i.ageDays > 120) return "Slow-moving";
	return "OK";
}

// ================= Material flow & RFID =================
export function MaterialFlow() {
	const [trace, setTrace] = useState("MD9ZS1P26A052118");
	const [shown, setShown] = useState(true);
	return (
		<Page title="Material flow & RFID" sub="Every movement captured by gate, line-side and handheld readers updates stock automatically"
			actions={<button className="btn" onClick={() => toast("Cycle count started on handheld HH-03")}>Start cycle count</button>}>
			<Stats>
				<Stat label="Tag reads today" value="18,406" delta="99.2% matched to a document" tone="good" />
				<Stat label="Readers online" value="19 / 20" delta="Gate G3 offline since 09:12" tone="warn" />
				<Stat label="Unmatched tags" value="3" delta="Held at inbound gate" tone="bad" />
				<Stat label="Stock accuracy" value="98.7%" delta="Last full count 30 Sep" tone="good" />
			</Stats>

			<Panel title="Live reader events" note="Newest first" right={<span className="live"><i />Live</span>}>
				<Table cols={[
					{ key: "time", label: "Time" },
					{ key: "reader", label: "Reader", hideSm: true },
					{ key: "item", label: "Item" },
					{ key: "event", label: "Event", render: (r) => r.ok ? r.event : <span className="neg">{r.event}</span> },
				]} rows={rfidEvents} />
			</Panel>

			<Panel title="Trace a vehicle back to its parts" note="Search by VIN, battery ID, serial number or RFID tag">
				<form className="trace-form" onSubmit={(e) => { e.preventDefault(); setShown(true); }}>
					<input className="search" value={trace} onChange={(e) => { setTrace(e.target.value); setShown(false); }} aria-label="VIN, serial or tag" />
					<button className="btn" type="submit">Trace</button>
				</form>
				{shown && (
					<div className="trace">
						{[
							["Voltcell Energy", "PO-26-4120", "Cells batch LC-2502-17"],
							["Goods receipt", "GRN-88120", "Gate G1 · 03 Sep 09:14"],
							["Inspection", "QI-5521", "Passed · 0.2% sample"],
							["Warehouse", "Bin B-07-3", "Hosur central"],
							["Issued", "WO-7731", "Line 1 · 07 Oct 08:02"],
							["Assembly", "6 stations", "Cycle 26 min total"],
							["End-of-line test", "EOL-31984", "Passed"],
							["Battery paired", "BAT-48-20462", "SOH 100%"],
							["Dispatched", "DSP-2290", "Truck KA-51-AB-2231"],
							["Dealer", "Greenline Motors", "Received 08 Oct 10:40"],
						].map(([a, b, c], i) => (
							<div key={i} className="trace-step"><b>{a}</b><span>{b}</span><small>{c}</small></div>
						))}
					</div>
				)}
			</Panel>

			<Panel title="Recommended RFID hardware" note="Sized for 1 plant, 3 warehouses, 8 swap stations — final counts after site survey">
				<Table cols={[
					{ key: "type", label: "Device" },
					{ key: "where", label: "Where it goes", hideSm: true },
					{ key: "qty", label: "Qty", num: true, render: (r) => r.qty.toLocaleString("en-IN") },
					{ key: "range", label: "Read range", hideSm: true },
					{ key: "ip", label: "Rating", hideSm: true },
					{ key: "proto", label: "Interface", hideSm: true },
				]} rows={rfidHardware} />
			</Panel>
		</Page>
	);
}

// ================= Procurement =================
export function Procurement() {
	const [tab, setTab] = useState<"Purchase orders" | "Goods receipt & inspection" | "Requisitions" | "Quotation comparison" | "Vendors">("Purchase orders");
	const [po, setPo] = useState<PO | null>(null);
	const [extraPOs] = useExtraPOs();
	const allPOs = [...extraPOs, ...purchaseOrders];
	const openP = useOpenParam();
	useEffect(() => { const p = allPOs.find((x) => x.no === openP.id); if (p) { setTab("Purchase orders"); setPo(p); } }, [openP]);
	const open = purchaseOrders.filter((p) => p.status !== "Inspected" && p.status !== "Received");
	return (
		<Page title="Procurement" sub="From requisition to goods receipt and inspection"
			actions={<button className="btn" onClick={() => toast("Draft purchase requisition PR-1884 created")}>New requisition</button>}>
			<Stats>
				<Stat label="Open purchase orders" value={String(open.length)} delta={lakh(sum(open.map((p) => p.value))) + " outstanding"} />
				<Stat label="Waiting for approval" value="3" delta="Oldest 5 h" tone="warn" />
				<Stat label="Vendor on-time delivery" value="90.2%" delta="Target 95%" tone="warn" />
				<Stat label="Spend this month" value={crore(sum(vendors.map((v) => v.spend)))} delta="12% under budget" tone="good" />
			</Stats>
			<Panel right={<Tabs tabs={["Purchase orders", "Goods receipt & inspection", "Requisitions", "Quotation comparison", "Vendors"] as const} value={tab} onChange={setTab} />}>
				{tab === "Purchase orders" && (
					<Table cols={[
						{ key: "no", label: "PO" },
						{ key: "vendor", label: "Vendor" },
						{ key: "items", label: "Main item", hideSm: true },
						{ key: "value", label: "Value", num: true, render: (r: PO) => inr(r.value) },
						{ key: "due", label: "Due", hideSm: true },
						{ key: "received", label: "Received", render: (r: PO) => <span className="inline-bar"><Bar pct={r.received} />{r.received}%</span>, hideSm: true },
						{ key: "status", label: "Status", render: (r: PO) => <Badge>{r.status}</Badge> },
					]} rows={allPOs} onRow={setPo} />
				)}
				{tab === "Goods receipt & inspection" && <GoodsReceipt />}
				{tab === "Requisitions" && (
					<Table cols={[
						{ key: "no", label: "Requisition" }, { key: "item", label: "Item" },
						{ key: "qty", label: "Qty", num: true, render: (r) => r.qty.toLocaleString("en-IN") },
						{ key: "by", label: "Raised by", hideSm: true }, { key: "need", label: "Needed by" },
						{ key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
					]} rows={requisitions} />
				)}
				{tab === "Quotation comparison" && <QuotationComparison />}
				{tab === "Vendors" && (
					<Table cols={[
						{ key: "name", label: "Vendor" }, { key: "category", label: "Supplies", hideSm: true }, { key: "city", label: "City", hideSm: true },
						{ key: "otd", label: "On-time", num: true, render: (r) => <span className={r.otd < 90 ? "neg" : ""}>{r.otd}%</span> },
						{ key: "quality", label: "Quality", num: true, render: (r) => `${r.quality}%` },
						{ key: "spend", label: "Spend YTD", num: true, render: (r) => crore(r.spend) },
						{ key: "rating", label: "Rating", num: true },
					]} rows={vendors} />
				)}
			</Panel>
			<Drawer open={!!po} onClose={() => setPo(null)} title={po?.no ?? ""} sub={po?.vendor}>
				{po && (
					<>
						<Facts rows={[["Status", <Badge>{po.status}</Badge>], ["Main item", po.items], ["Value", inr(po.value)], ["Ordered", po.date], ["Due", po.due], ["Received", `${po.received}%`]]} />
						<h3 className="mini">Tracking</h3>
						<Timeline items={[
							{ when: po.date, what: "PO created", detail: "Raised from PR-1876 by Ravi (Purchase)" },
							{ when: po.date, what: "Approved", detail: "Plant head, then Finance" },
							...(po.received > 0 ? [{ when: "02 Oct", what: "Dispatched by vendor", detail: "LR 55821 · ETA 2 days" }, { when: "04 Oct", what: "Goods receipt", where: "Gate G1", detail: "RFID read 412 / 412 cartons" }] : []),
							...(po.received === 100 ? [{ when: "05 Oct", what: "Inspection passed", detail: "QI-5530, accepted into bin A-04" }] : []),
						]} />
					</>
				)}
			</Drawer>
		</Page>
	);
}

// ================= Inventory =================
export function Inventory() {
	const [wh, setWh] = useState("All locations");
	const [q, setQ] = useState("");
	const [sel, setSel] = useState<Item | null>(null);
	const openI = useOpenParam();
	useEffect(() => { const i = items.find((x) => x.code === openI.id); if (i) setSel(i); }, [openI]);
	const [tab, setTab] = useState<"Stock" | "Transfers" | "Physical count" | "Reconciliation">("Stock");
	const rows = useMemo(() => items.filter((i) => (wh === "All locations" || i.warehouse === wh) && (i.name + i.code).toLowerCase().includes(q.toLowerCase())), [wh, q]);
	const value = sum(items.map((i) => i.onHand * i.unitCost));
	return (
		<Page title="Inventory & warehouses" sub="Stock across the central warehouse, line-side and site stores"
			actions={<><button className="btn ghost" onClick={() => toast("Stock transfer TR-0931 drafted")}>Transfer stock</button><button className="btn" onClick={() => toast("Exported inventory_08-Oct-2026.xlsx")}>Export</button></>}>
			<Stats>
				<Stat label="Inventory value" value={lakh(value)} delta={`${items.length} SKUs across ${warehouses.length} locations`} />
				<Stat label="Below minimum" value={String(items.filter((i) => i.onHand < i.min).length)} delta="Production at risk" tone="bad" />
				<Stat label="Slow or non-moving" value={lakh(sum(items.filter((i) => i.ageDays > 120).map((i) => i.onHand * i.unitCost)))} delta="Over 120 days" tone="warn" />
				<Stat label="Stock accuracy" value="98.7%" delta="RFID cycle counts" tone="good" />
			</Stats>
			<div className="page-tabs"><Tabs tabs={["Stock", "Transfers", "Physical count", "Reconciliation"] as const} value={tab} onChange={setTab} /></div>
			{tab === "Transfers" && <Panel title="Stock transfers" note="Moves between warehouses, line-side and site stores"><Transfers /></Panel>}
			{tab === "Physical count" && <Panel title="Physical stock verification" note="Cycle counts by RFID handheld, fixed reader or barcode"><PhysicalCount /></Panel>}
			{tab === "Reconciliation" && <Panel title="Inventory reconciliation" note="System stock against counted stock, with reasons and adjustments"><Reconciliation /></Panel>}
			{tab === "Stock" && <Panel right={
				<div className="filters">
					<Search value={q} onChange={setQ} placeholder="Search item or code" />
					<select value={wh} onChange={(e) => setWh(e.target.value)} aria-label="Location">
						<option>All locations</option>
						{warehouses.map((w) => <option key={w}>{w}</option>)}
					</select>
				</div>
			}>
				<Table cols={[
					{ key: "code", label: "Code", hideSm: true },
					{ key: "name", label: "Item" },
					{ key: "warehouse", label: "Location", hideSm: true, render: (r: Item) => <>{r.warehouse}<small className="sub"> · {r.bin}</small></> },
					{ key: "onHand", label: "On hand", num: true, render: (r: Item) => `${r.onHand.toLocaleString("en-IN")} ${r.uom}` },
					{ key: "lvl", label: "Min / max", hideSm: true, render: (r: Item) => <span className="inline-bar"><Bar pct={(r.onHand / r.max) * 100} tone={r.onHand < r.min ? "bad" : r.onHand > r.max ? "warn" : "accent"} /></span> },
					{ key: "val", label: "Value", num: true, hideSm: true, render: (r: Item) => inr(r.onHand * r.unitCost) },
					{ key: "age", label: "Age", num: true, hideSm: true, render: (r: Item) => `${r.ageDays} d` },
					{ key: "st", label: "Status", render: (r: Item) => { const s = stockState(r); return s === "OK" ? <span className="sub">OK</span> : <Badge tone={s === "Below min" || s === "Reorder" ? "bad" : "warn"}>{s}</Badge>; } },
				]} rows={rows} onRow={setSel} />
				{rows.length === 0 && <p className="empty">No items match “{q}”. Clear the search to see all stock.</p>}
			</Panel>}
			<Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""} sub={sel ? `${sel.code} · ${sel.category}` : ""}>
				{sel && (
					<>
						<Facts rows={[
							["On hand", `${sel.onHand.toLocaleString("en-IN")} ${sel.uom}`], ["Reserved for work orders", `${Math.round(sel.onHand * 0.3)} ${sel.uom}`],
							["Min / reorder / max", `${sel.min} / ${sel.reorder} / ${sel.max}`], ["Location", `${sel.warehouse}, bin ${sel.bin}`],
							["Tracking", `${sel.tracking}${sel.rfid ? " + RFID" : ""}`], ["Unit cost", inr(sel.unitCost)], ["Value", inr(sel.onHand * sel.unitCost)], ["Oldest stock", `${sel.ageDays} days`],
						]} />
						<h3 className="mini">Recent movements</h3>
						<Timeline items={[
							{ when: "08 Oct 08:02", what: `Issued 40 ${sel.uom}`, where: "Line 1", detail: "Against WO-7731" },
							{ when: "06 Oct 15:30", what: `Received 300 ${sel.uom}`, where: "Gate G1", detail: "GRN-88131, inspection passed" },
							{ when: "03 Oct 11:10", what: `Transferred 60 ${sel.uom}`, where: "Pune site WH", detail: "TR-0927" },
							{ when: "30 Sep", what: "Physical count", detail: "Variance 0 — matched" },
						]} />
					</>
				)}
			</Drawer>
		</Page>
	);
}
