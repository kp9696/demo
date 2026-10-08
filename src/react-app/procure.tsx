import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { purchaseOrders, requisitions, vendors, items, approvals, inr, lakh, crore, sum } from "./data";
import type { Approval } from "./data";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, HBars, Bar, Tabs, Drawer, Facts, Timeline, toast } from "./ui";
import { GoodsReceipt } from "./pagesExtra";
import { QuotationComparison, useExtraPOs, useRfqs } from "./rfq";
import type { Rfq } from "./rfq";
import { usePersist, useOpenParam } from "./store";

// ---------- shared state ----------
export type PR = { no: string; item: string; qty: number; need: string; by: string; reason: string; source: "Manual" | "MRP" | "Reorder"; status: string; link?: string };
type PoState = { status?: string; received?: number; lr?: string; eta?: string; history?: { when: string; what: string }[] };

export function usePRs() {
	return usePersist<PR[]>("prs", requisitions.map((r) => ({ ...r, reason: r.no === "PR-1882" ? "Cells for next week's production plan" : "Below reorder level", source: r.no === "PR-1882" ? "MRP" : "Reorder", link: r.no === "PR-1879" ? "RFQ-0416" : r.no === "PR-1876" ? "PO-26-4125" : undefined })));
}
const poSeed: Record<string, PoState> = {
	"PO-26-4123": { status: "Dispatched", lr: "LR 55210", eta: "06 Oct 2026", history: [{ when: "02 Oct", what: "Vendor dispatched — LR 55210, ETA 06 Oct 2026" }] },
	"PO-26-4130": { status: "Dispatched", lr: "ASN 9921", eta: "11 Oct 2026", history: [{ when: "07 Oct", what: "Vendor dispatched — ASN 9921, ETA 11 Oct 2026" }] },
};
export function usePoState() { return usePersist<Record<string, PoState>>("poState", poSeed); }
function useApprovals() { return usePersist<Approval[]>("approvals", approvals); }

const TODAY = new Date("2026-10-08");
const parseDay = (s: string) => { const d = new Date(s.includes("2026") ? s : `${s} 2026`); return isNaN(d.getTime()) ? null : d; };
const unitCost = (name: string) => items.find((i) => i.name === name)?.unitCost ?? 1000;
const poSteps = ["Pending approval", "Approved", "Confirmed by vendor", "Dispatched", "Partially received", "Received", "Closed"] as const;

export function useAllPOs() {
	const [extra] = useExtraPOs();
	const [st] = usePoState();
	return useMemo(() => [...extra, ...purchaseOrders].map((p) => {
		const s = st[p.no] ?? {};
		const status = s.status ?? (p.status === "Inspected" ? "Received" : p.status === "Draft" ? "Pending approval" : p.status);
		return { ...p, status, received: s.received ?? p.received, lr: s.lr, eta: s.eta, history: s.history ?? [] };
	}), [extra, st]);
}
type FullPO = ReturnType<typeof useAllPOs>[number];

// ---------- page ----------
const tabs = ["Requisitions", "Quotation comparison", "Purchase orders", "Deliveries", "Goods receipt & inspection", "Vendors", "Reports"] as const;
type Tab = (typeof tabs)[number];

export function Procurement() {
	const pos = useAllPOs();
	const [prs] = usePRs();
	const [tab, setTab] = useState<Tab>("Requisitions");
	const [prForm, setPrForm] = useState(false);
	const [poForm, setPoForm] = useState<Partial<{ item: string; qty: number; pr: string }> | null>(null);
	const [poSel, setPoSel] = useState<string | null>(null);
	const open = useOpenParam();
	useEffect(() => { if (open.id && pos.some((p) => p.no === open.id)) { setTab("Purchase orders"); setPoSel(open.id); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
	const openPOs = pos.filter((p) => !["Received", "Closed", "Cancelled"].includes(p.status));
	const late = openPOs.filter((p) => (parseDay(p.eta ?? p.due) ?? TODAY) < TODAY || (p.status !== "Dispatched" && (parseDay(p.due) ?? TODAY) <= new Date("2026-10-10")));
	return (
		<Page title="Procurement" sub="From requisition to goods receipt, inspection and a closed purchase order"
			actions={<><button className="btn ghost" onClick={() => setPoForm({})}>New PO</button><button className="btn" onClick={() => setPrForm(true)}>New requisition</button></>}>
			<Stats>
				<Stat label="Requisitions to approve" value={String(prs.filter((p) => p.status === "Pending approval").length)} delta="Plant head, then finance by value" tone="warn" onClick={() => setTab("Requisitions")} />
				<Stat label="Open purchase orders" value={String(openPOs.length)} delta={lakh(sum(openPOs.map((p) => p.value * (1 - p.received / 100)))) + " still to receive"} onClick={() => setTab("Purchase orders")} />
				<Stat label="Deliveries at risk" value={String(late.length)} delta="Due within 2 days, not dispatched" tone={late.length ? "bad" : "good"} onClick={() => setTab("Deliveries")} />
				<Stat label="Spend this month" value={crore(sum(vendors.map((v) => v.spend)))} delta="12% under budget" tone="good" onClick={() => setTab("Reports")} />
			</Stats>
			<Panel right={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
				{tab === "Requisitions" && <Requisitions onPO={(p) => setPoForm(p)} onRfq={() => setTab("Quotation comparison")} />}
				{tab === "Quotation comparison" && <QuotationComparison />}
				{tab === "Purchase orders" && <POList pos={pos} onOpen={setPoSel} />}
				{tab === "Deliveries" && <Deliveries pos={openPOs} onOpen={setPoSel} />}
				{tab === "Goods receipt & inspection" && <GoodsReceipt />}
				{tab === "Vendors" && <Vendors pos={pos} />}
				{tab === "Reports" && <PurchaseReports pos={pos} />}
			</Panel>
			<PRForm open={prForm} onClose={() => setPrForm(false)} onDone={() => setTab("Requisitions")} />
			<POForm init={poForm} onClose={() => setPoForm(null)} onDone={() => setTab("Purchase orders")} />
			<Drawer open={!!poSel} onClose={() => setPoSel(null)} title={poSel ?? ""} sub={pos.find((p) => p.no === poSel)?.vendor}>
				{poSel && pos.find((p) => p.no === poSel) && <PODetail po={pos.find((p) => p.no === poSel)!} />}
			</Drawer>
		</Page>
	);
}

// ---------- requisitions ----------
function Requisitions({ onPO, onRfq }: { onPO: (p: { item: string; qty: number; pr: string }) => void; onRfq: () => void }) {
	const [prs, setPrs] = usePRs();
	const [rfqs, setRfqs] = useRfqs();
	const status = (p: PR) => {
		if (p.link?.startsWith("RFQ")) { const r = rfqs.find((x) => x.no === p.link); return r?.status === "PO raised" ? `PO raised (${r.po})` : `RFQ sent · ${r?.status ?? ""}`; }
		if (p.link?.startsWith("PO")) return `PO raised (${p.link})`;
		return p.status;
	};
	const sendRfq = (p: PR) => {
		const no = `RFQ-0${430 + rfqs.length}`;
		const vs = vendors.slice(0, 3).map((v) => v.name);
		const r: Rfq = { no, item: p.item, qty: p.qty, needBy: p.need, vendors: vs, quotes: [{ vendor: vs[0], unit: unitCost(p.item), freight: 5000, lead: 10, terms: "45 days", warranty: "12 months", validity: "30 days" }], status: "Waiting for quotes", created: "08 Oct 2026" };
		setRfqs((l) => [r, ...l]);
		setPrs((l) => l.map((x) => (x.no === p.no ? { ...x, status: "RFQ sent", link: no } : x)));
		toast(`${no} sent to ${vs.length} vendors for ${p.no}`);
		onRfq();
	};
	return (
		<>
			<p className="hint">Requisitions come from stores, planners and MRP. Once approved, send an RFQ to compare vendors, or raise a PO straight to a rate-contract vendor.</p>
			<Table cols={[
				{ key: "no", label: "Requisition" }, { key: "item", label: "Item" },
				{ key: "qty", label: "Qty", num: true, render: (r: PR) => r.qty.toLocaleString("en-IN") },
				{ key: "v", label: "Est. value", num: true, hideSm: true, render: (r: PR) => lakh(r.qty * unitCost(r.item)) },
				{ key: "by", label: "Raised by", hideSm: true, render: (r: PR) => <>{r.by}<small className="sub"> · {r.source}</small></> },
				{ key: "need", label: "Needed by", hideSm: true },
				{ key: "status", label: "Status", render: (r: PR) => <Badge tone={r.status === "Pending approval" ? "warn" : r.status === "Rejected" ? "bad" : r.status === "Approved" ? "info" : "good"}>{status(r)}</Badge> },
				{ key: "a", label: "", render: (r: PR) => r.status === "Approved" && !r.link ? (
					<span className="rw-btns"><button className="btn sm" onClick={() => sendRfq(r)}>Send RFQ</button><button className="btn sm ghost" onClick={() => onPO({ item: r.item, qty: r.qty, pr: r.no })}>Raise PO</button></span>
				) : r.status === "Pending approval" ? <small className="sub">In Approvals</small> : null },
			]} rows={prs} />
		</>
	);
}

function PRForm({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
	const [prs, setPrs] = usePRs();
	const [, setApprovals] = useApprovals();
	const [item, setItem] = useState(items[0].name);
	const [qty, setQty] = useState("500");
	const [need, setNeed] = useState("2026-10-20");
	const [reason, setReason] = useState("");
	const [err, setErr] = useState<string | null>(null);
	const value = Number(qty) * unitCost(item);
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!(Number(qty) > 0) || !reason.trim()) { setErr("Enter a quantity and say why it is needed."); return; }
		const no = `PR-${1884 + prs.length - 4}`;
		const d = new Date(need);
		const needStr = isNaN(d.getTime()) ? need : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
		setPrs((l) => [{ no, item, qty: Number(qty), need: needStr, by: "Demo User", reason: reason.trim(), source: "Manual", status: "Pending approval" }, ...l]);
		setApprovals((l) => [{ id: no, type: "Purchase requisition", title: `${Number(qty).toLocaleString("en-IN")} × ${item}`, by: "Demo User", value, age: "just now", step: value > 500000 ? "Plant head, then finance" : "Plant head" }, ...l]);
		setErr(null); setReason(""); onClose(); onDone();
		toast(`${no} sent for approval — estimated ${lakh(value)}`);
	};
	return (
		<Drawer open={open} onClose={onClose} title="New purchase requisition" sub="Ask purchase to buy an item">
			<form className="rec-form" onSubmit={submit} noValidate>
				<label htmlFor="pr-i"><span>Item</span><select id="pr-i" value={item} onChange={(e) => setItem(e.target.value)}>{items.map((i) => <option key={i.code} value={i.name}>{i.name} · {i.onHand.toLocaleString("en-IN")} in stock</option>)}</select></label>
				<div className="form-row">
					<label htmlFor="pr-q"><span>Quantity</span><input id="pr-q" className="search" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
					<label htmlFor="pr-n"><span>Needed by</span><input id="pr-n" className="search" type="date" value={need} onChange={(e) => setNeed(e.target.value)} /></label>
				</div>
				<label htmlFor="pr-r"><span>Why it is needed</span><input id="pr-r" className="search" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Below reorder level; WO-7734 blocked" /></label>
				<p className="hint">Estimated value {inr(value)} at last purchase price. {value > 500000 ? "Above ₹5 L: plant head, then finance approve." : "Up to ₹5 L: plant head approves."}</p>
				{err && <p className="form-err" role="alert">{err}</p>}
				<div className="row-btns"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn">Send for approval</button></div>
			</form>
		</Drawer>
	);
}

// ---------- direct PO ----------
function POForm({ init, onClose, onDone }: { init: Partial<{ item: string; qty: number; pr: string }> | null; onClose: () => void; onDone: () => void }) {
	const [extra, setExtra] = useExtraPOs();
	const [, setSt] = usePoState();
	const [, setPrs] = usePRs();
	const [, setApprovals] = useApprovals();
	const [vendor, setVendor] = useState(vendors[0].name);
	const [item, setItem] = useState<string>("");
	const [qty, setQty] = useState("");
	const [rate, setRate] = useState("");
	const [due, setDue] = useState("2026-10-22");
	const it = item || init?.item || items[0].name;
	const q = qty || String(init?.qty ?? 100);
	const r = rate || String(unitCost(it));
	const base = Number(q) * Number(r), gst = Math.round(base * 0.18), total = base + gst;
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!(Number(q) > 0) || !(Number(r) > 0)) { toast("Enter quantity and rate above zero"); return; }
		const no = `PO-26-${4200 + extra.length}`;
		const d = new Date(due);
		const needsApproval = total > 500000;
		setExtra((l) => [{ no, vendor, items: it, value: total, date: "08 Oct 2026", due: isNaN(d.getTime()) ? due : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), status: needsApproval ? "Pending approval" : "Approved", received: 0 }, ...l]);
		setSt((s) => ({ ...s, [no]: { status: needsApproval ? "Pending approval" : "Approved", history: [{ when: "Just now", what: needsApproval ? "Created and sent for approval" : "Created and approved (within limit), emailed to vendor" }] } }));
		if (needsApproval) setApprovals((l) => [{ id: no, type: "Purchase order", title: `${vendor} — ${Number(q).toLocaleString("en-IN")} × ${it}`, by: "Demo User", value: total, age: "just now", step: total > 5000000 ? "Finance, then director" : "Finance" }, ...l]);
		if (init?.pr) setPrs((l) => l.map((x) => (x.no === init.pr ? { ...x, status: "PO raised", link: no } : x)));
		setItem(""); setQty(""); setRate(""); onClose(); onDone();
		toast(needsApproval ? `${no} for ${inr(total)} sent for approval` : `${no} approved and emailed to ${vendor}`);
	};
	return (
		<Drawer open={!!init} onClose={onClose} title="New purchase order" sub={init?.pr ? `From requisition ${init.pr}` : "Direct PO to a rate-contract vendor"}>
			<form className="rec-form" onSubmit={submit} noValidate>
				<label htmlFor="po-v"><span>Vendor</span><select id="po-v" value={vendor} onChange={(e) => setVendor(e.target.value)}>{vendors.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.category} · {v.rating}/5</option>)}</select></label>
				<label htmlFor="po-i"><span>Item</span><select id="po-i" value={it} onChange={(e) => { setItem(e.target.value); setRate(""); }}>{items.map((i) => <option key={i.code} value={i.name}>{i.name}</option>)}</select></label>
				<div className="form-row">
					<label htmlFor="po-q"><span>Quantity</span><input id="po-q" className="search" type="number" min="1" value={q} onChange={(e) => setQty(e.target.value)} /></label>
					<label htmlFor="po-r"><span>Rate (₹)</span><input id="po-r" className="search" type="number" min="1" value={r} onChange={(e) => setRate(e.target.value)} /></label>
				</div>
				<label htmlFor="po-d"><span>Delivery date</span><input id="po-d" className="search" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
				<Facts rows={[["Material value", inr(base)], ["GST 18%", inr(gst)], ["PO total", <b>{inr(total)}</b>], ["Approval", total > 500000 ? "Needs finance approval" : "Within limit — approved on save"]]} />
				<div className="row-btns"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn">Create PO</button></div>
			</form>
		</Drawer>
	);
}

// ---------- PO list and detail ----------
function POList({ pos, onOpen }: { pos: FullPO[]; onOpen: (no: string) => void }) {
	const [f, setF] = useState("All");
	const shown = pos.filter((p) => f === "All" || p.status === f);
	return (
		<>
			<div className="filters" style={{ marginBottom: 12 }}>
				<select aria-label="Status" value={f} onChange={(e) => setF(e.target.value)}><option>All</option>{poSteps.map((s) => <option key={s}>{s}</option>)}<option>Cancelled</option></select>
				<span className="hint" style={{ margin: 0 }}>{shown.length} purchase orders · click one to track it</span>
			</div>
			<Table cols={[
				{ key: "no", label: "PO" }, { key: "vendor", label: "Vendor" }, { key: "items", label: "Main item", hideSm: true },
				{ key: "value", label: "Value", num: true, render: (r: FullPO) => inr(r.value) },
				{ key: "due", label: "Due", hideSm: true },
				{ key: "received", label: "Received", hideSm: true, render: (r: FullPO) => <span className="inline-bar"><Bar pct={r.received} />{r.received}%</span> },
				{ key: "status", label: "Status", render: (r: FullPO) => <Badge>{r.status}</Badge> },
			]} rows={shown} onRow={(r) => onOpen(r.no)} />
		</>
	);
}

function PODetail({ po }: { po: FullPO }) {
	const [, setSt] = usePoState();
	const [lr, setLr] = useState("");
	const [eta, setEta] = useState("2026-10-12");
	const upd = (patch: PoState, what: string) => setSt((s) => ({ ...s, [po.no]: { ...s[po.no], ...patch, history: [{ when: "Just now", what }, ...(s[po.no]?.history ?? [])] } }));
	const idx = poSteps.indexOf(po.status as (typeof poSteps)[number]);
	const late = (parseDay(po.eta ?? po.due) ?? TODAY) < TODAY && po.received < 100;
	return (
		<>
			<ol className="rfq-steps po-steps">{poSteps.map((s, i) => <li key={s} className={i < idx ? "done" : i === idx ? "now" : ""}>{s}</li>)}</ol>
			<Facts rows={[
				["Status", <Badge>{po.status}</Badge>], ["Item", po.items], ["Value incl. GST", inr(po.value)], ["Ordered", po.date], ["Due", <>{po.due}{late && <> <Badge tone="bad">Late</Badge></>}</>],
				["Received", `${po.received}%`], ...(po.lr ? [["Dispatch", `${po.lr} · ETA ${po.eta}`] as [string, string]] : []),
			]} />
			{po.status === "Pending approval" && <p className="hint">Waiting in Approvals. Finance approves POs above ₹5 L.</p>}
			{po.status === "Approved" && <div className="row-btns"><button className="btn" onClick={() => { upd({ status: "Confirmed by vendor" }, "Vendor confirmed the order and delivery date"); toast(`${po.vendor} confirmed ${po.no}`); }}>Vendor confirmed</button><button className="btn ghost" onClick={() => toast(`Reminder emailed to ${po.vendor} to confirm ${po.no}`)}>Send reminder</button></div>}
			{(po.status === "Confirmed by vendor" || po.status === "Approved") && (
				<div className="pick-box">
					<b>Record vendor dispatch</b>
					<div className="form-row">
						<label htmlFor="pd-lr"><span>LR / ASN number</span><input id="pd-lr" className="search" value={lr} onChange={(e) => setLr(e.target.value)} placeholder="e.g. LR 55821 or ASN 9930" /></label>
						<label htmlFor="pd-eta"><span>Expected arrival</span><input id="pd-eta" className="search" type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></label>
					</div>
					<div className="row-btns"><button className="btn sm" onClick={() => {
						if (!lr.trim()) { toast("Enter the LR or ASN number from the vendor"); return; }
						const d = new Date(eta); const etaS = isNaN(d.getTime()) ? eta : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
						upd({ status: "Dispatched", lr: lr.trim(), eta: etaS }, `Vendor dispatched — ${lr.trim()}, ETA ${etaS}`); toast(`${po.no} marked dispatched; the gate will expect it on ${etaS}`);
					}}>Save dispatch</button></div>
				</div>
			)}
			{po.status === "Dispatched" && <p className="hint">On the way. When it reaches the gate, the RFID read creates the goods receipt; accepting it in Goods receipt & inspection updates this PO.</p>}
			{po.status === "Dispatched" && <div className="row-btns"><button className="btn ghost" onClick={() => { upd({ status: "Partially received", received: 60 }, "Partial goods receipt — 60% received and accepted"); toast(`${po.no}: 60% received`); }}>Record partial receipt</button><button className="btn" onClick={() => { upd({ status: "Received", received: 100 }, "Full goods receipt, inspection passed"); toast(`${po.no} fully received`); }}>Record full receipt</button></div>}
			{po.status === "Partially received" && <div className="row-btns"><button className="btn" onClick={() => { upd({ status: "Received", received: 100 }, "Balance received, inspection passed"); toast(`${po.no} fully received`); }}>Receive balance</button><button className="btn ghost" onClick={() => { upd({ status: "Closed" }, `Short-closed at ${po.received}% — balance cancelled`); toast(`${po.no} short-closed`); }}>Short-close</button></div>}
			{po.status === "Received" && <div className="row-btns"><button className="btn" onClick={() => { upd({ status: "Closed" }, "Invoice matched to PO and receipt (3-way match); PO closed"); toast(`${po.no} closed — invoice passed to accounts`); }}>Match invoice and close</button></div>}
			{!["Received", "Closed", "Cancelled", "Partially received", "Dispatched"].includes(po.status) && <button className="btn ghost sm" onClick={() => { upd({ status: "Cancelled" }, "PO cancelled"); toast(`${po.no} cancelled — vendor informed`); }}>Cancel PO</button>}
			<h3 className="mini">History</h3>
			<Timeline items={[...po.history, ...(po.received > 0 && !po.history.length ? [{ when: "04 Oct", what: "Goods receipt at Gate G1", where: "Hosur" }] : []), { when: po.date, what: "PO created and approved", detail: "Emailed to vendor" }]} />
		</>
	);
}

// ---------- deliveries ----------
function Deliveries({ pos, onOpen }: { pos: FullPO[]; onOpen: (no: string) => void }) {
	const rows = pos.filter((p) => p.status !== "Pending approval").map((p) => {
		const due = parseDay(p.eta ?? p.due) ?? TODAY;
		const days = Math.round((due.getTime() - TODAY.getTime()) / 86400000);
		const risk = days < 0 ? "Late" : days <= 2 && p.status !== "Dispatched" ? "At risk" : "On track";
		return { ...p, days, risk };
	}).sort((a, b) => a.days - b.days);
	return (
		<>
			<div className="mini-stats">
				<span><small>Expected this week</small><b>{rows.filter((r) => r.days >= 0 && r.days <= 7).length}</b></span>
				<span><small>Late</small><b className="neg">{rows.filter((r) => r.risk === "Late").length}</b></span>
				<span><small>At risk</small><b>{rows.filter((r) => r.risk === "At risk").length}</b></span>
				<span><small>On the way</small><b>{rows.filter((r) => r.status === "Dispatched").length}</b></span>
			</div>
			<Table cols={[
				{ key: "no", label: "PO" }, { key: "vendor", label: "Vendor" }, { key: "items", label: "Item", hideSm: true },
				{ key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
				{ key: "lr", label: "Dispatch", hideSm: true, render: (r) => r.lr ?? "—" },
				{ key: "days", label: "Due", render: (r) => <span className={r.days < 0 ? "neg" : ""}>{r.days < 0 ? `${-r.days} d late` : r.days === 0 ? "Today" : `in ${r.days} d`}</span> },
				{ key: "risk", label: "", render: (r) => <Badge tone={r.risk === "Late" ? "bad" : r.risk === "At risk" ? "warn" : "good"}>{r.risk}</Badge> },
				{ key: "a", label: "", render: (r) => (r.risk !== "On track" ? <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); toast(`Follow-up email and SMS sent to ${r.vendor} for ${r.no}`); }}>Follow up</button> : null) },
			]} rows={rows} onRow={(r) => onOpen(r.no)} />
		</>
	);
}

// ---------- vendors ----------
function Vendors({ pos }: { pos: FullPO[] }) {
	const [sel, setSel] = useState<string | null>(null);
	const v = vendors.find((x) => x.name === sel);
	const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
	const trend = (n: string, base: number) => months.map((_, i) => Math.min(100, Math.round(base - 4 + ((n.length * (i + 3)) % 9))));
	return (
		<>
			<Table cols={[
				{ key: "name", label: "Vendor" }, { key: "category", label: "Supplies", hideSm: true }, { key: "city", label: "City", hideSm: true },
				{ key: "otd", label: "On-time", num: true, render: (r) => <span className={r.otd < 90 ? "neg" : ""}>{r.otd}%</span> },
				{ key: "quality", label: "Quality", num: true, render: (r) => `${r.quality}%` },
				{ key: "spend", label: "Spend YTD", num: true, hideSm: true, render: (r) => crore(r.spend) },
				{ key: "open", label: "Open POs", num: true, render: (r) => pos.filter((p) => p.vendor === r.name && !["Received", "Closed", "Cancelled"].includes(p.status)).length },
				{ key: "rating", label: "Rating", num: true },
			]} rows={vendors} onRow={(r) => setSel(r.name)} />
			<Drawer open={!!v} onClose={() => setSel(null)} title={v?.name ?? ""} sub={v ? `${v.category} · ${v.city}` : ""}>
				{v && (
					<>
						<Facts rows={[["On-time delivery", `${v.otd}%`], ["Quality acceptance", `${v.quality}%`], ["Rating", `${v.rating} / 5`], ["Spend this year", crore(v.spend)], ["Payment terms", "45 days"], ["Rate contract", v.otd >= 90 ? "Active till Mar 2027" : "Under review"]]} />
						<h3 className="mini">On-time delivery, last 6 months</h3>
						<Chart labels={months} fmt={(n) => `${n}%`} series={[{ name: "On-time %", values: trend(v.name, v.otd), tone: v.otd < 90 ? "warn" : "accent" }]} height={180} />
						<h3 className="mini">Purchase orders</h3>
						<Table dense cols={[{ key: "no", label: "PO" }, { key: "items", label: "Item" }, { key: "value", label: "Value", num: true, render: (r: FullPO) => inr(r.value) }, { key: "status", label: "Status", render: (r: FullPO) => <Badge>{r.status}</Badge> }]} rows={pos.filter((p) => p.vendor === v.name)} />
					</>
				)}
			</Drawer>
		</>
	);
}

// ---------- reports ----------
function PurchaseReports({ pos }: { pos: FullPO[] }) {
	const byStatus = poSteps.map((s) => ({ label: s, value: pos.filter((p) => p.status === s).length }));
	const pendingValue = sum(pos.filter((p) => !["Received", "Closed", "Cancelled"].includes(p.status)).map((p) => p.value * (1 - p.received / 100)));
	const variance = items.slice(0, 8).map((i, k) => {
		const last = i.unitCost, avg = Math.round(i.unitCost * (1 + (((k * 7) % 11) - 5) / 100));
		return { item: i.name, avg, last, v: ((last - avg) / avg) * 100 };
	});
	return (
		<>
			<div className="row-btns spread">
				<p className="hint" style={{ margin: 0 }}>October 2026, all plants. Pending value still to be received: <b>{lakh(pendingValue)}</b></p>
				<span className="rw-btns"><button className="btn ghost sm" onClick={() => toast("Purchase reports exported to Excel")}>Excel</button><button className="btn ghost sm" onClick={() => toast("Purchase reports exported to PDF")}>PDF</button></span>
			</div>
			<div className="split">
				<div>
					<h3 className="mini">PO register by status</h3>
					<HBars rows={byStatus} tone="info" />
					<h3 className="mini" style={{ marginTop: 18 }}>Spend by vendor (YTD)</h3>
					<HBars rows={vendors.map((v) => ({ label: v.name, value: v.spend }))} fmt={(n) => crore(n)} />
				</div>
				<div>
					<h3 className="mini">Price variance: last price vs 6-month average</h3>
					<Table dense cols={[
						{ key: "item", label: "Item" }, { key: "avg", label: "Average", num: true, hideSm: true, render: (r) => inr(r.avg) },
						{ key: "last", label: "Last", num: true, render: (r) => inr(r.last) },
						{ key: "v", label: "Change", num: true, render: (r) => <span className={r.v > 0 ? "neg" : "pos"}>{r.v > 0 ? "+" : ""}{r.v.toFixed(1)}%</span> },
					]} rows={variance} />
				</div>
			</div>
		</>
	);
}
