import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { dealers, batteries, jobCards, warrantyClaims, complaints, pnl, inr, crore } from "./data";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, Tabs, Drawer, Facts, Timeline, Search, toast } from "./ui";
import { Appointments } from "./pagesExtra";
import { usePersist } from "./store";
import { useStock, itemByName, SERVICE } from "./stock";
import { useVehicles, useOverrides } from "./vehicles";
import type { V } from "./vehicles";

// ---------- types and seed data ----------
const stagesList = ["Diagnosis", "Awaiting parts", "Warranty approval", "In repair", "Ready for delivery", "Closed"] as const;
type Stage = (typeof stagesList)[number];
type PartLine = { part: string; qty: number; price: number; status: "Requested" | "Issued" };
type Job = {
	no: string; vin: string; reg: string; customer: string; dealer: string; type: string; complaint: string; tech: string;
	status: Stage; opened: string; warranty: boolean; notes: string[]; log: { when: string; what: string }[]; parts: PartLine[];
	labour: number; claim?: string; batteryIn?: string; batteryOut?: string; closedIn?: string;
};
type Claim = { no: string; job: string; part: string; dealer: string; amount: number; status: "Pending" | "Approved" | "Rejected" | "Under review" };
type Req = { no: string; channel: string; customer: string; reg: string; issue: string; dealer: string; status: "New" | "Job card opened" | "Appointment booked"; job?: string; when: string };
type Complaint = { no: string; customer: string; reg: string; category: string; text: string; dealer: string; owner: string; status: "Open" | "In progress" | "Closed"; reason?: string; opened: string };

const techs = ["Suresh K", "Amit P", "Farhan S", "Deepak R", "Lokesh M", "Naveen T"];
const jobTypes = ["Repair", "Periodic service", "Battery issue", "Accident repair", "Warranty repair"];
const serviceParts: { part: string; price: number; stock: number; min: number }[] = [
	{ part: "Brake pad set", price: 420, stock: 64, min: 30 }, { part: "Tyre 90/90-12 tubeless", price: 1280, stock: 22, min: 16 },
	{ part: "Headlamp LED unit", price: 1350, stock: 14, min: 10 }, { part: "Charger 48V 10A", price: 3400, stock: 9, min: 6 },
	{ part: "Motor controller 48V", price: 6800, stock: 5, min: 4 }, { part: "TFT cluster 5in", price: 4200, stock: 3, min: 4 },
	{ part: "Rear shock absorber", price: 1100, stock: 18, min: 8 }, { part: "Wiring harness main", price: 1750, stock: 7, min: 5 },
	{ part: "Throttle assembly", price: 950, stock: 11, min: 6 }, { part: "Harness connector kit", price: 260, stock: 40, min: 20 },
];
const priceOf = (p: string) => serviceParts.find((s) => s.part === p)?.price ?? 0;

function seedJobs(list: V[]): Job[] {
	return jobCards.map((j, i) => {
		const v = list.find((x) => x.vin.endsWith(j.vin.replace("…", ""))) ?? list[i];
		const stage = j.status as Stage;
		const parts: PartLine[] = stage === "Awaiting parts" ? [{ part: "Brake pad set", qty: 1, price: 420, status: "Requested" }]
			: stage === "In repair" ? [{ part: "TFT cluster 5in", qty: 1, price: 4200, status: "Issued" }]
			: stage === "Warranty approval" ? [{ part: "Rear shock absorber", qty: 1, price: 1100, status: "Issued" }] : [];
		return {
			no: j.no, vin: v.vin, reg: v.reg !== "—" ? v.reg : `KA-01-EV-${4400 + i}`, customer: j.customer, dealer: j.dealer, type: j.warranty ? "Warranty repair" : j.complaint.startsWith("Periodic") ? "Periodic service" : "Repair",
			complaint: j.complaint, tech: j.tech, status: stage, opened: j.age + " ago", warranty: j.warranty, parts, labour: j.complaint.startsWith("Periodic") ? 650 : 900,
			notes: stage === "Diagnosis" ? [] : ["Checked on arrival; fault confirmed"],
			log: [{ when: j.age + " ago", what: "Job card opened at " + j.dealer }],
			claim: j.no === "JC-31188" ? "WC-0929" : undefined, closedIn: stage === "Closed" ? "5.4 h" : undefined,
		};
	});
}
const now = () => "Just now";

// ---------- page ----------
const tabs = ["Job cards", "Service requests", "Appointments", "Warranty claims", "Complaints", "Customers", "Service stock", "Dealers"] as const;
type Tab = (typeof tabs)[number];

export function Service() {
	const list = useVehicles();
	const seed = useMemo(() => seedJobs(list), []); // eslint-disable-line react-hooks/exhaustive-deps
	const [jobs] = usePersist<Job[]>("svcJobs", seed);
	const [claims] = usePersist<Claim[]>("svcClaims", warrantyClaims.map((c) => ({ ...c, job: c.no === "WC-0929" ? "JC-31188" : c.no === "WC-0931" ? "JC-31199" : "—", status: c.status as Claim["status"] })));
	const [cmp] = usePersist<Complaint[]>("svcComplaints", complaintSeed);
	const [tab, setTab] = useState<Tab>("Job cards");
	const [newJob, setNewJob] = useState<Partial<Job> | null>(null);
	const open = jobs.filter((j) => j.status !== "Closed").length;
	return (
		<Page title="Dealers & service" sub="Service requests, job cards, parts, warranty and complaints across 5 dealers"
			actions={<button className="btn" onClick={() => setNewJob({})}>New job card</button>}>
			<Stats>
				<Stat label="Open job cards" value={String(open + 45)} delta={`${jobs.filter((j) => j.status === "Awaiting parts").length + 8} waiting for parts`} tone="warn" onClick={() => setTab("Job cards")} />
				<Stat label="Warranty claims pending" value={String(claims.filter((c) => c.status === "Pending" || c.status === "Under review").length)} delta={inr(claims.filter((c) => c.status !== "Approved" && c.status !== "Rejected").reduce((a, c) => a + c.amount, 0)) + " in review"} onClick={() => setTab("Warranty claims")} />
				<Stat label="Open complaints" value={String(cmp.filter((c) => c.status !== "Closed").length)} delta="Target: close within 48 h" tone="warn" onClick={() => setTab("Complaints")} />
				<Stat label="Service revenue (Sep)" value={crore(pnl.serviceRevenue[5] + pnl.sparesRevenue[5])} delta="Labour + spares" />
			</Stats>
			<Panel right={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
				{tab === "Job cards" && <JobBoard />}
				{tab === "Service requests" && <Requests onCreateJob={(p) => setNewJob(p)} onBook={() => setTab("Appointments")} />}
				{tab === "Appointments" && <Appointments />}
				{tab === "Warranty claims" && <Claims />}
				{tab === "Complaints" && <ComplaintsTab />}
				{tab === "Customers" && <Customers />}
				{tab === "Service stock" && <ServiceStock />}
				{tab === "Dealers" && <Dealers />}
			</Panel>
			<NewJob init={newJob} onClose={() => setNewJob(null)} onDone={() => setTab("Job cards")} />
		</Page>
	);
}

function useJobs() {
	const list = useVehicles();
	const seed = useMemo(() => seedJobs(list), []); // eslint-disable-line react-hooks/exhaustive-deps
	return usePersist<Job[]>("svcJobs", seed);
}
function useClaims() {
	return usePersist<Claim[]>("svcClaims", warrantyClaims.map((c) => ({ ...c, job: c.no === "WC-0929" ? "JC-31188" : c.no === "WC-0931" ? "JC-31199" : "—", status: c.status as Claim["status"] })));
}
function useStockUsed() { return usePersist<Record<string, number>>("svcStockUsed", {}); }

// ---------- job board ----------
function JobBoard() {
	const [jobs] = useJobs();
	const [sel, setSel] = useState<string | null>(null);
	const [tech, setTech] = useState("All technicians");
	const job = jobs.find((j) => j.no === sel) ?? null;
	const shown = jobs.filter((j) => tech === "All technicians" || j.tech === tech);
	return (
		<>
			<div className="row-btns spread">
				<p className="hint" style={{ margin: 0 }}>Click a job card to diagnose, request parts, claim warranty, replace a battery or close it.</p>
				<select aria-label="Technician" value={tech} onChange={(e) => setTech(e.target.value)}><option>All technicians</option>{techs.map((t) => <option key={t} value={t}>{t} · {jobs.filter((j) => j.tech === t && j.status !== "Closed").length} open</option>)}</select>
			</div>
			<div className="kanban">
				{stagesList.map((col) => (
					<div key={col} className="kan-col">
						<h3>{col}<span>{shown.filter((j) => j.status === col).length}</span></h3>
						{shown.filter((j) => j.status === col).map((j) => (
							<button key={j.no} className="kan-card kan-btn" onClick={() => setSel(j.no)}>
								<b>{j.complaint}</b>
								<small>{j.no} · {j.reg}</small>
								<small>{j.customer} · {j.dealer}</small>
								<footer><span>{j.tech}</span><span>{j.opened}</span>{j.warranty && <Badge tone="info">Warranty</Badge>}</footer>
							</button>
						))}
					</div>
				))}
			</div>
			<Drawer open={!!job} onClose={() => setSel(null)} title={job ? `${job.no} · ${job.complaint}` : ""} sub={job ? `${job.reg} · ${job.customer} · ${job.dealer}` : ""}>
				{job && <JobDetail job={job} />}
			</Drawer>
		</>
	);
}

function JobDetail({ job }: { job: Job }) {
	const [, setJobs] = useJobs();
	const [, setClaims] = useClaims();
	const [used, setUsed] = useStockUsed();
	const { post: postStock } = useStock();
	const [, setOv] = useOverrides();
	const vehiclesNow = useVehicles();
	const [note, setNote] = useState("");
	const [part, setPart] = useState(serviceParts[0].part);
	const [qty, setQty] = useState("1");
	const [pack, setPack] = useState("");
	const upd = (patch: Partial<Job>, what?: string) => setJobs((l) => l.map((j) => (j.no === job.no ? { ...j, ...patch, log: what ? [{ when: now(), what }, ...(patch.log ?? j.log)] : patch.log ?? j.log } : j)));
	const stockOf = (p: string) => (serviceParts.find((s) => s.part === p)?.stock ?? 0) - (used[p] ?? 0);
	const closed = job.status === "Closed";
	const pending = job.parts.some((p) => p.status === "Requested");
	const partsCost = job.parts.reduce((a, p) => a + p.price * p.qty, 0);
	const bill = job.warranty ? 0 : partsCost + job.labour;
	const veh = vehiclesNow.find((v) => v.vin === job.vin);
	const readyPacks = batteries.filter((b) => b.status === "Ready at station" && b.soh >= 90).slice(0, 6);

	const addNote = () => { if (!note.trim()) return; upd({ notes: [...job.notes, note.trim()], status: job.status === "Diagnosis" ? "In repair" : job.status }, `Diagnosis: ${note.trim()}`); setNote(""); toast("Diagnosis note saved"); };
	const requestPart = () => {
		const n = Number(qty); if (!(n > 0)) { toast("Enter a quantity above zero"); return; }
		upd({ parts: [...job.parts, { part, qty: n, price: priceOf(part), status: "Requested" }], status: "Awaiting parts" }, `Part requested: ${n} × ${part}`);
		toast(`${n} × ${part} requested from the service store`);
	};
	const issuePart = (i: number) => {
		const p = job.parts[i];
		if (stockOf(p.part) < p.qty) { toast(`Only ${stockOf(p.part)} × ${p.part} in the service store — reorder from Service stock`); return; }
		setUsed((u) => ({ ...u, [p.part]: (u[p.part] ?? 0) + p.qty }));
		const it = itemByName(p.part);
		if (it) postStock([{ type: "Issue to service", code: it.code, loc: SERVICE, qty: -p.qty, ref: job.no, by: job.tech, note: job.dealer }]);
		const parts = job.parts.map((x, k) => (k === i ? { ...x, status: "Issued" as const } : x));
		upd({ parts, status: parts.some((x) => x.status === "Requested") ? "Awaiting parts" : job.status === "Awaiting parts" ? "In repair" : job.status }, `Part issued: ${p.qty} × ${p.part}`);
		toast(`${p.qty} × ${p.part} issued to ${job.tech}`);
	};
	const raiseClaim = () => {
		const no = `WC-0${940 + Math.floor(Math.random() * 50)}`;
		const main = job.parts[0]?.part ?? "Labour only";
		setClaims((l) => [{ no, job: job.no, part: main, dealer: job.dealer, amount: partsCost + job.labour, status: "Pending" }, ...l]);
		upd({ claim: no, status: "Warranty approval" }, `Warranty claim ${no} raised for ${inr(partsCost + job.labour)}`);
		toast(`${no} sent to the service manager for approval`);
	};
	const replaceBattery = () => {
		if (!pack) { toast("Pick the replacement pack"); return; }
		const out = veh?.battery ?? "—";
		setOv((o) => ({ ...o, [job.vin]: { ...o[job.vin], battery: pack } }));
		upd({ batteryOut: out, batteryIn: pack }, `Battery replaced: ${out} out, ${pack} in`);
		toast(`Battery ${pack} fitted to ${job.reg}; ${out} sent to the battery lab`);
	};
	return (
		<>
			<ol className="rfq-steps">
				{stagesList.map((s, i) => <li key={s} className={i < stagesList.indexOf(job.status) ? "done" : s === job.status ? "now" : ""}>{s}</li>)}
			</ol>
			<Facts rows={[
				["Vehicle", `${job.reg} · ${veh?.model ?? ""}`], ["Customer", job.customer], ["Type", job.type],
				["Warranty", job.warranty ? <Badge tone="good">Covered</Badge> : <Badge tone="muted">Paid by customer</Badge>],
				["Technician", closed ? job.tech : <select aria-label="Technician" value={job.tech} onChange={(e) => { upd({ tech: e.target.value }, `Reassigned to ${e.target.value}`); toast(`Job moved to ${e.target.value}`); }}>{techs.map((t) => <option key={t}>{t}</option>)}</select>],
				["Opened", job.opened], ...(job.closedIn ? [["Turnaround", job.closedIn] as [string, string]] : []),
			]} />
			{!closed && (
				<div className="pick-box">
					<b>Diagnosis and repair notes</b>
					{job.notes.map((n, i) => <small key={i}>• {n}</small>)}
					<div className="inline-add"><input className="search" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cell imbalance 42 mV on pack; replace" /><button className="btn sm" onClick={addNote}>Add note</button></div>
				</div>
			)}
			<h3 className="mini">Spare parts</h3>
			{job.parts.length > 0 && (
				<Table dense cols={[
					{ key: "part", label: "Part" }, { key: "qty", label: "Qty", num: true },
					{ key: "price", label: "Price", num: true, render: (r: PartLine) => inr(r.price * r.qty) },
					{ key: "status", label: "Status", render: (r: PartLine) => <Badge tone={r.status === "Issued" ? "good" : "warn"}>{r.status}</Badge> },
					{ key: "a", label: "", render: (r: PartLine) => (r.status === "Requested" && !closed ? <button className="btn sm ghost" onClick={() => issuePart(job.parts.indexOf(r))}>Issue from store</button> : null) },
				]} rows={job.parts} />
			)}
			{!closed && (
				<div className="inline-add">
					<select aria-label="Part" value={part} onChange={(e) => setPart(e.target.value)}>{serviceParts.map((p) => <option key={p.part} value={p.part}>{p.part} · {stockOf(p.part)} in store</option>)}</select>
					<input className="qty-in" type="number" min="1" aria-label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
					<button className="btn sm ghost" onClick={requestPart}>Request part</button>
				</div>
			)}
			<h3 className="mini">Battery</h3>
			{job.batteryIn ? <p className="hint">Replaced on this job: {job.batteryOut} out, {job.batteryIn} in. Both battery records and the vehicle record are updated.</p>
				: closed ? <p className="hint">No battery change on this job.</p> : (
					<div className="inline-add">
						<span className="hint" style={{ margin: 0 }}>Fitted now: {veh?.battery ?? "—"}</span>
						<select aria-label="Replacement pack" value={pack} onChange={(e) => setPack(e.target.value)}><option value="">Pick a ready pack</option>{readyPacks.map((b) => <option key={b.id} value={b.id}>{b.id} · {b.soh}% health</option>)}</select>
						<button className="btn sm ghost" onClick={replaceBattery}>Replace battery</button>
					</div>
				)}
			<Facts rows={[["Parts", inr(partsCost)], ["Labour", inr(job.labour)], ["Customer pays", job.warranty ? "Nothing — warranty" : <b>{inr(bill)}</b>], ...(job.claim ? [["Warranty claim", job.claim] as [string, string]] : [])]} />
			{!closed && (
				<div className="row-btns">
					{job.warranty && !job.claim && <button className="btn ghost" onClick={raiseClaim}>Raise warranty claim</button>}
					{job.status !== "Ready for delivery" && <button className="btn ghost" disabled={pending || job.status === "Warranty approval"} onClick={() => { upd({ status: "Ready for delivery" }, "Repair done, road test passed"); toast(`${job.no} ready — customer notified by SMS`); }}>Mark ready for delivery</button>}
					{job.status === "Ready for delivery" && <button className="btn" onClick={() => { upd({ status: "Closed", closedIn: "6.1 h" }, `Handed over to ${job.customer}${bill ? `, paid ${inr(bill)}` : ""}`); toast(`${job.no} closed in 6.1 h`); }}>Close and hand over</button>}
				</div>
			)}
			{(pending || job.status === "Warranty approval") && !closed && <p className="hint">{pending ? "Issue the requested parts before marking the job ready." : "Waiting for the warranty claim decision in the Warranty claims tab."}</p>}
			<h3 className="mini">Activity</h3>
			<Timeline items={job.log} />
		</>
	);
}

function NewJob({ init, onClose, onDone }: { init: Partial<Job> | null; onClose: () => void; onDone: () => void }) {
	const list = useVehicles();
	const sold = list.filter((v) => v.status === "Sold" || v.status === "In service");
	const [jobs, setJobs] = useJobs();
	const [vin, setVin] = useState("");
	const [type, setType] = useState(jobTypes[0]);
	const [text, setText] = useState("");
	const [tech, setTech] = useState(techs[0]);
	const [err, setErr] = useState<string | null>(null);
	const v = sold.find((x) => x.vin === (vin || (init?.reg ? sold.find((s) => s.reg === init.reg)?.vin : "")));
	const complaintText = text || init?.complaint || "";
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!v) { setErr("Pick the customer's vehicle."); return; }
		if (!complaintText.trim()) { setErr("Describe the problem or the service needed."); return; }
		const no = `JC-${31210 + jobs.length}`;
		const warranty = type !== "Periodic service" && type !== "Accident repair";
		setJobs((l) => [{ no, vin: v.vin, reg: v.reg, customer: v.customer, dealer: v.dealer, type, complaint: complaintText.trim(), tech, status: "Diagnosis", opened: now(), warranty, notes: [], parts: [], labour: type === "Periodic service" ? 650 : 900, log: [{ when: now(), what: `Job card opened at ${v.dealer}` }] }, ...l]);
		(init as { onCreated?: (no: string) => void } | null)?.onCreated?.(no);
		setErr(null); setVin(""); setText(""); onClose(); onDone();
		toast(`${no} opened for ${v.reg} and assigned to ${tech}`);
	};
	return (
		<Drawer open={!!init} onClose={onClose} title="New job card" sub="Open a job for a customer's vehicle">
			<form className="rec-form" onSubmit={submit} noValidate>
				<label htmlFor="nj-v"><span>Vehicle</span>
					<select id="nj-v" value={v?.vin ?? ""} onChange={(e) => setVin(e.target.value)}><option value="">Pick by registration</option>{sold.map((s) => <option key={s.vin} value={s.vin}>{s.reg} · {s.model} · {s.customer}</option>)}</select>
				</label>
				{v && <p className="hint">{v.customer} · {v.dealer} · {v.odo.toLocaleString("en-IN")} km · battery {v.battery}</p>}
				<div className="form-row">
					<label htmlFor="nj-t"><span>Type</span><select id="nj-t" value={type} onChange={(e) => setType(e.target.value)}>{jobTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
					<label htmlFor="nj-te"><span>Technician</span><select id="nj-te" value={tech} onChange={(e) => setTech(e.target.value)}>{techs.map((t) => <option key={t}>{t}</option>)}</select></label>
				</div>
				<label htmlFor="nj-c"><span>Problem or service needed</span><input id="nj-c" className="search" value={complaintText} onChange={(e) => setText(e.target.value)} placeholder="e.g. Brake noise from the front" /></label>
				{err && <p className="form-err" role="alert">{err}</p>}
				<div className="row-btns"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn">Open job card</button></div>
			</form>
		</Drawer>
	);
}

// ---------- service requests ----------
function Requests({ onCreateJob, onBook }: { onCreateJob: (p: Partial<Job> & { onCreated?: (no: string) => void }) => void; onBook: () => void }) {
	const list = useVehicles();
	const sold = list.filter((v) => v.status === "Sold" || v.status === "In service");
	const [reqs, setReqs] = usePersist<Req[]>("svcRequests", [
		{ no: "SR-5521", channel: "App", customer: sold[0]?.customer ?? "Customer", reg: sold[0]?.reg ?? "", issue: "Charging stops at 80%", dealer: sold[0]?.dealer ?? dealers[0].name, status: "New", when: "35 min ago" },
		{ no: "SR-5520", channel: "Call", customer: sold[1]?.customer ?? "Customer", reg: sold[1]?.reg ?? "", issue: "Periodic service due", dealer: sold[1]?.dealer ?? dealers[1].name, status: "Appointment booked", when: "2 h ago" },
		{ no: "SR-5518", channel: "Walk-in", customer: sold[2]?.customer ?? "Customer", reg: sold[2]?.reg ?? "", issue: "Side stand switch faulty", dealer: sold[2]?.dealer ?? dealers[2].name, status: "Job card opened", job: "JC-31197", when: "Yesterday" },
	]);
	const [reg, setReg] = useState("");
	const [channel, setChannel] = useState("Call");
	const [issue, setIssue] = useState("");
	const add = (e: FormEvent) => {
		e.preventDefault();
		const v = sold.find((s) => s.reg === reg);
		if (!v || !issue.trim()) { toast("Pick the vehicle and describe the issue"); return; }
		const no = `SR-${5522 + reqs.length}`;
		setReqs((l) => [{ no, channel, customer: v.customer, reg: v.reg, issue: issue.trim(), dealer: v.dealer, status: "New", when: now() }, ...l]);
		setIssue(""); toast(`${no} logged and sent to ${v.dealer}`);
	};
	return (
		<>
			<form className="inline-form" onSubmit={add}>
				<label>Vehicle<select id="sr-reg" value={reg} onChange={(e) => setReg(e.target.value)}><option value="">Pick registration</option>{sold.map((s) => <option key={s.vin} value={s.reg}>{s.reg} · {s.customer}</option>)}</select></label>
				<label>Came in by<select id="sr-ch" value={channel} onChange={(e) => setChannel(e.target.value)}><option>Call</option><option>App</option><option>Walk-in</option><option>Email</option></select></label>
				<label style={{ flex: 1 }}>Issue<input id="sr-is" className="search" style={{ width: "100%" }} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What the customer reported" /></label>
				<button className="btn" type="submit">Log request</button>
			</form>
			<Table cols={[
				{ key: "no", label: "Request" }, { key: "when", label: "When", hideSm: true }, { key: "channel", label: "By", hideSm: true },
				{ key: "customer", label: "Customer", render: (r: Req) => <>{r.customer}<small className="sub"> · {r.reg}</small></> },
				{ key: "issue", label: "Issue" },
				{ key: "status", label: "Status", render: (r: Req) => <Badge tone={r.status === "New" ? "warn" : "good"}>{r.status === "Job card opened" && r.job ? `${r.job} opened` : r.status}</Badge> },
				{ key: "a", label: "", render: (r: Req) => r.status === "New" ? (
					<span className="rw-btns">
						<button className="btn sm" onClick={() => onCreateJob({ reg: r.reg, complaint: r.issue, onCreated: (no: string) => setReqs((l) => l.map((x) => (x.no === r.no ? { ...x, status: "Job card opened", job: no } : x))) } as Partial<Job> & { onCreated: (no: string) => void })}>Open job card</button>
						<button className="btn sm ghost" onClick={() => { setReqs((l) => l.map((x) => (x.no === r.no ? { ...x, status: "Appointment booked" } : x))); onBook(); }}>Book slot</button>
					</span>
				) : null },
			]} rows={reqs} />
		</>
	);
}

// ---------- warranty claims ----------
function Claims() {
	const [claims, setClaims] = useClaims();
	const [, setJobs] = useJobs();
	const decide = (c: Claim, ok: boolean) => {
		setClaims((l) => l.map((x) => (x.no === c.no ? { ...x, status: ok ? "Approved" : "Rejected" } : x)));
		setJobs((l) => l.map((j) => (j.no === c.job ? { ...j, status: "In repair", warranty: ok, log: [{ when: now(), what: ok ? `Warranty claim ${c.no} approved — credit note to ${c.dealer}` : `Warranty claim ${c.no} rejected — customer to pay` }, ...j.log] } : j)));
		toast(ok ? `${c.no} approved — credit note of ${inr(c.amount)} raised for ${c.dealer}` : `${c.no} rejected — ${c.dealer} informed; job moves to paid repair`);
	};
	const approved = claims.filter((c) => c.status === "Approved").reduce((a, c) => a + c.amount, 0);
	const pending = claims.filter((c) => c.status === "Pending" || c.status === "Under review");
	return (
		<>
			<div className="mini-stats">
				<span><small>Claims this month</small><b>{claims.length + 33}</b></span>
				<span><small>Waiting for decision</small><b>{pending.length}</b></span>
				<span><small>Warranty cost approved</small><b>{inr(approved + 184500)}</b></span>
				<span><small>Rejection rate</small><b>{Math.round(((claims.filter((c) => c.status === "Rejected").length + 3) / (claims.length + 33)) * 100)}%</b></span>
			</div>
			<Table cols={[
				{ key: "no", label: "Claim" }, { key: "job", label: "Job card", hideSm: true }, { key: "part", label: "Part" }, { key: "dealer", label: "Dealer", hideSm: true },
				{ key: "amount", label: "Amount", num: true, render: (r: Claim) => inr(r.amount) },
				{ key: "status", label: "Status", render: (r: Claim) => <Badge>{r.status}</Badge> },
				{ key: "a", label: "", render: (r: Claim) => (r.status === "Pending" || r.status === "Under review" ? <span className="rw-btns"><button className="btn sm" onClick={() => decide(r, true)}>Approve</button><button className="btn sm ghost" onClick={() => decide(r, false)}>Reject</button></span> : null) },
			]} rows={claims} />
		</>
	);
}

// ---------- complaints ----------
const complaintSeed: Complaint[] = [
	{ no: "CMP-1180", customer: "Customer 1180", reg: "KA-03-EV-1180", category: "Range / battery", text: "Range drops after 2 swaps", dealer: "Greenline Motors", owner: "Service manager", status: "Open", opened: "3 h ago" },
	{ no: "CMP-1178", customer: "Customer 1178", reg: "MH-12-EV-2210", category: "Swap station experience", text: "Kharadi station had no charged pack", dealer: "Sahyadri EV World", owner: "Swap operations", status: "In progress", opened: "Yesterday" },
	{ no: "CMP-1171", customer: "Customer 1171", reg: "TN-09-EV-5512", category: "Brakes & suspension", text: "Brake squeal after service", dealer: "Marina E-Mobility", owner: "Service manager", status: "Closed", reason: "Repaired — pads replaced", opened: "3 days ago" },
];
function ComplaintsTab() {
	const [list, setList] = usePersist<Complaint[]>("svcComplaints", complaintSeed);
	const vehiclesNow = useVehicles();
	const sold = vehiclesNow.filter((v) => v.status === "Sold" || v.status === "In service");
	const [form, setForm] = useState(false);
	const [reg, setReg] = useState("");
	const [cat, setCat] = useState(complaints[0].cat);
	const [text, setText] = useState("");
	const [closing, setClosing] = useState<string | null>(null);
	const [reason, setReason] = useState("Repaired");
	const log = (e: FormEvent) => {
		e.preventDefault();
		const v = sold.find((s) => s.reg === reg);
		if (!v || !text.trim()) { toast("Pick the vehicle and write the complaint"); return; }
		const no = `CMP-${1181 + list.length}`;
		setList((l) => [{ no, customer: v.customer, reg: v.reg, category: cat, text: text.trim(), dealer: v.dealer, owner: cat.startsWith("Swap") ? "Swap operations" : "Service manager", status: "Open", opened: now() }, ...l]);
		setForm(false); setText(""); toast(`${no} logged and assigned`);
	};
	return (
		<>
			<div className="split">
				<div>
					<h3 className="mini">By category (this month)</h3>
					<Chart labels={complaints.map((c) => c.cat.split(" ")[0])} stacked series={[
						{ name: "Closed", values: complaints.map((c) => c.closed + list.filter((x) => x.category === c.cat && x.status === "Closed").length), tone: "accent" },
						{ name: "Open", values: complaints.map((c) => c.open + list.filter((x) => x.category === c.cat && x.status !== "Closed").length), tone: "warn" },
					]} />
				</div>
				<div>
					<div className="row-btns spread"><h3 className="mini" style={{ margin: 0 }}>Complaint register</h3><button className="btn sm" onClick={() => setForm((f) => !f)}>{form ? "Cancel" : "Log complaint"}</button></div>
					{form && (
						<form className="pick-box rec-form" onSubmit={log}>
							<label htmlFor="cp-v"><span>Vehicle</span><select id="cp-v" value={reg} onChange={(e) => setReg(e.target.value)}><option value="">Pick registration</option>{sold.map((s) => <option key={s.vin} value={s.reg}>{s.reg} · {s.customer}</option>)}</select></label>
							<label htmlFor="cp-c"><span>Category</span><select id="cp-c" value={cat} onChange={(e) => setCat(e.target.value)}>{complaints.map((c) => <option key={c.cat}>{c.cat}</option>)}</select></label>
							<label htmlFor="cp-t"><span>Complaint</span><input id="cp-t" className="search" value={text} onChange={(e) => setText(e.target.value)} /></label>
							<div className="row-btns"><button className="btn sm" type="submit">Save complaint</button></div>
						</form>
					)}
					<ul className="cmp-list">
						{list.map((c) => (
							<li key={c.no}>
								<div><b>{c.text}</b><small>{c.no} · {c.reg} · {c.category} · {c.owner} · {c.opened}</small>{c.reason && <small>Closed: {c.reason}</small>}</div>
								<div className="cmp-act">
									<Badge tone={c.status === "Closed" ? "good" : c.status === "Open" ? "warn" : "info"}>{c.status}</Badge>
									{c.status === "Open" && <button className="btn sm ghost" onClick={() => { setList((l) => l.map((x) => (x.no === c.no ? { ...x, status: "In progress" } : x))); toast(`${c.no} picked up by ${c.owner}`); }}>Start</button>}
									{c.status === "In progress" && closing !== c.no && <button className="btn sm ghost" onClick={() => setClosing(c.no)}>Close</button>}
									{closing === c.no && (
										<span className="rw-btns">
											<select aria-label="Closure reason" value={reason} onChange={(e) => setReason(e.target.value)}><option>Repaired</option><option>Part replaced</option><option>No fault found</option><option>Customer guided</option><option>Station restocked</option></select>
											<button className="btn sm" onClick={() => { setList((l) => l.map((x) => (x.no === c.no ? { ...x, status: "Closed", reason } : x))); setClosing(null); toast(`${c.no} closed — customer sent a feedback SMS`); }}>Confirm</button>
										</span>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</>
	);
}

// ---------- customers ----------
function Customers() {
	const list = useVehicles();
	const [jobs] = useJobs();
	const [cmp] = usePersist<Complaint[]>("svcComplaints", complaintSeed);
	const [q, setQ] = useState("");
	const [sel, setSel] = useState<string | null>(null);
	const custs = list.filter((v) => v.customer !== "—").map((v) => ({
		name: v.customer, phone: v.phone ?? `98${String(v.vin.slice(-6)).padStart(8, "4")}`.slice(0, 10).replace(/(\d{5})(\d{5})/, "$1 $2"),
		reg: v.reg, model: v.model, city: v.city, dealer: v.dealer, vin: v.vin,
		visits: jobs.filter((j) => j.vin === v.vin).length, openC: cmp.filter((c) => c.reg === v.reg && c.status !== "Closed").length,
	})).filter((c) => (c.name + c.reg + c.city).toLowerCase().includes(q.toLowerCase()));
	const cur = custs.find((c) => c.vin === sel);
	return (
		<>
			<div className="filters" style={{ marginBottom: 12 }}><Search value={q} onChange={setQ} placeholder="Customer, registration or city" /><span className="hint" style={{ margin: 0 }}>{custs.length} customers</span></div>
			<Table cols={[
				{ key: "name", label: "Customer" }, { key: "phone", label: "Mobile", hideSm: true }, { key: "reg", label: "Vehicle", render: (c: typeof custs[number]) => <>{c.reg}<small className="sub"> · {c.model}</small></> },
				{ key: "city", label: "City", hideSm: true }, { key: "dealer", label: "Dealer", hideSm: true },
				{ key: "visits", label: "Visits", num: true }, { key: "openC", label: "Open complaints", num: true, render: (c: typeof custs[number]) => (c.openC ? <span className="neg">{c.openC}</span> : "0") },
			]} rows={custs} onRow={(c) => setSel(c.vin)} />
			<Drawer open={!!cur} onClose={() => setSel(null)} title={cur?.name ?? ""} sub={cur ? `${cur.phone} · ${cur.city}` : ""}>
				{cur && (
					<>
						<Facts rows={[["Vehicle", `${cur.reg} · ${cur.model}`], ["Dealer", cur.dealer], ["Service visits", String(cur.visits)], ["Open complaints", String(cur.openC)]]} />
						<h3 className="mini">Job cards</h3>
						{jobs.filter((j) => j.vin === cur.vin).length ? <Table dense cols={[{ key: "no", label: "Job" }, { key: "complaint", label: "Work" }, { key: "status", label: "Status", render: (j: Job) => <Badge>{j.status}</Badge> }]} rows={jobs.filter((j) => j.vin === cur.vin)} /> : <p className="hint">No job cards yet.</p>}
					</>
				)}
			</Drawer>
		</>
	);
}

// ---------- service stock ----------
function ServiceStock() {
	const [used] = useStockUsed();
	const [jobs] = useJobs();
	const [orders, setOrders] = usePersist<{ no: string; part: string; qty: number; status: string }[]>("svcOrders", []);
	const rows = serviceParts.map((p) => {
		const onHand = p.stock - (used[p.part] ?? 0) + orders.filter((o) => o.part === p.part && o.status === "Received").reduce((a, o) => a + o.qty, 0);
		const usedMonth = (used[p.part] ?? 0) + Math.round(p.min * 1.4);
		return { ...p, onHand, usedMonth, ordered: orders.some((o) => o.part === p.part && o.status === "Ordered") };
	});
	const order = (p: string, qty: number) => {
		const no = `TR-S-${410 + orders.length}`;
		setOrders((l) => [{ no, part: p, qty, status: "Ordered" }, ...l]);
		toast(`${no}: ${qty} × ${p} requested from Central WH — Hosur`);
	};
	const pendingNeeds = jobs.flatMap((j) => j.parts.filter((x) => x.status === "Requested").map((x) => `${x.qty} × ${x.part} (${j.no})`));
	return (
		<>
			<p className="hint">Service store stock at the dealer workshops. Parts issued on job cards reduce it; reorders come from the central warehouse.</p>
			{pendingNeeds.length > 0 && <p className="hint">Waiting to be issued on job cards: {pendingNeeds.join(", ")}.</p>}
			<Table cols={[
				{ key: "part", label: "Part" }, { key: "onHand", label: "In store", num: true, render: (r) => <span className={r.onHand < r.min ? "neg" : ""}>{r.onHand}</span> },
				{ key: "min", label: "Minimum", num: true, hideSm: true }, { key: "usedMonth", label: "Used this month", num: true, hideSm: true },
				{ key: "price", label: "Price", num: true, hideSm: true, render: (r) => inr(r.price) },
				{ key: "s", label: "", render: (r) => r.ordered ? <Badge tone="info">Reorder sent</Badge> : r.onHand < r.min ? <button className="btn sm" onClick={() => order(r.part, r.min * 2)}>Reorder</button> : <span className="sub">OK</span> },
			]} rows={rows} />
			{orders.length > 0 && (
				<>
					<h3 className="mini" style={{ marginTop: 18 }}>Reorders</h3>
					<Table dense cols={[{ key: "no", label: "Transfer" }, { key: "part", label: "Part" }, { key: "qty", label: "Qty", num: true }, { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
						{ key: "a", label: "", render: (r) => r.status === "Ordered" ? <button className="btn sm ghost" onClick={() => setOrders((l) => l.map((x) => (x.no === r.no ? { ...x, status: "Received" } : x)))}>Mark received</button> : null }]} rows={orders} />
				</>
			)}
		</>
	);
}

// ---------- dealers ----------
type Dealer = (typeof dealers)[number];
function Dealers() {
	const [extra, setExtra] = usePersist<Dealer[]>("extraDealers", []);
	const [open, setOpen] = useState(false);
	const [f, setF] = useState({ name: "", city: "Bengaluru", email: "" });
	const [err, setErr] = useState<string | null>(null);
	const all = [...extra, ...dealers];
	const save = (e: FormEvent) => {
		e.preventDefault();
		if (!f.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setErr("Add the dealer name and a valid email for the dealer portal login."); return; }
		const code = `DLR-${f.city.slice(0, 3).toUpperCase()}-${String(10 + extra.length).padStart(2, "0")}`;
		setExtra((l) => [{ code, name: f.name.trim(), city: f.city, sold: 0, stock: 0, csat: 0, openJobs: 0, tat: 0, revenue: 0 }, ...l]);
		setOpen(false); setErr(null); setF({ name: "", city: "Bengaluru", email: "" });
		toast(`${code} created — dealer portal invite sent to ${f.email}`);
	};
	return (
		<>
			<div className="row-btns spread"><p className="hint" style={{ margin: 0 }}>Sales, stock and service performance per dealer, this month.</p><button className="btn sm" onClick={() => setOpen(true)}>Add dealer</button></div>
			<Table cols={[
				{ key: "name", label: "Dealer", render: (r: Dealer) => <>{r.name}<small className="sub"> · {r.code} · {r.city}</small>{r.sold === 0 && <> <Badge tone="info">New</Badge></>}</> },
				{ key: "sold", label: "Sold", num: true }, { key: "stock", label: "Stock", num: true, hideSm: true },
				{ key: "openJobs", label: "Open jobs", num: true, hideSm: true },
				{ key: "tat", label: "Turnaround", num: true, render: (r: Dealer) => (r.tat ? <span className={r.tat > 8 ? "neg" : ""}>{r.tat} h</span> : "—") },
				{ key: "csat", label: "Rating", num: true, hideSm: true, render: (r: Dealer) => (r.csat ? r.csat.toFixed(1) : "—") },
				{ key: "revenue", label: "Revenue", num: true, render: (r: Dealer) => (r.revenue ? crore(r.revenue) : "—") },
			]} rows={all} />
			<Drawer open={open} onClose={() => setOpen(false)} title="Add dealer" sub="Creates the dealer and sends a dealer portal invite">
				<form className="rec-form" onSubmit={save} noValidate>
					<label htmlFor="dl-n"><span>Dealer name</span><input id="dl-n" className="search" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
					<label htmlFor="dl-c"><span>City</span><select id="dl-c" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>{["Bengaluru", "Pune", "Chennai", "Hyderabad", "Delhi NCR", "Ahmedabad"].map((c) => <option key={c}>{c}</option>)}</select></label>
					<label htmlFor="dl-e"><span>Login email</span><input id="dl-e" className="search" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="service@dealer.in" /></label>
					{err && <p className="form-err" role="alert">{err}</p>}
					<div className="row-btns"><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn">Save dealer</button></div>
				</form>
			</Drawer>
		</>
	);
}
