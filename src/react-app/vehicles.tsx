import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { vehicles, dealers, batteries, jobCards, models, inr } from "./data";
import type { Vehicle } from "./data";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, Tabs, Drawer, Facts, Timeline, Search, Cell, toast } from "./ui";
import { usePersist, useOpenParam } from "./store";

// ---------- live vehicle state ----------
type Extra = { saleDate?: string; regDate?: string; rto?: string; insurer?: string; policy?: string; insExpiry?: string; phone?: string; dispatch?: string };
type V = Vehicle & Extra & { idx: number };
type Dispatch = { no: string; dealer: string; vins: string[]; truck: string; date: string; status: "In transit" | "Delivered" };

function useOverrides() { return usePersist<Record<string, Partial<V>>>("vehOverrides", {}); }
function useDispatches() {
	return usePersist<Dispatch[]>("dispatches", [
		{ no: "DSP-2290", dealer: "Greenline Motors", vins: [vehicles[2].vin], truck: "KA-51-AB-2231", date: "07 Oct 2026", status: "In transit" },
		{ no: "DSP-2284", dealer: "Capital EV Hub", vins: [vehicles[3].vin], truck: "HR-55-CD-7714", date: "04 Oct 2026", status: "Delivered" },
	]);
}
function useVehicles(): V[] {
	const [ov] = useOverrides();
	return useMemo(() => vehicles.map((v, idx) => ({ ...v, idx, ...(ov[v.vin] ?? {}) }) as V), [ov]);
}

// ---------- per-vehicle detail, derived from the VIN so each one differs ----------
const seedOf = (vin: string) => vin.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7);
const pickBy = <T,>(s: number, arr: readonly T[], k = 0) => arr[(s + k * 7) % arr.length];
const rtoFor = (reg: string) => ({ "KA-01": "Koramangala RTO, Bengaluru", "KA-03": "Indiranagar RTO, Bengaluru", "MH-12": "Pune RTO", "TN-09": "Chennai (South) RTO", "TS-07": "Ranga Reddy RTO", "DL-3S": "Sheikh Sarai RTO, Delhi" } as Record<string, string>)[reg.slice(0, 5)] ?? "—";

function detail(v: V) {
	const s = seedOf(v.vin);
	const cargo = v.model === "Cargo C2", lite = v.model === "E-Ride Lite", pro = v.model === "E-Ride S1 Pro";
	const config = {
		variant: pro ? "Pro · connected" : cargo ? "Cargo · heavy duty" : lite ? "Lite · city" : "Standard",
		bom: "Rev C", motor: cargo ? "3.0 kW hub" : lite ? "1.8 kW hub" : "2.5 kW hub",
		pack: lite ? "48V 30Ah LFP (swappable)" : "48V 50Ah LFP (swappable)",
		speed: cargo ? "60 km/h" : lite ? "45 km/h" : pro ? "85 km/h" : "75 km/h",
		range: lite ? "80 km" : cargo ? "95 km" : pro ? "130 km" : "110 km",
	};
	const tail = v.vin.slice(-5);
	const components = [
		{ p: "Hub motor", s: `HM${cargo ? "30" : lite ? "18" : "25"}-${tail}`, v: "Shakti Motors & Drives", b: "Lot SM-2608" },
		{ p: "Motor controller 48V", s: `MC48-${(s % 90000) + 10000}`, v: "NexBoard Electronics", b: "Lot NB-2609" },
		{ p: "Main frame", s: `FR-${cargo ? "C2" : "S1"}-26-${tail}`, v: "Precision Frames India", b: "Heat no. 7731" },
		{ p: pro || v.model === "E-Ride S1" ? "TFT cluster 5in" : "LCD cluster 4in", s: `CL-${(s * 3) % 90000 + 10000}`, v: "NexBoard Electronics", b: "Lot NB-2607" },
		{ p: "IoT telematics unit", s: `IOT-${(s * 7) % 90000 + 10000}`, v: "NexBoard Electronics", b: "IMEI …" + String(s).padStart(5, "0") },
		{ p: "Tyres (2)", s: `RT-26${pickBy(s, ["09", "08", "07"])}-B`, v: "Rapid Tyres Ltd", b: "Batch" },
		{ p: "Brake kit", s: `DBK-${(s * 11) % 9000 + 1000}`, v: "Lumio Auto Electricals", b: "Lot LA-2606" },
	];
	const packs = batteries.filter((_, i) => (i + v.idx) % 13 === 0).slice(0, v.odo > 4000 ? 3 : v.odo > 0 ? 2 : 1);
	const batteryHist = v.battery === "—" ? [] : [
		...packs.slice(1).map((b, i) => ({ id: b.id, from: i === 0 ? "21 Sep 2026" : "02 Sep 2026", to: i === 0 ? "Now" : "21 Sep 2026", how: "Swap at " + pickBy(s, ["Koramangala 5th Block", "HSR Layout Sector 2", "Hinjewadi Phase 1", "OMR Thoraipakkam"], i), soh: b.soh })),
		{ id: v.battery, from: v.mfg, to: packs.length > 1 ? packs.length > 2 ? "02 Sep 2026" : "21 Sep 2026" : "Now", how: "Fitted at plant", soh: batteries.find((b) => b.id === v.battery)?.soh ?? 95 },
	];
	const sold = v.status === "Sold" || v.status === "In service";
	const realJobs = jobCards.filter((j) => v.vin.endsWith(j.vin.replace("…", "")));
	const jobs = sold ? [
		...realJobs.map((j) => ({ no: j.no, date: "08 Oct 2026", what: j.complaint, cost: j.warranty ? 0 : 1850, status: j.status, warranty: j.warranty })),
		...(v.odo > 1000 ? [{ no: `JC-${30000 + (s % 900)}`, date: "02 Sep 2026", what: "First service — 1,000 km", cost: 0, status: "Closed", warranty: false }] : []),
		...(v.odo > 5000 ? [{ no: `JC-${30900 + (s % 90)}`, date: "26 Sep 2026", what: pickBy(s, ["Brake pad replacement", "Headlamp alignment", "Software update"]), cost: pickBy(s, [1250, 400, 0]), status: "Closed", warranty: false }] : []),
	] : [];
	const damage = sold && s % 3 === 0 ? [{ when: "14 Sep 2026", what: "Minor accident — front panel", where: v.dealer, detail: `Insurance claim IC-${2200 + (s % 99)} · ${inr(6400)} · panel and headlamp replaced` }] : [];
	const area = pickBy(s, { Bengaluru: ["Koramangala", "HSR Layout", "Whitefield", "Indiranagar"], Pune: ["Hinjewadi", "Kharadi", "Baner"], Chennai: ["OMR", "T. Nagar", "Velachery"], Hyderabad: ["HITEC City", "Gachibowli"], "Delhi NCR": ["Gurugram Sec 29", "Saket", "Noida Sec 62"] }[v.city] ?? ["City centre"]);
	const loc = sold ? {
		place: `${area}, ${v.city}`, ping: `${(s % 50) + 1} min ago`, soc: (s % 70) + 22, speed: s % 4 === 0 ? 0 : (s % 40) + 15,
		alerts: [s % 5 === 0 ? "Harsh braking ×3 today" : "", s % 7 === 0 ? "Battery below 20%" : "", s % 11 === 0 ? "Service due in 200 km" : ""].filter(Boolean),
	} : null;
	return { config, components, batteryHist, jobs, damage, loc };
}

// ---------- page ----------
const tabs = ["All vehicles", "Allocate & dispatch", "Location", "Lifecycle report"] as const;
type Tab = (typeof tabs)[number];
const stages = ["All", "In production", "Finished goods", "Dispatched", "At dealer", "Sold", "In service"] as const;

export function Vehicles() {
	const list = useVehicles();
	const [tab, setTab] = useState<Tab>("All vehicles");
	const [f, setF] = useState<(typeof stages)[number]>("All");
	const [q, setQ] = useState("");
	const [sel, setSel] = useState<string | null>(null);
	const open = useOpenParam();
	useEffect(() => { if (open.id && vehicles.some((v) => v.vin === open.id)) { setTab("All vehicles"); setSel(open.id); } }, [open]);
	const rows = list.filter((v) => (f === "All" || v.status === f) && (v.vin + v.reg + v.customer + v.model).toLowerCase().includes(q.toLowerCase()));
	const cur = list.find((v) => v.vin === sel) ?? null;
	const count = (s: string) => list.filter((v) => v.status === s).length;
	return (
		<Page title="Vehicles" sub="One digital record per vehicle, from the first part fitted to the latest service">
			<Stats>
				<Stat label="Built (FY to date)" value="31,482" delta="+18% vs last year" tone="good" />
				<Stat label="Ready to dispatch" value={String(count("Finished goods"))} delta="In the finished goods yard" onClick={() => setTab("Allocate & dispatch")} />
				<Stat label="On the way to dealers" value={String(count("Dispatched"))} delta="Waiting for dealer receipt" onClick={() => setTab("Allocate & dispatch")} />
				<Stat label="Under warranty" value="24,110" delta="37 open claims" tone="warn" />
			</Stats>
			<Panel right={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
				{tab === "All vehicles" && (
					<>
						<div className="filters" style={{ marginBottom: 12 }}>
							<Search value={q} onChange={setQ} placeholder="VIN, registration, customer or model" />
							<select value={f} onChange={(e) => setF(e.target.value as typeof f)} aria-label="Stage">{stages.map((x) => <option key={x}>{x}</option>)}</select>
						</div>
						<Table cols={[
							{ key: "vin", label: "VIN" },
							{ key: "model", label: "Model", render: (r: V) => <>{r.model}<small className="sub"> · {r.colour}</small></> },
							{ key: "battery", label: "Battery", hideSm: true },
							{ key: "dealer", label: "Dealer", hideSm: true },
							{ key: "reg", label: "Registration", hideSm: true },
							{ key: "status", label: "Stage", render: (r: V) => <Badge>{r.status}</Badge> },
						]} rows={rows} onRow={(r) => setSel(r.vin)} />
						{rows.length === 0 && <p className="empty">No vehicles match. Clear the search or pick another stage.</p>}
					</>
				)}
				{tab === "Allocate & dispatch" && <DispatchTab list={list} />}
				{tab === "Location" && <LocationTab list={list} onOpen={(vin) => setSel(vin)} />}
				{tab === "Lifecycle report" && <LifecycleTab list={list} />}
			</Panel>
			<Drawer open={!!cur} onClose={() => setSel(null)} title={cur ? `${cur.model} · ${cur.colour}` : ""} sub={cur?.vin}>
				{cur && <VehicleRecord v={cur} />}
			</Drawer>
		</Page>
	);
}

// ---------- vehicle record ----------
const recTabs = ["Overview", "Components", "Battery", "Service & warranty", "Damage", "Registration", "Location"] as const;
function VehicleRecord({ v }: { v: V }) {
	const [tab, setTab] = useState<(typeof recTabs)[number]>("Overview");
	const d = useMemo(() => detail(v), [v]);
	const sold = v.status === "Sold" || v.status === "In service";
	const saleDate = v.saleDate ?? (sold ? `${(seedOf(v.vin) % 27) + 1} Aug 2026` : "");
	const wEnd = sold ? saleDate.replace("2026", "2029") : "";
	const kmLeft = Math.max(0, 30000 - v.odo);
	const daysUsed = sold ? Math.max(0, Math.round((new Date("2026-10-08").getTime() - new Date(saleDate).getTime()) / 86400000)) || 0 : 0;
	return (
		<>
			<Tabs tabs={recTabs} value={tab} onChange={setTab} />
			{tab === "Overview" && (
				<>
					<Facts rows={[
						["Stage", <Badge>{v.status}</Badge>], ["Variant", d.config.variant], ["BOM revision", d.config.bom], ["Motor", d.config.motor], ["Battery type", d.config.pack],
						["Top speed / range", `${d.config.speed} · ${d.config.range}`], ["Manufactured", `${v.mfg}, Hosur Line 1`], ["Battery fitted", v.battery],
						["Dealer", v.dealer], ["Customer", v.customer], ["Odometer", `${v.odo.toLocaleString("en-IN")} km`],
					]} />
					<VehicleActions v={v} />
				</>
			)}
			{tab === "Components" && (
				<Table dense cols={[{ key: "p", label: "Component" }, { key: "s", label: "Serial / batch" }, { key: "v", label: "Vendor", hideSm: true }]} rows={d.components} />
			)}
			{tab === "Battery" && (d.batteryHist.length ? (
				<>
					<p className="hint">Every pack this vehicle has carried, newest first. Swaps happen at stations; health is from the BMS.</p>
					<Table dense cols={[
						{ key: "id", label: "Pack" }, { key: "how", label: "How", hideSm: true }, { key: "from", label: "From" }, { key: "to", label: "To" },
						{ key: "soh", label: "Health", render: (r: { soh: number }) => <Cell pct={r.soh} size="sm" /> },
					]} rows={d.batteryHist} />
				</>
			) : <p className="empty">No battery fitted yet. The pack is paired at the battery bay before the end-of-line test.</p>)}
			{tab === "Service & warranty" && (
				<>
					<Facts rows={sold ? [
						["Warranty", <Badge tone="good">Active</Badge>], ["Started", `${saleDate} (sale date)`], ["Ends", `${wEnd} or 30,000 km`],
						["Time used", `${daysUsed} of 1,095 days`], ["Km left", `${kmLeft.toLocaleString("en-IN")} km`], ["Claims on this vehicle", String(d.jobs.filter((j) => j.warranty).length)],
					] : [["Warranty", <Badge tone="muted">Not started</Badge>], ["Starts", "On the day the vehicle is sold"]]} />
					<h3 className="mini">Service and repair history</h3>
					{d.jobs.length ? (
						<Table dense cols={[
							{ key: "no", label: "Job card" }, { key: "date", label: "Date", hideSm: true }, { key: "what", label: "Work" },
							{ key: "cost", label: "Paid", num: true, render: (r: { cost: number; warranty: boolean }) => (r.warranty ? "Warranty" : r.cost ? inr(r.cost) : "Free") },
							{ key: "status", label: "Status", render: (r: { status: string }) => <Badge>{r.status}</Badge> },
						]} rows={d.jobs} />
					) : <p className="empty">No service visits yet.</p>}
				</>
			)}
			{tab === "Damage" && (d.damage.length ? <Timeline items={d.damage} /> : <p className="empty">No accident or damage recorded. Dealers log these on a job card.</p>)}
			{tab === "Registration" && (sold ? (
				<Facts rows={[
					["Registration no.", v.reg], ["Registered on", v.regDate ?? saleDate], ["RTO", v.rto ?? rtoFor(v.reg)],
					["Owner", v.customer], ["Insurer", v.insurer ?? pickBy(seedOf(v.vin), ["Shield General Insurance", "Bharat Motor Insurance", "Suraksha Insurance"])],
					["Policy no.", v.policy ?? `POL-${seedOf(v.vin) + 400000}`], ["Insurance valid till", v.insExpiry ?? saleDate.replace("2026", "2027")],
				]} />
			) : <p className="empty">Not registered yet. Registration is recorded when the dealer sells the vehicle.</p>)}
			{tab === "Location" && (d.loc ? (
				<>
					<Facts rows={[["Last location", d.loc.place], ["Last update", d.loc.ping], ["Speed", d.loc.speed ? `${d.loc.speed} km/h, moving` : "Parked"], ["Battery", `${d.loc.soc}%`], ["Odometer", `${v.odo.toLocaleString("en-IN")} km`]]} />
					<h3 className="mini">Alerts</h3>
					{d.loc.alerts.length ? <ul className="alerts">{d.loc.alerts.map((a) => <li key={a}><Badge tone="warn">Alert</Badge>{a}</li>)}</ul> : <p className="hint">No alerts in the last 24 hours.</p>}
				</>
			) : <p className="empty">Telematics starts sending location once the vehicle is sold and on the road.</p>)}
		</>
	);
}

// Actions shown on the overview, depending on the stage
function VehicleActions({ v }: { v: V }) {
	const [, setOv] = useOverrides();
	const [, setDisp] = useDispatches();
	const [dealer, setDealer] = useState(dealers[0].name);
	const [truck, setTruck] = useState("KA-51-AB-2231");
	const [sale, setSale] = useState({ customer: "", phone: "", reg: "", insurer: "Shield General Insurance", policy: "" });
	const [err, setErr] = useState<string | null>(null);
	if (v.status === "Finished goods") {
		return (
			<div className="pick-box">
				<b>Dispatch this vehicle</b>
				<div className="form-row">
					<label htmlFor="va-d"><span>Dealer</span><select id="va-d" value={dealer} onChange={(e) => setDealer(e.target.value)}>{dealers.map((d) => <option key={d.code}>{d.name}</option>)}</select></label>
					<label htmlFor="va-t"><span>Truck no.</span><input id="va-t" className="search" value={truck} onChange={(e) => setTruck(e.target.value)} /></label>
				</div>
				<div className="row-btns"><button className="btn sm" onClick={() => {
					const no = `DSP-${2300 + Math.floor(Math.random() * 90)}`;
					setDisp((l) => [{ no, dealer, vins: [v.vin], truck, date: "08 Oct 2026", status: "In transit" }, ...l]);
					setOv((o) => ({ ...o, [v.vin]: { ...o[v.vin], status: "Dispatched", dealer, dispatch: no, city: dealers.find((d) => d.name === dealer)!.city } }));
					toast(`${no} created — ${v.vin} on truck ${truck} to ${dealer}`);
				}}>Create dispatch</button></div>
			</div>
		);
	}
	if (v.status === "Dispatched") {
		return (
			<div className="pick-box"><b>On the way to {v.dealer}</b><small>The dealer confirms receipt in the dealer portal or here.</small>
				<div className="row-btns"><button className="btn sm" onClick={() => {
					setOv((o) => ({ ...o, [v.vin]: { ...o[v.vin], status: "At dealer" } }));
					setDisp((l) => l.map((x) => (x.vins.includes(v.vin) ? { ...x, status: "Delivered" } : x)));
					toast(`${v.dealer} confirmed receipt of ${v.vin}`);
				}}>Confirm received at dealer</button></div></div>
		);
	}
	if (v.status === "At dealer") {
		const save = (e: FormEvent) => {
			e.preventDefault();
			if (!sale.customer.trim() || !/^[0-9]{10}$/.test(sale.phone) || !/^[A-Z]{2}-[0-9A-Z]{2}-[A-Z]{1,3}-[0-9]{4}$/.test(sale.reg.toUpperCase())) {
				setErr("Add the customer name, a 10-digit mobile number and a registration like KA-01-EV-1234."); return;
			}
			const reg = sale.reg.toUpperCase();
			setOv((o) => ({ ...o, [v.vin]: { ...o[v.vin], status: "Sold", customer: sale.customer, phone: sale.phone, reg, saleDate: "08 Oct 2026", regDate: "08 Oct 2026", rto: rtoFor(reg), insurer: sale.insurer, policy: sale.policy || `POL-${Math.floor(Math.random() * 900000) + 100000}`, insExpiry: "07 Oct 2027", warranty: "Active · till 08 Oct 2029", odo: 2 } }));
			setErr(null);
			toast(`Sale recorded — warranty started for ${v.vin}, telematics activated`);
		};
		return (
			<form className="pick-box rec-form" onSubmit={save} noValidate>
				<b>Record sale and registration</b>
				<label htmlFor="vs-c"><span>Customer name</span><input id="vs-c" className="search" value={sale.customer} onChange={(e) => setSale({ ...sale, customer: e.target.value })} /></label>
				<div className="form-row">
					<label htmlFor="vs-p"><span>Mobile</span><input id="vs-p" className="search" inputMode="numeric" value={sale.phone} placeholder="10 digits" onChange={(e) => setSale({ ...sale, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
					<label htmlFor="vs-r"><span>Registration no.</span><input id="vs-r" className="search" value={sale.reg} placeholder="KA-01-EV-1234" onChange={(e) => setSale({ ...sale, reg: e.target.value })} /></label>
				</div>
				<div className="form-row">
					<label htmlFor="vs-i"><span>Insurer</span><select id="vs-i" value={sale.insurer} onChange={(e) => setSale({ ...sale, insurer: e.target.value })}><option>Shield General Insurance</option><option>Bharat Motor Insurance</option><option>Suraksha Insurance</option></select></label>
					<label htmlFor="vs-pol"><span>Policy no. (optional)</span><input id="vs-pol" className="search" value={sale.policy} onChange={(e) => setSale({ ...sale, policy: e.target.value })} /></label>
				</div>
				{err && <p className="form-err" role="alert">{err}</p>}
				<div className="row-btns"><button className="btn sm" type="submit">Record sale</button></div>
			</form>
		);
	}
	return null;
}

// ---------- Allocate & dispatch ----------
function DispatchTab({ list }: { list: V[] }) {
	const [, setOv] = useOverrides();
	const [disp, setDisp] = useDispatches();
	const fg = list.filter((v) => v.status === "Finished goods");
	const [picked, setPicked] = useState<string[]>([]);
	const [dealer, setDealer] = useState(dealers[0].name);
	const [truck, setTruck] = useState("KA-51-AB-2231");
	const create = () => {
		if (!picked.length) { toast("Tick at least one vehicle to dispatch"); return; }
		if (!truck.trim()) { toast("Add the truck number"); return; }
		const no = `DSP-${2300 + disp.length}`;
		const city = dealers.find((d) => d.name === dealer)!.city;
		setDisp((l) => [{ no, dealer, vins: picked, truck, date: "08 Oct 2026", status: "In transit" }, ...l]);
		setOv((o) => ({ ...o, ...Object.fromEntries(picked.map((vin) => [vin, { ...o[vin], status: "Dispatched", dealer, dispatch: no, city }])) }));
		toast(`${no}: ${picked.length} vehicle${picked.length > 1 ? "s" : ""} on truck ${truck} to ${dealer} — dispatch note and e-way bill ready`);
		setPicked([]);
	};
	const receive = (d: Dispatch) => {
		setDisp((l) => l.map((x) => (x.no === d.no ? { ...x, status: "Delivered" } : x)));
		setOv((o) => ({ ...o, ...Object.fromEntries(d.vins.map((vin) => [vin, { ...o[vin], status: "At dealer" }])) }));
		toast(`${d.dealer} confirmed receipt of ${d.vins.length} vehicle${d.vins.length > 1 ? "s" : ""} (${d.no})`);
	};
	return (
		<div className="split">
			<div>
				<h3 className="mini">Ready in the finished goods yard</h3>
				{fg.length ? (
					<ul className="pick-list">
						{fg.map((v) => (
							<li key={v.vin}><label><input type="checkbox" checked={picked.includes(v.vin)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, v.vin] : p.filter((x) => x !== v.vin)))} />
								<span><b>{v.vin}</b><small>{v.model} · {v.colour} · battery {v.battery}</small></span></label></li>
						))}
					</ul>
				) : <p className="empty">The yard is empty. Vehicles appear here after they pass the end-of-line test.</p>}
				<div className="form-row" style={{ marginTop: 12 }}>
					<label className="inline-col" htmlFor="dp-d"><span>Dealer</span><select id="dp-d" value={dealer} onChange={(e) => setDealer(e.target.value)}>{dealers.map((d) => <option key={d.code} value={d.name}>{d.name} · {d.city}</option>)}</select></label>
					<label className="inline-col" htmlFor="dp-t"><span>Truck no.</span><input id="dp-t" className="search" value={truck} onChange={(e) => setTruck(e.target.value)} /></label>
				</div>
				<div className="row-btns"><button className="btn" onClick={create}>Create dispatch ({picked.length})</button></div>
			</div>
			<div>
				<h3 className="mini">Dispatches</h3>
				<Table dense cols={[
					{ key: "no", label: "Dispatch" }, { key: "dealer", label: "Dealer" }, { key: "n", label: "Vehicles", num: true, render: (r: Dispatch) => r.vins.length },
					{ key: "truck", label: "Truck", hideSm: true },
					{ key: "status", label: "Status", render: (r: Dispatch) => <Badge tone={r.status === "Delivered" ? "good" : "info"}>{r.status}</Badge> },
					{ key: "a", label: "", render: (r: Dispatch) => (r.status === "In transit" ? <button className="btn sm ghost" onClick={() => receive(r)}>Confirm receipt</button> : null) },
				]} rows={disp} />
			</div>
		</div>
	);
}

// ---------- Location ----------
function LocationTab({ list, onOpen }: { list: V[]; onOpen: (vin: string) => void }) {
	const live = list.filter((v) => v.status === "Sold" || v.status === "In service").map((v) => ({ v, d: detail(v) }));
	const cities = Array.from(new Set(live.map((x) => x.v.city)));
	const withAlerts = live.filter((x) => x.d.loc!.alerts.length);
	return (
		<>
			<div className="city-cards">
				{cities.map((c) => {
					const here = live.filter((x) => x.v.city === c);
					return (
						<div key={c} className="city-card"><b>{c}</b><span>{here.length} on the road</span>
							<small>{here.filter((x) => x.d.loc!.speed).length} moving · {here.filter((x) => x.d.loc!.alerts.length).length} with alerts</small></div>
					);
				})}
			</div>
			<p className="hint">Updated from each vehicle's telematics unit. {withAlerts.length} vehicles need attention.</p>
			<Table dense cols={[
				{ key: "vin", label: "Vehicle", render: (x: { v: V }) => <>{x.v.reg}<small className="sub"> · {x.v.model}</small></> },
				{ key: "place", label: "Last location", render: (x: { d: ReturnType<typeof detail> }) => x.d.loc!.place },
				{ key: "ping", label: "Updated", hideSm: true, render: (x: { d: ReturnType<typeof detail> }) => x.d.loc!.ping },
				{ key: "soc", label: "Battery", hideSm: true, render: (x: { d: ReturnType<typeof detail> }) => <Cell pct={x.d.loc!.soc} size="sm" label={`${x.d.loc!.soc}%`} /> },
				{ key: "odo", label: "Odometer", num: true, hideSm: true, render: (x: { v: V }) => `${x.v.odo.toLocaleString("en-IN")} km` },
				{ key: "al", label: "Alerts", render: (x: { d: ReturnType<typeof detail> }) => (x.d.loc!.alerts.length ? <Badge tone="warn">{x.d.loc!.alerts[0]}</Badge> : <span className="sub">None</span>) },
			]} rows={live} onRow={(x) => onOpen(x.v.vin)} />
		</>
	);
}

// ---------- Lifecycle report ----------
function LifecycleTab({ list }: { list: V[] }) {
	const st = ["In production", "Finished goods", "Dispatched", "At dealer", "Sold", "In service"] as const;
	const chartStages = ["Finished goods", "Dispatched", "At dealer", "Sold", "In service"] as const;
	const tones = ["info", "warn", "muted", "accent", "dark"];
	const scale = 37; // sample rows stand for the full fleet
	const by = (m: string, s: string) => list.filter((v) => v.model === m && v.status === s).length * scale;
	const rows = models.map((m) => ({ m, built: st.reduce((a, s) => a + (s === "In production" ? 0 : by(m, s)), 0), ...Object.fromEntries(st.map((s) => [s, by(m, s)])) }) as Record<string, number | string>);
	return (
		<div className="split">
			<div>
				<h3 className="mini">Vehicles by model and stage</h3>
				<Chart labels={[...models]} stacked series={chartStages.map((s, i) => ({ name: s, values: models.map((m) => by(m, s)), tone: tones[i] }))} />
			</div>
			<div>
				<h3 className="mini">Lifecycle summary</h3>
				<Table dense cols={[
					{ key: "m", label: "Model" }, { key: "built", label: "Built", num: true },
					{ key: "Dispatched", label: "In transit", num: true, hideSm: true }, { key: "At dealer", label: "At dealer", num: true },
					{ key: "Sold", label: "Sold", num: true }, { key: "In service", label: "In service", num: true, hideSm: true },
				]} rows={rows} />
				<div className="row-btns"><button className="btn ghost sm" onClick={() => toast("Vehicle lifecycle report exported to Excel")}>Excel</button><button className="btn ghost sm" onClick={() => toast("Vehicle lifecycle report exported to PDF")}>PDF</button></div>
			</div>
		</div>
	);
}
