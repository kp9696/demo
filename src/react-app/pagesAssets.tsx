import { useMemo, useState } from "react";
import { damage, batteries, batteryHistory, vehicles, swapStations, swapDaily, swapTransactions, cities, inr, lakh, sum } from "./data";
import type { Battery, Vehicle } from "./data";
import { Page, Panel, Stat, Stats, Badge, Table, Chart, HBars, Cell, Tabs, Drawer, Facts, Timeline, Search, toast } from "./ui";

// ================= Batteries =================
const batFilters = ["All", "In vehicle", "Charging", "Ready at station", "In transit", "Service", "End of life"] as const;
export function Batteries() {
	const [f, setF] = useState<(typeof batFilters)[number]>("All");
	const [q, setQ] = useState("");
	const [sel, setSel] = useState<Battery | null>(null);
	const rows = useMemo(() => batteries.filter((b) => (f === "All" || b.status === f) && (b.id + b.rfid + (b.vehicle ?? "")).toLowerCase().includes(q.toLowerCase())), [f, q]);
	const count = (s: Battery["status"]) => batteries.filter((b) => b.status === s).length * 120;
	const total = batteries.length * 120;
	const sohBands = [["95–100%", 95, 100], ["90–94%", 90, 94], ["85–89%", 85, 89], ["80–84%", 80, 84], ["Below 80%", 0, 79]] as const;
	return (
		<Page title="Battery management" sub="Every pack, from cell batch to recycling — synced from the BMS every 15 minutes"
			actions={<button className="btn" onClick={() => toast("Allocation BA-1171 created for 40 packs")}>Allocate batteries</button>}>
			<Stats>
				<Stat label="Total packs" value={total.toLocaleString("en-IN")} delta="48V 50Ah LFP" />
				<Stat label="In vehicles" value={count("In vehicle").toLocaleString("en-IN")} delta={`${Math.round((count("In vehicle") / total) * 100)}% utilisation`} tone="good" />
				<Stat label="At swap stations" value={(count("Charging") + count("Ready at station")).toLocaleString("en-IN")} delta={`${count("Ready at station")} charged and ready`} />
				<Stat label="Average health" value={`${Math.round(sum(batteries.map((b) => b.soh)) / batteries.length)}%`} delta={`${count("End of life")} packs at end of life`} tone="warn" />
			</Stats>
			<div className="grid-2">
				<Panel title="Where the packs are">
					<HBars rows={(["In vehicle", "Charging", "Ready at station", "In transit", "Service", "End of life"] as const).map((s) => ({ label: s, value: count(s) }))} fmt={(n) => n.toLocaleString("en-IN")} tone="info" />
				</Panel>
				<Panel title="State of health" note="Packs below 80% move to second-life or recycling">
					<HBars rows={sohBands.map(([label, a, b]) => ({ label, value: batteries.filter((x) => x.soh >= a && x.soh <= b).length * 120 }))} fmt={(n) => n.toLocaleString("en-IN")} />
				</Panel>
			</div>
			<Panel right={
				<div className="filters">
					<Search value={q} onChange={setQ} placeholder="Battery ID, RFID or VIN" />
					<select value={f} onChange={(e) => setF(e.target.value as typeof f)} aria-label="Status">{batFilters.map((x) => <option key={x}>{x}</option>)}</select>
				</div>
			}>
				<Table cols={[
					{ key: "id", label: "Battery" },
					{ key: "soh", label: "Health", render: (r: Battery) => <Cell pct={r.soh} /> },
					{ key: "soc", label: "Charge", hideSm: true, render: (r: Battery) => <Cell pct={r.soc} size="sm" label={`${r.soc}%`} /> },
					{ key: "cycles", label: "Cycles", num: true, hideSm: true },
					{ key: "location", label: "Location", hideSm: true, render: (r: Battery) => r.vehicle ?? r.location },
					{ key: "status", label: "Status", render: (r: Battery) => <Badge>{r.status}</Badge> },
				]} rows={rows} onRow={setSel} />
				{rows.length === 0 && <p className="empty">No packs match. Try a different status or clear the search.</p>}
			</Panel>
			<Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.id ?? ""} sub={sel ? `RFID ${sel.rfid}` : ""}>
				{sel && (
					<>
						<div className="drawer-hero">
							<Cell pct={sel.soh} size="lg" label={`${sel.soh}% health`} />
							<Badge>{sel.status}</Badge>
						</div>
						<Facts rows={[
							["Chemistry / rating", `${sel.chem} · ${sel.capacity}`], ["Charge now", `${sel.soc}%`], ["Charge cycles", sel.cycles.toLocaleString("en-IN")],
							["Pack temperature", `${sel.temp} °C`], ["Location", sel.vehicle ? `${sel.vehicle} (on road)` : sel.location],
							["Manufactured", sel.mfg], ["Warranty until", sel.warrantyTill], ["Cell batch", "LC-2502-17"],
						]} />
						<h3 className="mini">Lifecycle</h3>
						<Timeline items={batteryHistory} />
					</>
				)}
			</Drawer>
		</Page>
	);
}

// ================= Vehicles =================
const vStages = ["All", "In production", "Finished goods", "Dispatched", "At dealer", "Sold", "In service"] as const;
export function Vehicles() {
	const [f, setF] = useState<(typeof vStages)[number]>("All");
	const [q, setQ] = useState("");
	const [sel, setSel] = useState<Vehicle | null>(null);
	const rows = vehicles.filter((v) => (f === "All" || v.status === f) && (v.vin + v.reg + v.customer).toLowerCase().includes(q.toLowerCase()));
	return (
		<Page title="Vehicles" sub="One digital record per vehicle, from the first part fitted to the latest service">
			<Stats>
				<Stat label="Built (FY to date)" value="31,482" delta="+18% vs last year" tone="good" />
				<Stat label="In production" value="90" delta="Line 1 and Line 2" />
				<Stat label="Dispatched this month" value="1,936" delta="To 5 dealers" />
				<Stat label="Under warranty" value="24,110" delta="37 open claims" tone="warn" />
			</Stats>
			<Panel right={
				<div className="filters">
					<Search value={q} onChange={setQ} placeholder="VIN, registration or customer" />
					<select value={f} onChange={(e) => setF(e.target.value as typeof f)} aria-label="Stage">{vStages.map((x) => <option key={x}>{x}</option>)}</select>
				</div>
			}>
				<Table cols={[
					{ key: "vin", label: "VIN" },
					{ key: "model", label: "Model", render: (r: Vehicle) => <>{r.model}<small className="sub"> · {r.colour}</small></> },
					{ key: "battery", label: "Battery", hideSm: true },
					{ key: "dealer", label: "Dealer", hideSm: true },
					{ key: "reg", label: "Registration", hideSm: true },
					{ key: "status", label: "Stage", render: (r: Vehicle) => <Badge>{r.status}</Badge> },
				]} rows={rows} onRow={setSel} />
				{rows.length === 0 && <p className="empty">No vehicles match. Clear the search or pick another stage.</p>}
			</Panel>
			<Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.model ?? ""} sub={sel?.vin}>
				{sel && <VehicleRecord v={sel} />}
			</Drawer>
		</Page>
	);
}
function VehicleRecord({ v }: { v: Vehicle }) {
	const [tab, setTab] = useState<"Overview" | "Components" | "History" | "Damage & repairs">("Overview");
	return (
		<>
			<Tabs tabs={["Overview", "Components", "History", "Damage & repairs"] as const} value={tab} onChange={setTab} />
			{tab === "Overview" && (
				<Facts rows={[
					["Stage", <Badge>{v.status}</Badge>], ["Colour", v.colour], ["Manufactured", `${v.mfg}, Hosur Line 1`], ["Battery fitted", v.battery],
					["Dealer", v.dealer], ["Customer", v.customer], ["Registration", v.reg], ["Odometer", `${v.odo.toLocaleString("en-IN")} km`],
					["Warranty", v.warranty], ["Telematics", v.status === "Sold" ? `Last ping 4 min ago · ${v.city}` : "Not active"],
				]} />
			)}
			{tab === "Components" && (
				<Table dense cols={[{ key: "p", label: "Component" }, { key: "s", label: "Serial / batch" }, { key: "v", label: "Vendor" }]} rows={[
					{ p: "Hub motor 2.5 kW", s: "HM25-88310", v: "Shakti Motors" },
					{ p: "Motor controller 48V", s: "MC48-55102", v: "NexBoard" },
					{ p: "Main frame", s: "FR-S1-26-04417", v: "Precision Frames" },
					{ p: "TFT cluster 5in", s: "TFT5-20931", v: "NexBoard" },
					{ p: "IoT telematics unit", s: "IOT-77120", v: "NexBoard" },
					{ p: "Tyres (2)", s: "Batch RT-2609-B", v: "Rapid Tyres" },
					{ p: "Battery pack", s: v.battery, v: "Voltcell Energy" },
				]} />
			)}
			{tab === "Damage & repairs" && (v.odo > 0 ? <Timeline items={damage} /> : <p className="empty">No accident or damage records. Records appear here when a dealer logs one on a job card.</p>)}
			{tab === "History" && (
				<Timeline items={[
					...(v.status === "In service" ? [{ when: "08 Oct", what: "In for service", where: "Dealer workshop", detail: "JC-31204 · range complaint" }] : []),
					...(v.odo > 0 ? [{ when: "21 Sep", what: "Battery swapped", where: "Koramangala 5th Block", detail: "Swap #41 for this vehicle" }, { when: "02 Sep", what: "First service", detail: "1,000 km check · no issues" }, { when: "11 Aug", what: "Sold & registered", detail: `${v.customer} · ${v.reg}` }] : []),
					...(v.dealer !== "—" ? [{ when: "02 Aug", what: "Delivered to dealer", where: v.dealer }] : []),
					{ when: v.mfg, what: "End-of-line test passed", detail: "EOL-31984 · brake, lights, range sim" },
					{ when: v.mfg, what: "Assembled", where: "Hosur Line 1", detail: "26 components scanned in" },
				]} />
			)}
		</>
	);
}

// ================= Swap network & revenue =================
export function Swap() {
	const [tab, setTab] = useState<"Stations" | "Transactions" | "Revenue">("Stations");
	const [city, setCity] = useState("All cities");
	const st = swapStations.filter((s) => city === "All cities" || s.city === city);
	const swapsToday = sum(swapStations.map((s) => s.swapsToday));
	const monthRev = sum(swapDaily.map((d) => d.revenue));
	return (
		<Page title="Swap network" sub="8 stations · 160 slots · live battery stock and swap revenue"
			actions={<button className="btn" onClick={() => toast("Rebalancing plan sent: 12 packs Koramangala → HSR")}>Rebalance batteries</button>}>
			<Stats>
				<Stat label="Swaps today" value={swapsToday.toLocaleString("en-IN")} delta="+6.2% vs last Thursday" tone="good" />
				<Stat label="Revenue today" value={inr(swapsToday * 62)} delta="₹62 average per swap" />
				<Stat label="Revenue (30 days)" value={lakh(monthRev)} delta="+11% month on month" tone="good" />
				<Stat label="Stations low on charged packs" value="2" delta="HSR Layout, Kharadi" tone="bad" />
			</Stats>
			<Panel right={
				<div className="filters">
					<Tabs tabs={["Stations", "Transactions", "Revenue"] as const} value={tab} onChange={setTab} />
					{tab === "Stations" && <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City"><option>All cities</option>{cities.slice(0, 4).map((c) => <option key={c}>{c}</option>)}</select>}
				</div>
			}>
				{tab === "Stations" && (
					<>
					<p className="slot-legend"><span><i className="r" />Charged and ready</span><span><i className="c" />Charging</span><span><i className="f" />Faulty</span><span><i />Empty slot</span></p>
					<div className="station-grid">
						{st.map((s) => (
							<article key={s.id} className={`station ${s.ready / s.slots < 0.2 ? "short" : ""}`}>
								<header><h3>{s.name}</h3><small>{s.id} · {s.city}</small></header>
								<div className="slots" aria-label={`${s.ready} ready, ${s.charging} charging, ${s.faulty} faulty of ${s.slots}`}>
									{Array.from({ length: s.slots }, (_, i) => (
										<i key={i} className={i < s.ready ? "r" : i < s.ready + s.charging ? "c" : i < s.ready + s.charging + s.faulty ? "f" : ""} />
									))}
								</div>
								<div className="station-foot">
									<span><b>{s.ready}</b> ready</span><span><b>{s.charging}</b> charging</span><span><b>{s.swapsToday}</b> swaps today</span><span><b>{s.uptime}%</b> uptime</span>
								</div>
							</article>
						))}
					</div>
					</>
				)}
				{tab === "Transactions" && (
					<Table cols={[
						{ key: "time", label: "Time" }, { key: "id", label: "Swap", hideSm: true }, { key: "station", label: "Station" },
						{ key: "vehicle", label: "Vehicle", hideSm: true },
						{ key: "out", label: "Returned", hideSm: true, render: (r) => <>{r.out} <small className="sub">{r.outSoc}%</small></> },
						{ key: "in", label: "Issued", hideSm: true, render: (r) => <>{r.in} <small className="sub">{r.inSoc}%</small></> },
						{ key: "amount", label: "Amount", num: true, render: (r) => inr(r.amount) },
						{ key: "pay", label: "Paid by", hideSm: true },
					]} rows={swapTransactions} />
				)}
				{tab === "Revenue" && (
					<>
						<Chart labels={swapDaily.map((d) => d.day)} fmt={inr} series={[{ name: "Revenue per day", values: swapDaily.map((d) => d.revenue), tone: "accent" }]} />
						<div className="split">
							<div>
								<h3 className="mini">Revenue by station (today)</h3>
								<HBars rows={swapStations.map((s) => ({ label: s.name, value: s.swapsToday * 62 }))} fmt={inr} />
							</div>
							<Facts rows={[
								["Transactions (30 days)", sum(swapDaily.map((d) => d.swaps)).toLocaleString("en-IN")],
								["Average revenue per station / day", inr(Math.round(monthRev / 30 / 8))],
								["Subscription share", "41%"], ["Fleet credit outstanding", inr(184600)],
								["Reconciled with accounts", <Badge tone="good">Up to 07 Oct</Badge>],
							]} />
						</div>
					</>
				)}
			</Panel>
		</Page>
	);
}
