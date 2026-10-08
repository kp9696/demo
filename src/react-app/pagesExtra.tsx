import { useState } from "react";
import type { FormEvent } from "react";
import { grns, inspectionPlan, transfers, counts, recon, mrp, fgYard, appointments, buPnl, warehouses, items, dealers, inr, crore } from "./data";
import { usePersist } from "./store";
import { Badge, Table, Bar, Facts, HBars, toast } from "./ui";

// ---------- Goods receipt & inspection (Procurement) ----------
type Grn = (typeof grns)[number];
export function GoodsReceipt() {
	const [rows, setRows] = usePersist<Grn[]>("grns", grns);
	const [selNo, setSelNo] = useState<string | null>(grns[0].no);
	const sel = rows.find((g) => g.no === selNo) ?? null;
	const [checks, setChecks] = useState<Record<number, "Pass" | "Fail" | undefined>>({});
	const decide = (status: string) => {
		if (!sel) return;
		setRows((r) => r.map((g) => (g.no === sel.no ? { ...g, status } : g)));
		toast(`${sel.no} ${status.toLowerCase()} — stock ${status === "Rejected" ? "not posted, vendor informed" : "posted to bin A-04"}`);
		setSelNo(null); setChecks({});
	};
	const allChecked = inspectionPlan.every((_, i) => checks[i]);
	const anyFail = Object.values(checks).includes("Fail");
	return (
		<div className="split">
			<div>
				<h3 className="mini">Goods receipts from gate RFID reads</h3>
				<Table cols={[
					{ key: "no", label: "GRN" },
					{ key: "item", label: "Item", render: (r: Grn) => <>{r.item}<small className="sub"> · {r.qty.toLocaleString("en-IN")}</small></> },
					{ key: "tags", label: "Tags read", hideSm: true },
					{ key: "status", label: "Status", render: (r: Grn) => <Badge>{r.status}</Badge> },
				]} rows={rows} onRow={(r) => { setSelNo(r.no); setChecks({}); }} />
			</div>
			<div className="inspect">
				{sel ? (
					<>
						<h3 className="mini">Inspection — {sel.no}</h3>
						<Facts rows={[["Vendor", sel.vendor], ["Against PO", sel.po], ["Received", `${sel.time}, ${sel.gate}`], ["Quantity", sel.qty.toLocaleString("en-IN")]]} />
						{sel.status === "Awaiting inspection" ? (
							<>
								<ul className="checks">
									{inspectionPlan.map((c, i) => (
										<li key={c.check}>
											<span>{c.check}<small>{c.sample}</small></span>
											<span className="seg">
												<button className={checks[i] === "Pass" ? "on good" : ""} onClick={() => setChecks((x) => ({ ...x, [i]: "Pass" }))}>Pass</button>
												<button className={checks[i] === "Fail" ? "on bad" : ""} onClick={() => setChecks((x) => ({ ...x, [i]: "Fail" }))}>Fail</button>
											</span>
										</li>
									))}
								</ul>
								<div className="row-btns">
									<button className="btn ghost" disabled={!allChecked} onClick={() => decide("Rejected")}>Reject lot</button>
									<button className="btn" disabled={!allChecked} onClick={() => decide(anyFail ? "Partly rejected" : "Accepted")}>{anyFail ? "Accept good quantity" : "Accept and put away"}</button>
								</div>
								{!allChecked && <p className="hint">Mark every check as pass or fail to finish the inspection.</p>}
							</>
						) : <p className="hint">Inspection finished: <Badge>{sel.status}</Badge></p>}
					</>
				) : <p className="empty">Pick a goods receipt to inspect it.</p>}
			</div>
		</div>
	);
}

// ---------- Stock transfers ----------
export function Transfers() {
	const [rows, setRows] = usePersist("transfers", transfers);
	const [from, setFrom] = useState(warehouses[0]);
	const [to, setTo] = useState(warehouses[2]);
	const [item, setItem] = useState(items[0].name);
	const [qty, setQty] = useState("50");
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (from === to) { toast("Pick two different locations for the transfer"); return; }
		const no = `TR-0${932 + rows.length - 4}`;
		setRows((r) => [{ no, from, to, items: `${item} × ${qty}`, status: "Pending approval", eta: "—" }, ...r]);
		toast(`${no} created and sent to the stores head for approval`);
	};
	return (
		<>
			<form className="inline-form" onSubmit={submit}>
				<label>From<select id="tr-from" value={from} onChange={(e) => setFrom(e.target.value)}>{warehouses.map((w) => <option key={w}>{w}</option>)}</select></label>
				<label>To<select id="tr-to" value={to} onChange={(e) => setTo(e.target.value)}>{warehouses.map((w) => <option key={w}>{w}</option>)}</select></label>
				<label>Item<select id="tr-item" value={item} onChange={(e) => setItem(e.target.value)}>{items.map((i) => <option key={i.code}>{i.name}</option>)}</select></label>
				<label>Qty<input id="tr-qty" className="search" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
				<button className="btn" type="submit">Create transfer</button>
			</form>
			<Table cols={[
				{ key: "no", label: "Transfer" }, { key: "from", label: "From", hideSm: true }, { key: "to", label: "To" },
				{ key: "items", label: "Items", hideSm: true }, { key: "eta", label: "Arrives", hideSm: true },
				{ key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
			]} rows={rows} />
		</>
	);
}

// ---------- Physical count ----------
export function PhysicalCount() {
	const [rows, setRows] = usePersist("counts", counts);
	return (
		<>
			<div className="row-btns end"><button className="btn" onClick={() => { setRows((r) => r.map((c) => c.status === "Scheduled" ? { ...c, status: "In progress" } : c)); toast("PC-0415 started on handheld HH-03"); }}>Start scheduled count</button></div>
			<Table cols={[
				{ key: "no", label: "Count" }, { key: "area", label: "Area" }, { key: "method", label: "Method", hideSm: true },
				{ key: "prog", label: "Counted", render: (r) => <span className="inline-bar"><Bar pct={(r.counted / r.items) * 100} />{r.counted}/{r.items}</span> },
				{ key: "variance", label: "Variance", num: true, render: (r) => <span className={r.variance ? "neg" : ""}>{r.variance > 0 ? "+" : ""}{r.variance}</span> },
				{ key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
			]} rows={rows} />
		</>
	);
}

// ---------- Reconciliation ----------
export function Reconciliation() {
	const [rows, setRows] = usePersist("recon", recon);
	return (
		<Table cols={[
			{ key: "item", label: "Item" },
			{ key: "system", label: "System", num: true, hideSm: true }, { key: "physical", label: "Physical", num: true, hideSm: true },
			{ key: "diff", label: "Difference", num: true, render: (r) => <span className={r.diff < 0 ? "neg" : r.diff > 0 ? "pos" : ""}>{r.diff > 0 ? "+" : ""}{r.diff}</span> },
			{ key: "value", label: "Value", num: true, render: (r) => inr(r.value) },
			{ key: "reason", label: "Reason", hideSm: true },
			{ key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
			{ key: "a", label: "", render: (r) => r.status === "Write-off pending" || r.status === "Investigating" ? <button className="btn sm ghost" onClick={() => { setRows((x) => x.map((y) => y.item === r.item ? { ...y, status: "Sent for approval" } : y)); toast(`Adjustment for ${r.item} sent to finance for approval`); }}>Post adjustment</button> : null },
		]} rows={rows} />
	);
}

// ---------- MRP ----------
export function Mrp() {
	const [ran, setRan] = useState("08 Oct, 06:00");
	return (
		<>
			<div className="row-btns spread">
				<p className="hint">Next 7 days of work orders against stock and open POs · last run {ran}</p>
				<button className="btn" onClick={() => { setRan("08 Oct, just now"); toast("MRP run complete — 2 shortages, 2 requisitions suggested"); }}>Run MRP</button>
			</div>
			<Table cols={[
				{ key: "item", label: "Item" },
				{ key: "need", label: "Needed", num: true, render: (r) => r.need.toLocaleString("en-IN") },
				{ key: "onHand", label: "On hand", num: true, hideSm: true, render: (r) => r.onHand.toLocaleString("en-IN") },
				{ key: "onOrder", label: "On order", num: true, hideSm: true, render: (r) => r.onOrder.toLocaleString("en-IN") },
				{ key: "short", label: "Short", num: true, render: (r) => r.short ? <span className="neg">{r.short.toLocaleString("en-IN")}</span> : "—" },
				{ key: "action", label: "Suggested action", render: (r) => r.short ? <button className="btn sm ghost" onClick={() => toast(`${r.action} — done`)}>{r.action}</button> : <Badge>Covered</Badge> },
			]} rows={mrp} />
		</>
	);
}

// ---------- Finished goods ----------
export function FinishedGoods() {
	const total = fgYard.reduce((a, r) => a + r.qty, 0);
	return (
		<>
			<p className="hint">{total} vehicles in the finished goods yard, each with battery paired and end-of-line test passed</p>
			<Table cols={[
				{ key: "model", label: "Model", render: (r) => <>{r.model}<small className="sub"> · {r.colour}</small></> },
				{ key: "qty", label: "In yard", num: true },
				{ key: "alloc", label: "Allocated", render: (r) => <span className="inline-bar"><Bar pct={(r.allocated / r.qty) * 100} />{r.allocated}/{r.qty}</span> },
				{ key: "dealer", label: "Dealer", hideSm: true },
				{ key: "age", label: "Oldest", num: true, render: (r) => <span className={r.age === "9 d" ? "neg" : ""}>{r.age}</span> },
				{ key: "a", label: "", render: (r) => r.allocated < r.qty ? <button className="btn sm ghost" onClick={() => toast(`${r.qty - r.allocated} × ${r.model} allocated to ${dealers[0].name} — dispatch note drafted`)}>Allocate</button> : null },
			]} rows={fgYard} />
		</>
	);
}

// ---------- Service appointments ----------
export function Appointments() {
	const [rows, setRows] = usePersist("appointments", appointments);
	const [name, setName] = useState("");
	const [reg, setReg] = useState("");
	const [type, setType] = useState("Periodic service");
	const [slot, setSlot] = useState("16:30");
	const book = (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !reg.trim()) { toast("Add the customer name and vehicle number to book"); return; }
		setRows((r) => [...r, { time: slot, customer: name, vehicle: reg.toUpperCase(), type, dealer: "Greenline Motors", tech: "Suresh K", status: "Booked" }]);
		toast(`Booked ${slot} for ${name} — SMS confirmation queued`);
		setName(""); setReg("");
	};
	return (
		<>
			<form className="inline-form" onSubmit={book}>
				<label>Customer<input id="ap-name" className="search" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" /></label>
				<label>Vehicle<input id="ap-reg" className="search" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="KA-01-EV-1234" /></label>
				<label>Type<select id="ap-type" value={type} onChange={(e) => setType(e.target.value)}><option>Periodic service</option><option>Battery check</option><option>Accident repair estimate</option><option>Complaint</option></select></label>
				<label>Slot<select id="ap-slot" value={slot} onChange={(e) => setSlot(e.target.value)}><option>16:30</option><option>17:00</option><option>17:30</option></select></label>
				<button className="btn" type="submit">Book appointment</button>
			</form>
			<ul className="schedule">
				{rows.map((a, i) => (
					<li key={i}>
						<span className="sch-time">{a.time}</span>
						<div><b>{a.type}</b><small>{a.customer} · {a.vehicle} · {a.dealer} · {a.tech}</small></div>
						<Badge>{a.status}</Badge>
					</li>
				))}
			</ul>
		</>
	);
}

// ---------- Business-unit P&L ----------
export function BuPnl() {
	const rows = buPnl.map((b) => ({ ...b, gross: +(b.revenue - b.cogs).toFixed(1), op: +(b.revenue - b.cogs - b.opex).toFixed(1) }));
	return (
		<div className="split">
			<Table cols={[
				{ key: "bu", label: "Business unit" },
				{ key: "revenue", label: "Revenue", num: true, render: (r) => crore(r.revenue) },
				{ key: "gross", label: "Gross profit", num: true, hideSm: true, render: (r) => crore(r.gross) },
				{ key: "op", label: "Operating profit", num: true, render: (r) => crore(r.op) },
				{ key: "m", label: "Margin", num: true, render: (r) => `${((r.op / r.revenue) * 100).toFixed(1)}%` },
			]} rows={rows} />
			<div>
				<h3 className="mini">Operating margin by unit (H1)</h3>
				<HBars rows={rows.map((r) => ({ label: r.bu, value: +((r.op / r.revenue) * 100).toFixed(1) }))} fmt={(n) => `${n}%`} />
			</div>
		</div>
	);
}
