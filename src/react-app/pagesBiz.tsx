import { useState } from "react";
import { jobCards, warrantyClaims, complaints, dealers, pnl, pnlMonths, costCentres, approvals, items, vendors, swapStations, warehouses, inr, crore, sum } from "./data";
import type { Approval } from "./data";
import { Appointments, BuPnl } from "./pagesExtra";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, Bar, Tabs, Facts, toast } from "./ui";

// ================= Dealer & service =================
export function Service() {
	const [tab, setTab] = useState<"Job cards" | "Appointments" | "Warranty claims" | "Dealers" | "Complaints">("Job cards");
	return (
		<Page title="Dealers & service" sub="Job cards, warranty and dealer performance across 5 dealers"
			actions={<button className="btn" onClick={() => toast("Job card JC-31205 opened for VIN …052150")}>New job card</button>}>
			<Stats>
				<Stat label="Open service jobs" value="51" delta="9 waiting for parts" tone="warn" />
				<Stat label="Closed this month" value="412" delta="+8% vs September" tone="good" />
				<Stat label="Average turnaround" value="7.1 h" delta="Target 6 h" tone="warn" />
				<Stat label="Service revenue (Sep)" value={crore(pnl.serviceRevenue[5] + pnl.sparesRevenue[5])} delta="Labour + spares" />
			</Stats>
			<Panel right={<Tabs tabs={["Job cards", "Appointments", "Warranty claims", "Dealers", "Complaints"] as const} value={tab} onChange={setTab} />}>
				{tab === "Job cards" && (
					<div className="kanban">
						{["Diagnosis", "Awaiting parts", "Warranty approval", "In repair", "Ready for delivery", "Closed"].map((col) => (
							<div key={col} className="kan-col">
								<h3>{col}<span>{jobCards.filter((j) => j.status === col).length}</span></h3>
								{jobCards.filter((j) => j.status === col).map((j) => (
									<article key={j.no} className="kan-card">
										<b>{j.complaint}</b>
										<small>{j.no} · VIN {j.vin}</small>
										<small>{j.customer} · {j.dealer}</small>
										<footer><span>{j.tech}</span><span>{j.age}</span>{j.warranty && <Badge tone="info">Warranty</Badge>}</footer>
									</article>
								))}
							</div>
						))}
					</div>
				)}
				{tab === "Appointments" && <Appointments />}
				{tab === "Warranty claims" && (
					<Table cols={[
						{ key: "no", label: "Claim" }, { key: "part", label: "Part" }, { key: "dealer", label: "Dealer", hideSm: true },
						{ key: "amount", label: "Amount", num: true, render: (r) => inr(r.amount) },
						{ key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
						{ key: "a", label: "", render: (r) => r.status !== "Approved" ? <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); toast(`${r.no} approved — credit note raised`); }}>Approve</button> : null },
					]} rows={warrantyClaims} />
				)}
				{tab === "Dealers" && (
					<Table cols={[
						{ key: "name", label: "Dealer", render: (r) => <>{r.name}<small className="sub"> · {r.city}</small></> },
						{ key: "sold", label: "Sold (Sep)", num: true }, { key: "stock", label: "Stock", num: true, hideSm: true },
						{ key: "openJobs", label: "Open jobs", num: true, hideSm: true },
						{ key: "tat", label: "Turnaround", num: true, render: (r) => <span className={r.tat > 8 ? "neg" : ""}>{r.tat} h</span> },
						{ key: "csat", label: "Rating", num: true, hideSm: true },
						{ key: "revenue", label: "Revenue", num: true, render: (r) => crore(r.revenue) },
					]} rows={dealers} />
				)}
				{tab === "Complaints" && (
					<div className="split">
						<Chart labels={complaints.map((c) => c.cat.split(" ")[0])} stacked series={[
							{ name: "Closed", values: complaints.map((c) => c.closed), tone: "accent" },
							{ name: "Open", values: complaints.map((c) => c.open), tone: "warn" },
						]} />
						<Facts rows={complaints.map((c) => [c.cat, `${c.open} open · ${c.closed} closed`] as [string, string])} />
					</div>
				)}
			</Panel>
		</Page>
	);
}

// ================= Finance =================
export function Finance() {
	const rev = pnl.vehicleRevenue.map((v, i) => +(v + pnl.swapRevenue[i] + pnl.serviceRevenue[i] + pnl.sparesRevenue[i]).toFixed(2));
	const gp = rev.map((r, i) => +(r - pnl.cogs[i]).toFixed(2));
	const op = gp.map((g, i) => +(g - pnl.opex[i]).toFixed(2));
	const tot = (a: number[]) => +sum(a).toFixed(2);
	const lines: [string, number[], string?][] = [
		["Vehicle sales", pnl.vehicleRevenue], ["Swap revenue", pnl.swapRevenue], ["Service revenue", pnl.serviceRevenue], ["Spare parts", pnl.sparesRevenue],
		["Total revenue", rev, "strong"], ["Cost of goods sold", pnl.cogs], ["Gross profit", gp, "strong"], ["Operating expenses", pnl.opex], ["Operating profit", op, "total"],
	];
	return (
		<Page title="Finance & P&L" sub="H1 FY 2026–27 · figures in ₹ crore · synced nightly from Tally Prime"
			actions={<button className="btn" onClick={() => toast("Exported P&L_H1_FY27.pdf")}>Export P&L</button>}>
			<Stats>
				<Stat label="Revenue (H1)" value={crore(tot(rev))} delta={`${(((tot(rev) - tot(pnl.budgetRevenue)) / tot(pnl.budgetRevenue)) * 100).toFixed(1)}% vs budget`} tone="bad" />
				<Stat label="Gross profit (H1)" value={crore(tot(gp))} delta={`${((tot(gp) / tot(rev)) * 100).toFixed(1)}% margin`} tone="good" />
				<Stat label="Operating profit (H1)" value={crore(tot(op))} delta={`${((tot(op) / tot(rev)) * 100).toFixed(1)}% margin`} />
				<Stat label="Inventory carrying cost" value="₹0.31 Cr" delta="18% p.a. on stock value" />
			</Stats>
			<div className="grid-2">
				<Panel title="Revenue vs budget">
					<Chart labels={pnlMonths} stacked fmt={(n) => crore(n)} series={[
						{ name: "Vehicles", values: pnl.vehicleRevenue, tone: "accent" },
						{ name: "Swap", values: pnl.swapRevenue, tone: "info" },
						{ name: "Service & spares", values: pnl.serviceRevenue.map((v, i) => +(v + pnl.sparesRevenue[i]).toFixed(1)), tone: "warn" },
						{ name: "Budget", values: pnl.budgetRevenue, tone: "ink", kind: "line" },
					]} />
				</Panel>
				<Panel title="Cost centres — September" note="Actual against budget">
					<ul className="cc">
						{costCentres.map((c) => {
							const v = ((c.actual - c.budget) / c.budget) * 100;
							return (
								<li key={c.name}>
									<span>{c.name}</span>
									<Bar pct={(c.actual / 13) * 100} tone={v > 0 ? "warn" : "accent"} />
									<span className="num">{crore(c.actual)}</span>
									<span className={`num ${v > 0 ? "neg" : "pos"}`}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>
								</li>
							);
						})}
					</ul>
				</Panel>
			</div>
			<Panel title="Profit by business unit" note="H1 FY 2026–27, ₹ crore">
				<BuPnl />
			</Panel>
			<Panel title="Profit & loss statement">
				<div className="table-wrap">
					<table className="pnl">
						<thead><tr><th>₹ crore</th>{pnlMonths.map((m) => <th key={m} className="num">{m}</th>)}<th className="num">H1</th></tr></thead>
						<tbody>
							{lines.map(([name, vals, cls]) => (
								<tr key={name} className={cls ?? ""}><td>{name}</td>{vals.map((v, i) => <td key={i} className="num">{v.toFixed(2)}</td>)}<td className="num">{tot(vals).toFixed(2)}</td></tr>
							))}
						</tbody>
					</table>
				</div>
			</Panel>
		</Page>
	);
}

// ================= Approvals =================
export function Approvals() {
	const [list, setList] = useState<Approval[]>(approvals);
	const types = ["All", ...Array.from(new Set(approvals.map((a) => a.type)))];
	const [t, setT] = useState("All");
	const act = (a: Approval, ok: boolean) => { setList((l) => l.filter((x) => x.id !== a.id)); toast(`${a.id} ${ok ? "approved" : "sent back"} — ${a.by} notified`); };
	const shown = list.filter((a) => t === "All" || a.type === t);
	return (
		<Page title="Approvals" sub="Everything waiting on you, from every workflow">
			<Panel right={<select value={t} onChange={(e) => setT(e.target.value)} aria-label="Type">{types.map((x) => <option key={x}>{x}</option>)}</select>}>
				{shown.length === 0 ? <p className="empty">You're all caught up. New requests will show here and by email.</p> : (
					<ul className="approvals">
						{shown.map((a) => (
							<li key={a.id}>
								<div className="ap-main">
									<span className="ap-type">{a.type} · {a.id}</span>
									<b>{a.title}</b>
									<small>From {a.by} · waiting {a.age} · now with {a.step}</small>
								</div>
								{a.value && <span className="ap-val">{inr(a.value)}</span>}
								<div className="ap-btns">
									<button className="btn ghost sm" onClick={() => act(a, false)}>Send back</button>
									<button className="btn sm" onClick={() => act(a, true)}>Approve</button>
								</div>
							</li>
						))}
					</ul>
				)}
			</Panel>
			<Panel title="Workflow example — purchase order" note="Steps and limits are configurable per document type">
				<ol className="wf">
					{[["Raised", "Purchase team"], ["Plant head", "Up to ₹5 L"], ["Finance", "Up to ₹50 L"], ["Managing director", "Above ₹50 L"], ["Sent to vendor", "Email + vendor portal"]].map(([a, b], i) => (
						<li key={a} className={i < 2 ? "done" : i === 2 ? "now" : ""}><b>{a}</b><small>{b}</small></li>
					))}
				</ol>
			</Panel>
		</Page>
	);
}

// ================= Reports =================
const reportGroups: [string, string[]][] = [
	["Inventory", ["Stock on hand by location", "Inventory ageing", "Slow and non-moving stock", "Reorder report", "Stock valuation", "Physical count variance"]],
	["Production", ["Daily production vs plan", "Work order status", "Line efficiency", "Rework and rejection", "Component traceability"]],
	["Battery & swap", ["Battery fleet health", "Battery movement log", "Daily swap transactions", "Swap revenue by station", "Station utilisation"]],
	["Vehicles & service", ["Vehicle lifecycle", "Dispatch register", "Service turnaround", "Warranty claims", "Dealer performance"]],
	["Purchase & finance", ["Purchase register", "Vendor performance", "P&L by business unit", "Budget vs actual", "Cost centre report"]],
];
export function Reports() {
	const [freq, setFreq] = useState<"Daily" | "Weekly" | "Monthly">("Daily");
	return (
		<Page title="Reports" sub="Run any report, export to Excel or PDF, or schedule it by email">
			<Panel right={<Tabs tabs={["Daily", "Weekly", "Monthly"] as const} value={freq} onChange={setFreq} />}>
				<div className="reports">
					{reportGroups.map(([g, list]) => (
						<div key={g}>
							<h3 className="mini">{g}</h3>
							<ul>
								{list.map((r) => (
									<li key={r}>
										<span>{r}</span>
										<span className="rep-btns">
											<button className="btn ghost sm" onClick={() => toast(`${freq} “${r}” exported to Excel`)}>Excel</button>
											<button className="btn ghost sm" onClick={() => toast(`${freq} “${r}” exported to PDF`)}>PDF</button>
										</span>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</Panel>
			<Panel title="Scheduled" note="Sent automatically">
				<Table cols={[{ key: "r", label: "Report" }, { key: "f", label: "When" }, { key: "to", label: "Sent to" }]} rows={[
					{ r: "Daily production vs plan", f: "Every day 7:00", to: "Plant head, MD" },
					{ r: "Swap revenue by station", f: "Every day 23:30", to: "Network manager, Finance" },
					{ r: "Exceptions summary", f: "Every day 8:30", to: "Management team" },
					{ r: "P&L by business unit", f: "1st of month", to: "MD, CFO" },
				]} />
			</Panel>
		</Page>
	);
}

// ================= Master data =================
export function Masters() {
	const tabs = ["Items", "Vendors", "Warehouses", "Swap stations", "Users & roles"] as const;
	const [tab, setTab] = useState<(typeof tabs)[number]>("Items");
	return (
		<Page title="Master data" sub="One source of truth for items, partners, locations and people"
			actions={<button className="btn" onClick={() => toast(`New ${tab.toLowerCase().replace(/s$/, "")} form opened`)}>Add record</button>}>
			<Panel right={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
				{tab === "Items" && <Table dense cols={[
					{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "category", label: "Category", hideSm: true },
					{ key: "uom", label: "Unit", hideSm: true }, { key: "tracking", label: "Tracking" }, { key: "rfid", label: "RFID", render: (r) => r.rfid ? "Yes" : "—" },
				]} rows={items} />}
				{tab === "Vendors" && <Table dense cols={[{ key: "name", label: "Vendor" }, { key: "category", label: "Category" }, { key: "city", label: "City" }, { key: "g", label: "GSTIN", hideSm: true, render: (r) => `29AAB${r.name.slice(0, 3).toUpperCase()}1234F1Z5` }]} rows={vendors} />}
				{tab === "Warehouses" && <Table dense cols={[{ key: "n", label: "Location" }, { key: "t", label: "Type" }, { key: "b", label: "Bins", num: true }]} rows={warehouses.map((n, i) => ({ n, t: ["Central warehouse", "Line-side store", "Site warehouse", "Service store"][i], b: [480, 64, 120, 90][i] }))} />}
				{tab === "Swap stations" && <Table dense cols={[{ key: "id", label: "Station" }, { key: "name", label: "Name" }, { key: "city", label: "City" }, { key: "slots", label: "Slots", num: true }]} rows={swapStations} />}
				{tab === "Users & roles" && <Table dense cols={[{ key: "n", label: "User" }, { key: "r", label: "Role" }, { key: "s", label: "Access" }]} rows={[
					{ n: "Ravi Menon", r: "Plant head", s: "All modules · approver up to ₹5 L" },
					{ n: "Kavya Shah", r: "Production planner", s: "Production, inventory" },
					{ n: "Suresh K", r: "Service technician", s: "Mobile app · job cards" },
					{ n: "Anita Rao", r: "Finance controller", s: "Finance, approvals up to ₹50 L" },
					{ n: "Greenline Motors", r: "Dealer", s: "Dealer portal · own vehicles & jobs" },
				]} />}
			</Panel>
		</Page>
	);
}
