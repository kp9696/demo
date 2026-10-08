import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { vendors, items, approvals, inr } from "./data";
import type { Approval, PO } from "./data";
import { Badge, Drawer, toast } from "./ui";
import { usePersist } from "./store";
import { go } from "./nav";

export type Quote = { vendor: string; unit: number; freight: number; lead: number; terms: string; warranty: string; validity: string };
export type Rfq = {
	no: string; item: string; qty: number; needBy: string; vendors: string[]; quotes: Quote[];
	status: "Waiting for quotes" | "Quotes received" | "Pending approval" | "Approved" | "PO raised" | "Sent back";
	chosen?: string; reason?: string; po?: string; created: string;
};

const vendorPool = [...vendors.map((v) => v.name), "Sparkline Connectors Pvt Ltd", "Unicon Wire Systems", "Kirana Embedded Systems"];
const rating: Record<string, number> = Object.fromEntries([...vendors.map((v) => [v.name, v.rating] as const), ["Sparkline Connectors Pvt Ltd", 4.2], ["Unicon Wire Systems", 3.9], ["Kirana Embedded Systems", 3.7]]);

const seed: Rfq[] = [
	{
		no: "RFQ-0415", item: "Waterproof connector 6-pin", qty: 5000, needBy: "25 Oct 2026", created: "06 Oct 2026",
		vendors: ["Sparkline Connectors Pvt Ltd", "Unicon Wire Systems", "NexBoard Electronics", "Lumio Auto Electricals"],
		quotes: [
			{ vendor: "Sparkline Connectors Pvt Ltd", unit: 48, freight: 6500, lead: 10, terms: "45 days", warranty: "12 months", validity: "30 days" },
			{ vendor: "Unicon Wire Systems", unit: 44, freight: 9000, lead: 18, terms: "30 days", warranty: "12 months", validity: "15 days" },
			{ vendor: "NexBoard Electronics", unit: 51, freight: 0, lead: 7, terms: "45 days", warranty: "24 months", validity: "30 days" },
			{ vendor: "Lumio Auto Electricals", unit: 49, freight: 4000, lead: 12, terms: "30 days", warranty: "12 months", validity: "30 days" },
		],
		status: "Quotes received",
	},
	{
		no: "RFQ-0416", item: "BMS board v4", qty: 800, needBy: "20 Oct 2026", created: "07 Oct 2026",
		vendors: ["NexBoard Electronics", "Voltcell Energy Pvt Ltd", "Kirana Embedded Systems"],
		quotes: [{ vendor: "NexBoard Electronics", unit: 2860, freight: 0, lead: 12, terms: "45 days", warranty: "24 months", validity: "30 days" }],
		status: "Waiting for quotes",
	},
];

export function useRfqs() { return usePersist<Rfq[]>("rfqs", seed); }
export function useExtraPOs() { return usePersist<PO[]>("extraPOs", []); }

/** Landed cost and a weighted score: price 50, lead time 20, vendor rating 20, payment terms 10. */
function evaluate(r: Rfq) {
	const rows = r.quotes.map((q) => {
		const base = q.unit * r.qty;
		const gst = Math.round(base * 0.18);
		return { ...q, base, gst, landed: base + gst + q.freight, rating: rating[q.vendor] ?? 4 };
	});
	if (!rows.length) return [];
	const minLanded = Math.min(...rows.map((x) => x.landed));
	const minLead = Math.min(...rows.map((x) => x.lead));
	return rows.map((x) => {
		const termDays = parseInt(x.terms, 10) || 0;
		const score = Math.round(50 * (minLanded / x.landed) + 20 * (minLead / x.lead) + 20 * (x.rating / 5) + 10 * Math.min(1, termDays / 45));
		return { ...x, score };
	});
}

const steps = ["RFQ sent", "Quotes received", "Vendor selected", "Approved", "PO raised"] as const;
function stepIndex(s: Rfq["status"]) {
	return s === "Waiting for quotes" ? 0 : s === "Quotes received" || s === "Sent back" ? 1 : s === "Pending approval" ? 2 : s === "Approved" ? 3 : 4;
}

export function QuotationComparison() {
	const [rfqs, setRfqs] = useRfqs();
	const [, setApprovals] = usePersist<Approval[]>("approvals", approvals);
	const [, setPOs] = useExtraPOs();
	const [selNo, setSelNo] = useState(seed[0].no);
	const [newOpen, setNewOpen] = useState(false);
	const [picking, setPicking] = useState<string | null>(null);
	const [reason, setReason] = useState("");
	const r = rfqs.find((x) => x.no === selNo) ?? rfqs[0];
	const evals = useMemo(() => (r ? evaluate(r) : []), [r]);
	const best = evals.length ? evals.reduce((a, b) => (b.score > a.score ? b : a)) : null;
	const lowest = evals.length ? evals.reduce((a, b) => (b.landed < a.landed ? b : a)) : null;
	const fastest = evals.length ? evals.reduce((a, b) => (b.lead < a.lead ? b : a)) : null;
	const update = (no: string, patch: Partial<Rfq>) => setRfqs((l) => l.map((x) => (x.no === no ? { ...x, ...patch } : x)));

	const receiveQuotes = () => {
		if (!r) return;
		const have = new Set(r.quotes.map((q) => q.vendor));
		const base = r.quotes[0]?.unit ?? 100;
		const fresh: Quote[] = r.vendors.filter((v) => !have.has(v)).map((v, i) => ({
			vendor: v, unit: Math.round(base * (0.93 + ((v.length * 7 + i * 13) % 17) / 100)), freight: [0, 3500, 6000, 8000][(v.length + i) % 4],
			lead: 7 + ((v.length * 3 + i * 5) % 14), terms: ["30 days", "45 days", "60 days"][(v.length + i) % 3], warranty: ["12 months", "18 months", "24 months"][(v.length + 2 * i) % 3], validity: "30 days",
		}));
		update(r.no, { quotes: [...r.quotes, ...fresh], status: "Quotes received" });
		toast(`${fresh.length} more quote${fresh.length === 1 ? "" : "s"} received for ${r.no} — all ${r.vendors.length} vendors have replied`);
	};
	const sendForApproval = (vendor: string) => {
		if (!r) return;
		if (!reason.trim()) { toast("Add a short reason for choosing this vendor"); return; }
		const ev = evals.find((x) => x.vendor === vendor)!;
		update(r.no, { status: "Pending approval", chosen: vendor, reason });
		setApprovals((l) => [{ id: r.no, type: "Vendor selection", title: `${vendor} for ${r.qty.toLocaleString("en-IN")} × ${r.item} — landed ${inr(ev.landed)}`, by: "SCM team", value: ev.landed, age: "just now", step: ev.landed > 500000 ? "SCM head, then finance" : "SCM head" }, ...l.filter((a) => a.id !== r.no)]);
		setPicking(null); setReason("");
		toast(`${vendor} selected for ${r.no} — sent to the SCM head for approval`);
	};
	const raisePO = () => {
		if (!r || !r.chosen) return;
		const ev = evals.find((x) => x.vendor === r.chosen)!;
		const no = `PO-26-${4140 + Math.floor(Math.random() * 50)}`;
		setPOs((l) => [{ no, vendor: r.chosen!, items: r.item, value: ev.landed, date: "08 Oct 2026", due: r.needBy, status: "Approved", received: 0 }, ...l]);
		update(r.no, { status: "PO raised", po: no });
		toast(`${no} raised to ${r.chosen} and emailed — ${inr(ev.landed)}`);
	};

	return (
		<div className="rfq">
			<div className="rfq-list">
				<div className="row-btns spread"><h3 className="mini">Requests for quotation</h3><button className="btn sm" onClick={() => setNewOpen(true)}>New RFQ</button></div>
				{rfqs.map((x) => (
					<button key={x.no} className={`rfq-card ${x.no === r?.no ? "on" : ""}`} onClick={() => { setSelNo(x.no); setPicking(null); }}>
						<b>{x.item}</b>
						<small>{x.no} · {x.qty.toLocaleString("en-IN")} units · need by {x.needBy}</small>
						<span className="rfq-meta"><Badge>{x.status}</Badge><small>{x.quotes.length}/{x.vendors.length} quotes</small></span>
					</button>
				))}
			</div>
			{r && (
				<div className="rfq-detail">
					<div className="rfq-head">
						<div><h3>{r.item} × {r.qty.toLocaleString("en-IN")}</h3><small>{r.no} · created {r.created} · sent to {r.vendors.length} vendors · need by {r.needBy}</small></div>
						{r.status === "Waiting for quotes" && <button className="btn ghost sm" onClick={receiveQuotes}>Receive vendor quotes</button>}
					</div>
					<ol className="rfq-steps">
						{steps.map((s, i) => <li key={s} className={i < stepIndex(r.status) ? "done" : i === stepIndex(r.status) ? "now" : ""}>{s}</li>)}
					</ol>
					{r.status === "Sent back" && <p className="form-err">The approver sent this selection back. Pick a vendor again with a clearer reason.</p>}
					{evals.length > 0 ? (
						<div className="table-wrap">
							<table className="cmp">
								<thead>
									<tr><th>Compare</th>{evals.map((q) => <th key={q.vendor} className={q.vendor === r.chosen ? "chosen" : ""}>{q.vendor}{best?.vendor === q.vendor && <><br /><Badge tone="good">Recommended</Badge></>}</th>)}</tr>
								</thead>
								<tbody>
									<tr><td>Unit price</td>{evals.map((q) => <td key={q.vendor} className="num">{inr(q.unit)}</td>)}</tr>
									<tr><td>Material value</td>{evals.map((q) => <td key={q.vendor} className="num">{inr(q.base)}</td>)}</tr>
									<tr><td>GST 18%</td>{evals.map((q) => <td key={q.vendor} className="num">{inr(q.gst)}</td>)}</tr>
									<tr><td>Freight</td>{evals.map((q) => <td key={q.vendor} className="num">{q.freight ? inr(q.freight) : "Included"}</td>)}</tr>
									<tr className="strong"><td>Landed cost</td>{evals.map((q) => <td key={q.vendor} className="num">{inr(q.landed)}{lowest?.vendor === q.vendor && <small className="pos"> lowest</small>}</td>)}</tr>
									<tr><td>Lead time</td>{evals.map((q) => <td key={q.vendor} className="num">{q.lead} days{fastest?.vendor === q.vendor && <small className="pos"> fastest</small>}</td>)}</tr>
									<tr><td>Payment terms</td>{evals.map((q) => <td key={q.vendor} className="num">{q.terms}</td>)}</tr>
									<tr><td>Warranty</td>{evals.map((q) => <td key={q.vendor} className="num">{q.warranty}</td>)}</tr>
									<tr><td>Vendor rating</td>{evals.map((q) => <td key={q.vendor} className="num">{q.rating.toFixed(1)} / 5</td>)}</tr>
									<tr className="strong"><td>Score out of 100</td>{evals.map((q) => <td key={q.vendor} className="num">{q.score}</td>)}</tr>
									{(r.status === "Quotes received" || r.status === "Sent back") && (
										<tr><td></td>{evals.map((q) => <td key={q.vendor} className="num"><button className={`btn sm ${best?.vendor === q.vendor ? "" : "ghost"}`} onClick={() => { setPicking(q.vendor); setReason(best?.vendor === q.vendor ? "Best overall score: price, delivery and rating" : ""); }}>Select</button></td>)}</tr>
									)}
								</tbody>
							</table>
						</div>
					) : <p className="empty">No quotes yet. Vendors have been emailed the RFQ.</p>}
					{r.status === "Waiting for quotes" && <p className="hint">{r.quotes.length} of {r.vendors.length} vendors have replied. Waiting on {r.vendors.filter((v) => !r.quotes.some((q) => q.vendor === v)).join(", ")}.</p>}
					{picking && (
						<div className="pick-box">
							<b>Select {picking} for {r.no}</b>
							<label htmlFor="pick-reason"><span>Reason for this choice (goes to the approver)</span>
								<input id="pick-reason" className="search" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Lowest landed cost and 10-day delivery" />
							</label>
							<div className="row-btns"><button className="btn ghost sm" onClick={() => setPicking(null)}>Cancel</button><button className="btn sm" onClick={() => sendForApproval(picking)}>Send for approval</button></div>
						</div>
					)}
					{r.status === "Pending approval" && (
						<div className="pick-box"><b>{r.chosen} selected</b><small>Reason: {r.reason}</small><small>Waiting for the SCM head to approve.</small>
							<div className="row-btns"><button className="btn sm ghost" onClick={() => go("approvals")}>Open Approvals</button></div></div>
					)}
					{r.status === "Approved" && (
						<div className="pick-box"><b>{r.chosen} approved</b><small>Reason: {r.reason}</small>
							<div className="row-btns"><button className="btn sm" onClick={raisePO}>Raise purchase order</button></div></div>
					)}
					{r.status === "PO raised" && (
						<div className="pick-box"><b>{r.po} raised to {r.chosen}</b><small>Emailed to the vendor. Track it in Purchase orders.</small></div>
					)}
				</div>
			)}
			<NewRfq open={newOpen} onClose={() => setNewOpen(false)} onCreate={(x) => { setRfqs((l) => [x, ...l]); setSelNo(x.no); }} count={rfqs.length} />
		</div>
	);
}

function NewRfq({ open, onClose, onCreate, count }: { open: boolean; onClose: () => void; onCreate: (r: Rfq) => void; count: number }) {
	const [item, setItem] = useState("Waterproof connector 4-pin");
	const [qty, setQty] = useState("3000");
	const [needBy, setNeedBy] = useState("2026-10-30");
	const [picked, setPicked] = useState<string[]>(["Sparkline Connectors Pvt Ltd", "Unicon Wire Systems", "NexBoard Electronics"]);
	const [err, setErr] = useState<string | null>(null);
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!item.trim() || !(Number(qty) > 0)) { setErr("Add the item and a quantity above zero."); return; }
		if (picked.length < 2) { setErr("Pick at least two vendors so their quotes can be compared."); return; }
		const d = new Date(needBy);
		const no = `RFQ-0${417 + count - 2}`;
		const first: Quote = { vendor: picked[0], unit: 39, freight: 4500, lead: 9, terms: "45 days", warranty: "12 months", validity: "30 days" };
		onCreate({ no, item: item.trim(), qty: Number(qty), needBy: isNaN(d.getTime()) ? needBy : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), vendors: picked, quotes: [first], status: "Waiting for quotes", created: "08 Oct 2026" });
		setErr(null); onClose();
		toast(`${no} emailed to ${picked.length} vendors — first quote already in`);
	};
	return (
		<Drawer open={open} onClose={onClose} title="New request for quotation" sub="Send one RFQ to several vendors and compare what comes back">
			<form className="rec-form" onSubmit={submit} noValidate>
				<label htmlFor="rq-item"><span>Item</span>
					<input id="rq-item" className="search" list="rq-items" value={item} onChange={(e) => setItem(e.target.value)} />
					<datalist id="rq-items">{items.map((i) => <option key={i.code} value={i.name} />)}</datalist>
				</label>
				<div className="form-row">
					<label htmlFor="rq-qty"><span>Quantity</span><input id="rq-qty" className="search" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
					<label htmlFor="rq-need"><span>Needed by</span><input id="rq-need" className="search" type="date" value={needBy} onChange={(e) => setNeedBy(e.target.value)} /></label>
				</div>
				<fieldset className="vendor-pick">
					<legend>Send to vendors ({picked.length} picked)</legend>
					{vendorPool.map((v) => (
						<label key={v}><input type="checkbox" checked={picked.includes(v)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, v] : p.filter((x) => x !== v)))} /> {v}<small>{(rating[v] ?? 4).toFixed(1)} / 5</small></label>
					))}
				</fieldset>
				{err && <p className="form-err" role="alert">{err}</p>}
				<div className="row-btns">
					<button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
					<button type="submit" className="btn">Send RFQ to vendors</button>
				</div>
			</form>
		</Drawer>
	);
}
