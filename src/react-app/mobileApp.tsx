import { useEffect, useRef, useState } from "react";
import { approvals, items, jobCards, workOrders, fgYard, inr } from "./data";
import { Page, Panel, Table, Cell, Badge } from "./ui";

const roles = [
	{ key: "stores", label: "Warehouse", desc: "Scan RFID tags or barcodes to receive, issue, move and count stock." },
	{ key: "line", label: "Production", desc: "Follow a work order and scan each part's serial into the vehicle." },
	{ key: "tech", label: "Service technician", desc: "Work a job card with live battery data, request parts and close the job." },
	{ key: "dealer", label: "Dealer", desc: "See vehicle stock and book customers in for service." },
	{ key: "mgmt", label: "Management", desc: "See the day at a glance and approve requests with one tap." },
] as const;
type Role = (typeof roles)[number]["key"];

export function Mobile() {
	const [role, setRole] = useState<Role>("stores");
	const cur = roles.find((r) => r.key === role)!;
	return (
		<Page title="Mobile app" sub="Android and iOS app for people on the floor, in the workshop and on the move. Pick a role and use the phone.">
			<div className="mob-wrap">
				<div className="mob-roles" role="tablist" aria-label="Role">
					{roles.map((r) => (
						<button key={r.key} role="tab" aria-selected={role === r.key} className={role === r.key ? "on" : ""} onClick={() => setRole(r.key)}>
							<b>{r.label}</b><small>{r.desc}</small>
						</button>
					))}
				</div>
				<div className="phone-frame">
					<div className="phone2">
						<div className="ph2-status"><span>11:42</span><span>4G · 82%</span></div>
						<div className="ph2-app" key={role}>
							<div className="ph2-head"><b>{cur.label}</b><small>Voltera ERP</small></div>
							{role === "stores" && <StoresApp />}
							{role === "line" && <LineApp />}
							{role === "tech" && <TechApp />}
							{role === "dealer" && <DealerApp />}
							{role === "mgmt" && <MgmtApp />}
						</div>
					</div>
				</div>
			</div>
			<Panel title="What each role can do">
				<Table dense cols={[{ key: "r", label: "Role" }, { key: "d", label: "On the app" }]} rows={[
					{ r: "Warehouse", d: "RFID / barcode scan, goods receipt, put-away, issue, transfer, cycle count" },
					{ r: "Plant & production", d: "Work order progress, serial scanning per station, quality checks, battery pairing" },
					{ r: "Service technicians", d: "Job cards, diagnosis checklist, battery data, parts request, photos, customer sign-off" },
					{ r: "Dealers", d: "Vehicle stock, bookings, service appointments, warranty claims" },
					{ r: "Management", d: "Dashboard, exceptions, approvals with one tap" },
				]} />
			</Panel>
		</Page>
	);
}

function MiniToast({ msg }: { msg: string | null }) {
	return msg ? <div className="ph2-toast" role="status">{msg}</div> : null;
}
function useMini() {
	const [msg, setMsg] = useState<string | null>(null);
	const t = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(t.current), []);
	return { msg, show: (m: string) => { setMsg(m); window.clearTimeout(t.current); t.current = window.setTimeout(() => setMsg(null), 2200); } };
}

// ---------- Warehouse ----------
function StoresApp() {
	const { msg, show } = useMini();
	const [scanning, setScanning] = useState(false);
	const [idx, setIdx] = useState<number | null>(null);
	const [log, setLog] = useState<string[]>(["Received 300 × Hub motor 2.5 kW", "Moved 60 × Controller to line-side"]);
	const pool = [0, 1, 11, 2, 21];
	const scan = () => {
		setScanning(true); setIdx(null);
		window.setTimeout(() => { setScanning(false); setIdx(pool[(log.length + 1) % pool.length]); }, 900);
	};
	const it = idx !== null ? items[idx] : null;
	const act = (verb: string) => {
		if (!it) return;
		const line = `${verb} ${verb === "Counted" ? it.onHand : 10} × ${it.name}`;
		setLog((l) => [line, ...l].slice(0, 4)); show(`${verb} — stock updated`); setIdx(null);
	};
	return (
		<div className="ph2-body">
			<button className={`ph2-scan ${scanning ? "busy" : ""}`} onClick={scan} disabled={scanning}>
				<span>{scanning ? "Reading tag…" : "Tap to scan"}</span>
			</button>
			{it && (
				<div className="ph2-card">
					<b>{it.name}</b>
					<small>{it.code} · bin {it.bin} · {it.onHand.toLocaleString("en-IN")} {it.uom} on hand</small>
					<div className="ph2-grid">
						<button className="btn sm" onClick={() => act("Received")}>Receive</button>
						<button className="btn sm ghost" onClick={() => act("Issued")}>Issue</button>
						<button className="btn sm ghost" onClick={() => act("Moved")}>Move</button>
						<button className="btn sm ghost" onClick={() => act("Counted")}>Count</button>
					</div>
				</div>
			)}
			<div className="ph2-list">
				<small className="ph2-label">Recent</small>
				{log.map((l, i) => <span key={i}>{l}</span>)}
			</div>
			<MiniToast msg={msg} />
		</div>
	);
}

// ---------- Production ----------
function LineApp() {
	const { msg, show } = useMini();
	const wo = workOrders[0];
	const parts = ["Hub motor", "Controller", "Harness", "TFT cluster", "Telematics unit", "Battery pack"];
	const [done, setDone] = useState<string[]>(["Hub motor", "Controller"]);
	const [built, setBuilt] = useState(wo.done);
	const all = done.length === parts.length;
	return (
		<div className="ph2-body">
			<div className="ph2-card">
				<b>{wo.no} · {wo.model}</b>
				<small>{wo.line} · {built} of {wo.qty} built</small>
				<span className="bar"><span className="bar-fill accent" style={{ width: `${(built / wo.qty) * 100}%` }} /></span>
			</div>
			<small className="ph2-label">VIN …0521{(18 + built - wo.done).toString().padStart(2, "0")} · scan each part</small>
			<ul className="ph2-checks">
				{parts.map((p) => (
					<li key={p}>
						<span>{p}</span>
						{done.includes(p) ? <span className="ok">Scanned</span> : <button className="btn sm ghost" onClick={() => { setDone((d) => [...d, p]); show(`${p} serial linked to VIN`); }}>Scan</button>}
					</li>
				))}
			</ul>
			<button className="btn" disabled={!all} onClick={() => { setBuilt((b) => b + 1); setDone([]); show("Sent to end-of-line test"); }}>{all ? "Send to end-of-line test" : `${parts.length - done.length} parts left to scan`}</button>
			<MiniToast msg={msg} />
		</div>
	);
}

// ---------- Technician ----------
function TechApp() {
	const { msg, show } = useMini();
	const [open, setOpen] = useState<number | null>(null);
	const [steps, setSteps] = useState<boolean[]>([true, false, false, false]);
	const [closed, setClosed] = useState<string[]>([]);
	const labels = ["Pull BMS log", "Check cell balance", "Road test 5 km", "Customer sign-off"];
	const mine = jobCards.filter((j) => j.status !== "Closed").slice(0, 4);
	if (open === null) {
		return (
			<div className="ph2-body">
				<small className="ph2-label">My jobs today</small>
				{mine.map((j, i) => (
					<button key={j.no} className="ph2-card ph2-tap" onClick={() => { setOpen(i); setSteps([true, false, false, false]); }}>
						<b>{j.complaint}</b>
						<small>{j.no} · {j.customer}</small>
						{closed.includes(j.no) ? <Badge>Closed</Badge> : <Badge>{j.status}</Badge>}
					</button>
				))}
				<MiniToast msg={msg} />
			</div>
		);
	}
	const j = mine[open];
	const all = steps.every(Boolean);
	return (
		<div className="ph2-body">
			<button className="ph2-back" onClick={() => setOpen(null)}>‹ My jobs</button>
			<div className="ph2-card"><b>{j.complaint}</b><small>{j.no} · VIN {j.vin} · {j.customer}</small></div>
			<div className="ph2-card"><small>Battery BAT-48-20462 · live from BMS</small><Cell pct={86} label="86% health" /><small>Cell imbalance 18 mV · 412 cycles</small></div>
			<ul className="ph2-checks">
				{labels.map((l, i) => (
					<li key={l}>
						<label><input type="checkbox" id={`chk-${i}`} checked={steps[i]} onChange={() => setSteps((s) => s.map((v, k) => (k === i ? !v : v)))} /> {l}</label>
					</li>
				))}
			</ul>
			<div className="ph2-grid two">
				<button className="btn sm ghost" onClick={() => show("Part request PR-S-221 sent to service stores")}>Request part</button>
				<button className="btn sm" disabled={!all} onClick={() => { setClosed((c) => [...c, j.no]); setOpen(null); show(`${j.no} closed — customer notified`); }}>Close job</button>
			</div>
			<MiniToast msg={msg} />
		</div>
	);
}

// ---------- Dealer ----------
function DealerApp() {
	const { msg, show } = useMini();
	const [booked, setBooked] = useState<string[]>([]);
	const slots = ["Tomorrow 10:00", "Tomorrow 12:30", "Tomorrow 16:00"];
	return (
		<div className="ph2-body">
			<small className="ph2-label">My stock · Greenline Motors</small>
			<ul className="ph2-checks">
				{fgYard.slice(0, 3).map((f) => <li key={f.model + f.colour}><span>{f.model} · {f.colour}</span><b>{Math.max(2, Math.round(f.allocated / 4))}</b></li>)}
			</ul>
			<small className="ph2-label">Book a service</small>
			<div className="ph2-grid">
				{slots.map((s) => (
					<button key={s} className={`btn sm ${booked.includes(s) ? "" : "ghost"}`} disabled={booked.includes(s)} onClick={() => { setBooked((b) => [...b, s]); show(`Booked ${s} — SMS sent to customer`); }}>{booked.includes(s) ? "Booked" : s}</button>
				))}
			</div>
			<div className="ph2-card"><b>Warranty claim WC-0929</b><small>Rear shock absorber · {inr(1650)}</small><Badge>Pending</Badge></div>
			<MiniToast msg={msg} />
		</div>
	);
}

// ---------- Management ----------
function MgmtApp() {
	const { msg, show } = useMini();
	const [list, setList] = useState(approvals.slice(0, 4));
	return (
		<div className="ph2-body">
			<div className="ph2-kpis">
				<span>Built<b>219</b></span><span>Swaps<b>1,693</b></span><span>To approve<b>{list.length}</b></span>
			</div>
			<small className="ph2-label">Waiting for you</small>
			{list.length === 0 && <p className="ph2-empty">All caught up.</p>}
			{list.map((a) => (
				<div key={a.id} className="ph2-card">
					<b>{a.title}</b>
					<small>{a.type}{a.value ? ` · ${inr(a.value)}` : ""}</small>
					<div className="ph2-grid two">
						<button className="btn sm ghost" onClick={() => { setList((l) => l.filter((x) => x.id !== a.id)); show(`${a.id} sent back`); }}>Send back</button>
						<button className="btn sm" onClick={() => { setList((l) => l.filter((x) => x.id !== a.id)); show(`${a.id} approved`); }}>Approve</button>
					</div>
				</div>
			))}
			<MiniToast msg={msg} />
		</div>
	);
}
