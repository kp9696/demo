// Sample data for the customer demo. Everything here is generated, not real.

let seed = 42;
function rnd() {
	seed = (seed * 16807) % 2147483647;
	return (seed - 1) / 2147483646;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

export const cities = ["Bengaluru", "Pune", "Chennai", "Hyderabad", "Delhi NCR", "Ahmedabad"] as const;
export const models = ["E-Ride S1", "E-Ride S1 Pro", "Cargo C2", "E-Ride Lite"] as const;
export const colours = ["Graphite", "Pearl White", "Volt Green", "Ocean Blue", "Crimson"] as const;

// ---------- Inventory ----------
export type Item = {
	code: string; name: string; category: string; uom: string; warehouse: string; bin: string;
	onHand: number; min: number; max: number; reorder: number; unitCost: number; ageDays: number;
	tracking: "Serial" | "Batch" | "None"; rfid: boolean;
};
const itemDefs: [string, string, string, number, Item["tracking"]][] = [
	["Hub motor 2.5 kW", "Drivetrain", "EA", 14200, "Serial"],
	["Motor controller 48V", "Electronics", "EA", 6800, "Serial"],
	["LFP cell 3.2V 50Ah", "Battery", "EA", 1450, "Batch"],
	["BMS board v4", "Battery", "EA", 2900, "Serial"],
	["Battery enclosure (Al)", "Battery", "EA", 1850, "Batch"],
	["Main frame — S1", "Chassis", "EA", 5200, "Serial"],
	["Front fork assembly", "Chassis", "EA", 2350, "Batch"],
	["Rear shock absorber", "Chassis", "EA", 1100, "Batch"],
	["Disc brake kit 220mm", "Brakes", "EA", 1650, "Batch"],
	["Tyre 90/90-12 tubeless", "Wheels", "EA", 1280, "Batch"],
	["Alloy wheel 12in", "Wheels", "EA", 1900, "Batch"],
	["TFT cluster 5in", "Electronics", "EA", 4200, "Serial"],
	["Wiring harness main", "Electronics", "EA", 1750, "Batch"],
	["DC-DC converter", "Electronics", "EA", 980, "Serial"],
	["Headlamp LED unit", "Lighting", "EA", 1350, "Batch"],
	["Tail lamp LED unit", "Lighting", "EA", 620, "Batch"],
	["Seat assembly", "Body", "EA", 1450, "Batch"],
	["Body panel set — Graphite", "Body", "SET", 3900, "Batch"],
	["Side stand", "Chassis", "EA", 240, "None"],
	["M8 flange bolt", "Fasteners", "BOX", 380, "None"],
	["Thermal pad 2mm", "Battery", "ROLL", 760, "Batch"],
	["Charger 48V 10A", "Accessories", "EA", 3400, "Serial"],
	["IoT telematics unit", "Electronics", "EA", 2600, "Serial"],
	["Brake pad set", "Brakes", "SET", 420, "Batch"],
];
export const warehouses = ["Central WH — Hosur", "Plant line-side", "Pune site WH", "Chennai service WH"];
export const items: Item[] = itemDefs.map(([name, category, uom, unitCost, tracking], i) => {
	const max = int(400, 2000);
	const min = Math.round(max * 0.2);
	const reorder = Math.round(max * 0.35);
	let onHand = int(Math.round(min * 0.5), Math.round(max * 1.3));
	if (i === 3 || i === 11) onHand = Math.round(min * 0.6);
	if (i === 18) onHand = Math.round(max * 1.6);
	return {
		code: `MAT-${(1001 + i * 7).toString()}`, name, category, uom,
		warehouse: i % 5 === 4 ? warehouses[2] : warehouses[0],
		bin: `${pick(["A", "B", "C", "D"])}-${int(1, 12).toString().padStart(2, "0")}-${int(1, 6)}`,
		onHand, min, max, reorder, unitCost,
		ageDays: i === 18 || i === 19 ? int(190, 260) : i === 16 ? 140 : int(4, 85),
		tracking, rfid: tracking !== "None",
	};
});

// ---------- Procurement ----------
export const vendors = [
	{ name: "Voltcell Energy Pvt Ltd", category: "Battery cells", city: "Chennai", otd: 96, quality: 98.7, rating: 4.7, spend: 4.82 },
	{ name: "Shakti Motors & Drives", category: "Motors", city: "Pune", otd: 91, quality: 97.9, rating: 4.4, spend: 3.15 },
	{ name: "Precision Frames India", category: "Chassis", city: "Hosur", otd: 88, quality: 96.2, rating: 4.1, spend: 2.07 },
	{ name: "Lumio Auto Electricals", category: "Lighting", city: "Gurugram", otd: 94, quality: 99.1, rating: 4.6, spend: 0.84 },
	{ name: "Rapid Tyres Ltd", category: "Wheels & tyres", city: "Chennai", otd: 82, quality: 95.4, rating: 3.8, spend: 1.12 },
	{ name: "NexBoard Electronics", category: "Electronics", city: "Bengaluru", otd: 90, quality: 97.2, rating: 4.3, spend: 2.46 },
];
export type PO = { no: string; vendor: string; items: string; value: number; date: string; due: string; status: string; received: number };
const poStatuses = ["Draft", "Pending approval", "Approved", "Dispatched", "Partially received", "Received", "Inspected"];
export const purchaseOrders: PO[] = Array.from({ length: 14 }, (_, i) => {
	const v = vendors[i % vendors.length];
	const status = poStatuses[(i * 3 + 1) % poStatuses.length];
	return {
		no: `PO-26-${(4120 + i).toString()}`, vendor: v.name,
		items: pick(itemDefs)[0], value: int(180, 2400) * 1000,
		date: `${int(1, 28)} Sep 2026`, due: `${int(8, 30)} Oct 2026`, status,
		received: status === "Received" || status === "Inspected" ? 100 : status === "Partially received" ? int(30, 80) : 0,
	};
});
export const requisitions = [
	{ no: "PR-1882", item: "LFP cell 3.2V 50Ah", qty: 12000, by: "Production planning", need: "18 Oct", status: "Pending approval" },
	{ no: "PR-1883", item: "BMS board v4", qty: 800, by: "Stores — Hosur", need: "15 Oct", status: "Pending approval" },
	{ no: "PR-1879", item: "TFT cluster 5in", qty: 600, by: "Stores — Hosur", need: "20 Oct", status: "RFQ sent" },
	{ no: "PR-1876", item: "Brake pad set", qty: 1500, by: "Service — Chennai", need: "22 Oct", status: "Converted to PO" },
];
export const quotes = {
	item: "BMS board v4 × 800",
	rows: [
		{ vendor: "NexBoard Electronics", price: 2860, lead: 12, terms: "45 days", warranty: "24 mo", score: 88 },
		{ vendor: "Voltcell Energy Pvt Ltd", price: 2940, lead: 9, terms: "30 days", warranty: "24 mo", score: 84 },
		{ vendor: "Kirana Embedded Systems", price: 2710, lead: 21, terms: "30 days", warranty: "12 mo", score: 71 },
	],
};

// ---------- Production ----------
export const productionWeek = [
	{ day: "Mon", plan: 220, actual: 214 },
	{ day: "Tue", plan: 220, actual: 223 },
	{ day: "Wed", plan: 240, actual: 228 },
	{ day: "Thu", plan: 240, actual: 236 },
	{ day: "Fri", plan: 240, actual: 219 },
	{ day: "Sat", plan: 180, actual: 182 },
];
export const stations = [
	{ name: "Frame & fork", wip: 18, cycle: 4.1, target: 4.3, status: "Running" },
	{ name: "Motor & drivetrain", wip: 22, cycle: 4.6, target: 4.3, status: "Slow" },
	{ name: "Electricals & harness", wip: 15, cycle: 4.0, target: 4.3, status: "Running" },
	{ name: "Body panels", wip: 12, cycle: 3.9, target: 4.3, status: "Running" },
	{ name: "Battery fit & pairing", wip: 9, cycle: 4.2, target: 4.3, status: "Running" },
	{ name: "End-of-line test", wip: 14, cycle: 5.1, target: 4.3, status: "Down 22 min" },
];
export const workOrders = [
	{ no: "WO-7731", model: "E-Ride S1 Pro", qty: 120, done: 96, line: "Line 1", due: "08 Oct", status: "In progress" },
	{ no: "WO-7732", model: "E-Ride S1", qty: 150, done: 150, line: "Line 2", due: "08 Oct", status: "Completed" },
	{ no: "WO-7733", model: "Cargo C2", qty: 60, done: 21, line: "Line 1", due: "09 Oct", status: "In progress" },
	{ no: "WO-7734", model: "E-Ride Lite", qty: 140, done: 0, line: "Line 2", due: "09 Oct", status: "Material short" },
	{ no: "WO-7735", model: "E-Ride S1", qty: 150, done: 0, line: "Line 2", due: "10 Oct", status: "Released" },
];
export const bom = [
	{ level: 1, part: "E-Ride S1 Pro — complete vehicle", qty: 1 },
	{ level: 2, part: "Main frame — S1", qty: 1 },
	{ level: 2, part: "Drivetrain assembly", qty: 1 },
	{ level: 3, part: "Hub motor 2.5 kW", qty: 1 },
	{ level: 3, part: "Motor controller 48V", qty: 1 },
	{ level: 2, part: "Electrical assembly", qty: 1 },
	{ level: 3, part: "Wiring harness main", qty: 1 },
	{ level: 3, part: "TFT cluster 5in", qty: 1 },
	{ level: 3, part: "IoT telematics unit", qty: 1 },
	{ level: 2, part: "Wheel set", qty: 1 },
	{ level: 3, part: "Alloy wheel 12in", qty: 2 },
	{ level: 3, part: "Tyre 90/90-12 tubeless", qty: 2 },
	{ level: 2, part: "Body panel set", qty: 1 },
	{ level: 2, part: "Battery pack 48V 50Ah (allocated)", qty: 1 },
];
export const quality = [
	{ defect: "Harness connector loose", count: 14 },
	{ defect: "Panel gap out of spec", count: 9 },
	{ defect: "Brake bleed incomplete", count: 6 },
	{ defect: "Cluster pairing failed", count: 5 },
	{ defect: "Paint scratch", count: 4 },
];

// ---------- Batteries ----------
export type Battery = {
	id: string; rfid: string; chem: string; capacity: string; soh: number; soc: number; cycles: number;
	status: "In vehicle" | "Charging" | "Ready at station" | "In transit" | "Service" | "End of life";
	location: string; vehicle?: string; warrantyTill: string; temp: number; mfg: string;
};
const batStatuses: Battery["status"][] = ["In vehicle", "In vehicle", "In vehicle", "Charging", "Ready at station", "Ready at station", "In transit", "Service"];
export const swapStations = [
	{ id: "SS-BLR-01", name: "Koramangala 5th Block", city: "Bengaluru", slots: 24, ready: 17, charging: 6, faulty: 1, swapsToday: 312, uptime: 99.4 },
	{ id: "SS-BLR-02", name: "HSR Layout Sector 2", city: "Bengaluru", slots: 24, ready: 4, charging: 19, faulty: 1, swapsToday: 288, uptime: 98.9 },
	{ id: "SS-BLR-03", name: "Whitefield ITPL Road", city: "Bengaluru", slots: 16, ready: 11, charging: 5, faulty: 0, swapsToday: 196, uptime: 99.8 },
	{ id: "SS-BLR-04", name: "Indiranagar 100ft Rd", city: "Bengaluru", slots: 16, ready: 9, charging: 6, faulty: 1, swapsToday: 241, uptime: 97.6 },
	{ id: "SS-PNQ-01", name: "Hinjewadi Phase 1", city: "Pune", slots: 24, ready: 15, charging: 8, faulty: 1, swapsToday: 205, uptime: 99.1 },
	{ id: "SS-PNQ-02", name: "Kharadi EON IT Park", city: "Pune", slots: 16, ready: 2, charging: 13, faulty: 1, swapsToday: 174, uptime: 98.2 },
	{ id: "SS-MAA-01", name: "OMR Thoraipakkam", city: "Chennai", slots: 24, ready: 19, charging: 5, faulty: 0, swapsToday: 158, uptime: 99.6 },
	{ id: "SS-HYD-01", name: "HITEC City Cyber Towers", city: "Hyderabad", slots: 16, ready: 13, charging: 3, faulty: 0, swapsToday: 119, uptime: 99.9 },
];
export const batteries: Battery[] = Array.from({ length: 40 }, (_, i) => {
	const status = i === 7 ? "End of life" : batStatuses[i % batStatuses.length];
	const cycles = int(40, 1350);
	const soh = status === "End of life" ? 68 : Math.max(80, Math.round(100 - cycles / 60 - rnd() * 4));
	const st = pick(swapStations);
	return {
		id: `BAT-48-${(20410 + i * 13).toString()}`,
		rfid: `E280-6894-${(3000 + i * 37).toString(16).toUpperCase()}`,
		chem: "LFP", capacity: "48V 50Ah",
		soh, soc: status === "Charging" ? int(20, 80) : status === "Ready at station" ? int(95, 100) : int(15, 90), cycles,
		status,
		location: status === "In vehicle" ? "On road" : status === "In transit" ? `${st.city} → hub` : status === "Service" ? "Battery lab — Hosur" : status === "End of life" ? "Recycling bay" : st.name,
		vehicle: status === "In vehicle" ? `VIN …${(52100 + i * 3).toString()}` : undefined,
		warrantyTill: `${pick(["Mar", "Jun", "Sep", "Dec"])} ${int(2027, 2029)}`,
		temp: int(26, 41), mfg: `${pick(["Jan", "Apr", "Jul", "Oct"])} ${pick([2024, 2025, 2026])}`,
	};
});
export const batteryHistory = [
	{ when: "08 Oct, 09:42", what: "Swapped in", where: "Koramangala 5th Block", detail: "SOC 98% → issued to KA-01-EV-4471" },
	{ when: "08 Oct, 06:10", what: "Charge complete", where: "Koramangala 5th Block", detail: "1 h 52 m, peak 37 °C" },
	{ when: "07 Oct, 21:18", what: "Swapped out", where: "Koramangala 5th Block", detail: "SOC 14% returned by KA-03-EV-1180" },
	{ when: "02 Oct", what: "Health check", where: "BMS sync", detail: "SOH 91%, cell imbalance 18 mV" },
	{ when: "14 Aug", what: "Moved", where: "HSR → Koramangala", detail: "Rebalancing transfer TR-0918" },
	{ when: "11 Mar 2025", what: "Installed", where: "Plant — Hosur", detail: "First fitment to VIN MD9ZS1P25A052104" },
	{ when: "02 Mar 2025", what: "Manufactured", where: "Battery line B", detail: "Cell batch LC-2502-17, RFID tagged" },
];

// ---------- Vehicles ----------
export type Vehicle = {
	vin: string; model: string; colour: string; mfg: string; battery: string; dealer: string; customer: string;
	reg: string; status: string; warranty: string; odo: number; city: string;
};
const vStatuses = ["In production", "Finished goods", "Dispatched", "At dealer", "Sold", "Sold", "Sold", "In service"];
export const dealers = [
	{ code: "DLR-BLR-07", name: "Greenline Motors", city: "Bengaluru", sold: 148, stock: 22, csat: 4.6, openJobs: 9, tat: 6.2, revenue: 8.4 },
	{ code: "DLR-PNQ-03", name: "Sahyadri EV World", city: "Pune", sold: 121, stock: 31, csat: 4.4, openJobs: 12, tat: 7.8, revenue: 6.9 },
	{ code: "DLR-MAA-02", name: "Marina E-Mobility", city: "Chennai", sold: 97, stock: 18, csat: 4.7, openJobs: 5, tat: 5.1, revenue: 5.5 },
	{ code: "DLR-HYD-01", name: "Deccan Electric Wheels", city: "Hyderabad", sold: 84, stock: 26, csat: 4.1, openJobs: 14, tat: 9.4, revenue: 4.7 },
	{ code: "DLR-DEL-05", name: "Capital EV Hub", city: "Delhi NCR", sold: 133, stock: 35, csat: 4.3, openJobs: 11, tat: 8.1, revenue: 7.6 },
];
const firstNames = ["Arjun", "Priya", "Rahul", "Sneha", "Vikram", "Ananya", "Karthik", "Meera", "Rohan", "Divya", "Aditya", "Nisha"];
const lastNames = ["Rao", "Sharma", "Iyer", "Patil", "Reddy", "Nair", "Gupta", "Menon", "Kulkarni", "Shetty"];
export const vehicles: Vehicle[] = Array.from({ length: 30 }, (_, i) => {
	const status = vStatuses[i % vStatuses.length];
	const d = dealers[i % dealers.length];
	const sold = status === "Sold" || status === "In service";
	return {
		vin: `MD9ZS1P26A0${(52100 + i * 3).toString()}`,
		model: models[i % models.length], colour: pick(colours),
		mfg: `${int(1, 28)} ${pick(["Jul", "Aug", "Sep"])} 2026`,
		battery: status === "In production" ? "—" : batteries[(i * 3) % batteries.length].id,
		dealer: status === "In production" || status === "Finished goods" ? "—" : d.name,
		customer: sold ? `${pick(firstNames)} ${pick(lastNames)}` : "—",
		reg: sold ? `${pick(["KA-01", "KA-03", "MH-12", "TN-09", "TS-07", "DL-3S"])}-EV-${int(1000, 9999)}` : "—",
		status, warranty: sold ? "Active · till " + `${pick(["Jul", "Aug", "Sep"])} 2029` : "Not started",
		odo: sold ? int(120, 9800) : 0, city: d.city,
	};
});

// ---------- Swap revenue ----------
export const swapDaily = Array.from({ length: 30 }, (_, i) => {
	const swaps = Math.round(1350 + i * 18 + Math.sin(i / 2.2) * 140 + (i % 7 === 6 ? -180 : 0));
	return { day: `${(i + 9) % 30 + 1}`, swaps, revenue: swaps * 62 };
});
export const swapTransactions = Array.from({ length: 12 }, (_, i) => {
	const st = swapStations[i % swapStations.length];
	return {
		id: `SWP-${(889120 - i * 7).toString()}`, time: `11:${(59 - i * 4).toString().padStart(2, "0")}`,
		station: st.name, vehicle: `KA-0${int(1, 5)}-EV-${int(1000, 9999)}`,
		out: batteries[(i * 5) % 40].id, outSoc: int(8, 24), in: batteries[(i * 5 + 3) % 40].id, inSoc: int(96, 100),
		amount: pick([55, 62, 62, 62, 75]), pay: pick(["UPI", "Wallet", "Subscription", "UPI", "Fleet credit"]),
	};
});

// ---------- Service ----------
export const jobCards = [
	{ no: "JC-31204", vin: "…052118", customer: "Priya Nair", dealer: "Greenline Motors", complaint: "Range dropped to 55 km", tech: "Suresh K", status: "Diagnosis", age: "4 h", warranty: true },
	{ no: "JC-31203", vin: "…052133", customer: "Rohan Kulkarni", dealer: "Sahyadri EV World", complaint: "Brake noise front", tech: "Amit P", status: "Awaiting parts", age: "1 d", warranty: false },
	{ no: "JC-31199", vin: "…052106", customer: "Ananya Reddy", dealer: "Deccan Electric Wheels", complaint: "Cluster blank on start", tech: "Farhan S", status: "In repair", age: "2 d", warranty: true },
	{ no: "JC-31197", vin: "…052145", customer: "Vikram Shetty", dealer: "Capital EV Hub", complaint: "Periodic service — 3000 km", tech: "Deepak R", status: "Ready for delivery", age: "6 h", warranty: false },
	{ no: "JC-31190", vin: "…052121", customer: "Meera Iyer", dealer: "Marina E-Mobility", complaint: "Charger not detecting", tech: "Lokesh M", status: "Closed", age: "3 d", warranty: true },
	{ no: "JC-31188", vin: "…052139", customer: "Karthik Menon", dealer: "Greenline Motors", complaint: "Rear shock leaking", tech: "Suresh K", status: "Warranty approval", age: "2 d", warranty: true },
];
export const warrantyClaims = [
	{ no: "WC-0931", part: "Motor controller 48V", dealer: "Deccan Electric Wheels", amount: 7400, status: "Pending" },
	{ no: "WC-0929", part: "Rear shock absorber", dealer: "Greenline Motors", amount: 1650, status: "Pending" },
	{ no: "WC-0926", part: "Battery pack 48V", dealer: "Sahyadri EV World", amount: 38500, status: "Under review" },
	{ no: "WC-0921", part: "TFT cluster 5in", dealer: "Capital EV Hub", amount: 4900, status: "Approved" },
];
export const complaints = [
	{ cat: "Range / battery", open: 18, closed: 64 },
	{ cat: "Brakes & suspension", open: 9, closed: 41 },
	{ cat: "Electricals", open: 12, closed: 38 },
	{ cat: "Body & paint", open: 4, closed: 22 },
	{ cat: "Swap station experience", open: 7, closed: 29 },
];

// ---------- Finance (₹ crore) ----------
export const pnlMonths = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
export const pnl = {
	vehicleRevenue: [18.2, 19.6, 21.4, 22.8, 24.1, 25.3],
	swapRevenue: [2.1, 2.3, 2.6, 2.8, 3.1, 3.4],
	serviceRevenue: [0.9, 1.0, 1.1, 1.1, 1.2, 1.3],
	sparesRevenue: [0.6, 0.7, 0.7, 0.8, 0.8, 0.9],
	cogs: [16.0, 17.1, 18.4, 19.5, 20.4, 21.2],
	opex: [3.6, 3.7, 3.8, 4.0, 4.1, 4.2],
	budgetRevenue: [21.0, 23.0, 25.0, 27.0, 29.0, 30.5],
};
export const costCentres = [
	{ name: "Manufacturing — Hosur", budget: 12.4, actual: 12.9 },
	{ name: "Swap network operations", budget: 2.2, actual: 2.0 },
	{ name: "After-sales & service", budget: 1.1, actual: 1.15 },
	{ name: "Sales & dealer development", budget: 0.9, actual: 0.82 },
	{ name: "R&D and engineering", budget: 1.6, actual: 1.7 },
	{ name: "Corporate & admin", budget: 0.7, actual: 0.68 },
];

// ---------- Approvals ----------
export type Approval = { id: string; type: string; title: string; by: string; value?: number; age: string; step: string };
export const approvals: Approval[] = [
	{ id: "PR-1882", type: "Purchase requisition", title: "12,000 × LFP cell 3.2V 50Ah", by: "Kavya (Planning)", value: 17400000, age: "2 h", step: "Plant head" },
	{ id: "PO-26-4131", type: "Purchase order", title: "NexBoard Electronics — BMS board v4 × 800", by: "Ravi (Purchase)", value: 2288000, age: "5 h", step: "Finance" },
	{ id: "WC-0926", type: "Warranty approval", title: "Battery pack replacement — VIN …052133", by: "Sahyadri EV World", value: 38500, age: "1 d", step: "Service manager" },
	{ id: "SA-0412", type: "Stock adjustment", title: "Write-off 46 × Tail lamp LED unit (damaged)", by: "Stores — Hosur", value: 28520, age: "1 d", step: "Finance" },
	{ id: "DSP-2291", type: "Vehicle dispatch", title: "36 vehicles → Capital EV Hub", by: "Logistics", age: "3 h", step: "Sales head" },
	{ id: "BA-1170", type: "Battery allocation", title: "120 packs → HSR & Kharadi stations", by: "Swap ops", age: "40 m", step: "Network manager" },
	{ id: "MR-0215", type: "Material return", title: "Return 18 × Motor controller 48V from Line 1 to stores (unused)", by: "Line 1 supervisor", value: 122400, age: "1 h", step: "Stores head" },
	{ id: "SV-1043", type: "Service approval", title: "Out-of-warranty motor repair — JC-31203, estimate ₹9,800", by: "Sahyadri EV World", value: 9800, age: "3 h", step: "Customer + service manager" },
	{ id: "UA-0087", type: "User access", title: "Dealer portal access — Marina E-Mobility (2 users)", by: "IT", age: "2 d", step: "Admin" },
];

// ---------- Material flow (live movements) ----------
export const flowStages = [
	{ key: "supplier", label: "Supplier", count: 6, unit: "POs open" },
	{ key: "po", label: "Purchase order", count: 14, unit: "active" },
	{ key: "dispatch", label: "Dispatch", count: 5, unit: "in transit" },
	{ key: "grn", label: "Goods receipt", count: 3, unit: "today" },
	{ key: "inspection", label: "Inspection", count: 2, unit: "on hold" },
	{ key: "warehouse", label: "Warehouse", count: 24, unit: "SKUs" },
	{ key: "issue", label: "Material issue", count: 11, unit: "issues today" },
	{ key: "assembly", label: "Assembly", count: 90, unit: "vehicles WIP" },
	{ key: "fg", label: "Finished vehicle", count: 214, unit: "in FG yard" },
	{ key: "battery", label: "Battery allocation", count: 38, unit: "awaiting" },
	{ key: "out", label: "Dispatch", count: 36, unit: "loading" },
	{ key: "customer", label: "Dealer / site", count: 5, unit: "dealers" },
];
export const rfidEvents = [
	{ time: "11:04:51", reader: "Gate G1 — Inbound", tag: "E280-6894-0BB8", item: "LFP cell 3.2V 50Ah · batch LC-2610-04", event: "Goods receipt", ok: true },
	{ time: "11:04:12", reader: "Handheld HH-03", tag: "E280-6894-0C2D", item: "Hub motor 2.5 kW · SN HM25-88310", event: "Put-away A-04-2", ok: true },
	{ time: "11:03:40", reader: "Line-side L1-S2", tag: "E280-6894-0C9A", item: "Motor controller · SN MC48-55102", event: "Issued to WO-7731", ok: true },
	{ time: "11:02:58", reader: "Gate G2 — Outbound", tag: "E280-6894-0D11", item: "VIN MD9ZS1P26A052118", event: "Dispatch to Greenline Motors", ok: true },
	{ time: "11:02:31", reader: "Gate G1 — Inbound", tag: "E280-6894-0E02", item: "Unknown tag", event: "Not on any open PO", ok: false },
	{ time: "11:01:09", reader: "Battery bay BB-1", tag: "E280-6894-0F4C", item: "BAT-48-20462", event: "Paired to VIN …052121", ok: true },
];
export const rfidHardware = [
	{ type: "Fixed reader (4-port UHF)", where: "Inbound/outbound gates, line-side", qty: 6, range: "up to 8 m", ip: "IP65", proto: "LLRP over Ethernet / PoE" },
	{ type: "Handheld reader + Android", where: "Stores, cycle count, service bays", qty: 10, range: "up to 6 m", ip: "IP65", proto: "SDK / Wi-Fi, Bluetooth" },
	{ type: "Gate portal antenna pair", where: "Warehouse dock doors", qty: 4, range: "3–4 m portal", ip: "IP67", proto: "Via fixed reader" },
	{ type: "On-metal UHF tag", where: "Motors, frames, battery packs", qty: 25000, range: "up to 5 m", ip: "IP68", proto: "EPC Gen2 / ISO 18000-63" },
	{ type: "Passive label tag", where: "Cartons, bins, boxed spares", qty: 60000, range: "up to 8 m", ip: "—", proto: "EPC Gen2" },
	{ type: "BLE beacon tag", where: "High-value pallets, tools", qty: 150, range: "up to 50 m", ip: "IP67", proto: "Bluetooth Low Energy 5.0" },
];

// ---------- Goods receipt & inspection ----------
export const grns = [
	{ no: "GRN-88140", po: "PO-26-4124", vendor: "Voltcell Energy Pvt Ltd", item: "LFP cell 3.2V 50Ah", qty: 6000, tags: "412 / 412", gate: "Gate G1", time: "08 Oct 10:52", status: "Awaiting inspection" },
	{ no: "GRN-88139", po: "PO-26-4127", vendor: "Rapid Tyres Ltd", item: "Tyre 90/90-12 tubeless", qty: 800, tags: "100 / 100", gate: "Gate G1", time: "08 Oct 09:30", status: "Awaiting inspection" },
	{ no: "GRN-88137", po: "PO-26-4121", vendor: "Shakti Motors & Drives", item: "Hub motor 2.5 kW", qty: 300, tags: "300 / 300", gate: "Gate G1", time: "07 Oct 16:05", status: "Accepted" },
	{ no: "GRN-88135", po: "PO-26-4130", vendor: "Lumio Auto Electricals", item: "Headlamp LED unit", qty: 500, tags: "498 / 500", gate: "Gate G1", time: "07 Oct 11:40", status: "Short received" },
	{ no: "GRN-88131", po: "PO-26-4119", vendor: "Precision Frames India", item: "Main frame — S1", qty: 240, tags: "240 / 240", gate: "Gate G2", time: "06 Oct 15:30", status: "Partly rejected" },
];
export const inspectionPlan = [
	{ check: "Cell voltage within 3.25–3.35 V", sample: "50 cells", result: "" },
	{ check: "Internal resistance below 0.6 mΩ", sample: "50 cells", result: "" },
	{ check: "Batch certificate matches PO", sample: "Document", result: "" },
	{ check: "No dents or swelling", sample: "Visual, 100%", result: "" },
];

// ---------- Stock transfers, counts, reconciliation ----------
export const transfers = [
	{ no: "TR-0931", from: "Central WH — Hosur", to: "Pune site WH", items: "Brake pad set × 400, Tyre × 120", status: "In transit", eta: "09 Oct" },
	{ no: "TR-0930", from: "Central WH — Hosur", to: "Plant line-side", items: "Hub motor × 60, Controller × 60", status: "Delivered", eta: "08 Oct" },
	{ no: "TR-0929", from: "Pune site WH", to: "Chennai service WH", items: "Charger 48V × 25", status: "Pending approval", eta: "11 Oct" },
	{ no: "TR-0927", from: "Central WH — Hosur", to: "Pune site WH", items: "M8 flange bolt × 60 boxes", status: "Delivered", eta: "03 Oct" },
];
export const counts = [
	{ no: "PC-0412", area: "Bins A-01 to A-12", method: "RFID handheld", items: 186, counted: 186, variance: 0, status: "Completed", date: "07 Oct" },
	{ no: "PC-0413", area: "Bins B-01 to B-08", method: "RFID handheld", items: 142, counted: 140, variance: -2, status: "Recount needed", date: "08 Oct" },
	{ no: "PC-0414", area: "Battery bay", method: "Fixed reader sweep", items: 318, counted: 318, variance: 0, status: "Completed", date: "08 Oct" },
	{ no: "PC-0415", area: "Bins C-01 to C-10", method: "Barcode scan", items: 210, counted: 0, variance: 0, status: "Scheduled", date: "09 Oct" },
];
export const recon = [
	{ item: "Tail lamp LED unit", system: 512, physical: 466, diff: -46, value: -28520, reason: "Damaged in storage", status: "Write-off pending" },
	{ item: "Wiring harness main", system: 880, physical: 878, diff: -2, value: -3500, reason: "Issued without scan", status: "Investigating" },
	{ item: "M8 flange bolt", system: 1250, physical: 1262, diff: 12, value: 4560, reason: "Return not booked", status: "Adjusted" },
	{ item: "Brake pad set", system: 640, physical: 640, diff: 0, value: 0, reason: "—", status: "Matched" },
];

// ---------- MRP & finished goods ----------
export const mrp = [
	{ item: "BMS board v4", need: 1080, onHand: 236, onOrder: 800, short: 44, action: "Expedite PO-26-4131", by: "12 Oct" },
	{ item: "LFP cell 3.2V 50Ah", need: 16200, onHand: 9400, onOrder: 6000, short: 800, action: "Raise PR for 12,000", by: "14 Oct" },
	{ item: "TFT cluster 5in", need: 540, onHand: 210, onOrder: 600, short: 0, action: "Covered", by: "—" },
	{ item: "Hub motor 2.5 kW", need: 540, onHand: 610, onOrder: 300, short: 0, action: "Covered", by: "—" },
	{ item: "Alloy wheel 12in", need: 1080, onHand: 720, onOrder: 0, short: 360, action: "Raise PR for 600", by: "15 Oct" },
	{ item: "Seat assembly", need: 540, onHand: 590, onOrder: 0, short: 0, action: "Covered", by: "—" },
];
export const fgYard = [
	{ model: "E-Ride S1", colour: "Graphite", qty: 64, allocated: 40, dealer: "Capital EV Hub", age: "2 d" },
	{ model: "E-Ride S1", colour: "Pearl White", qty: 38, allocated: 20, dealer: "Greenline Motors", age: "1 d" },
	{ model: "E-Ride S1 Pro", colour: "Volt Green", qty: 52, allocated: 36, dealer: "Capital EV Hub", age: "1 d" },
	{ model: "Cargo C2", colour: "Graphite", qty: 21, allocated: 0, dealer: "—", age: "9 d" },
	{ model: "E-Ride Lite", colour: "Ocean Blue", qty: 39, allocated: 30, dealer: "Sahyadri EV World", age: "3 d" },
];

// ---------- Service appointments & damage ----------
export const appointments = [
	{ time: "09:30", customer: "Arjun Rao", vehicle: "KA-01-EV-4471", type: "Periodic service — 6000 km", dealer: "Greenline Motors", tech: "Suresh K", status: "Checked in" },
	{ time: "10:30", customer: "Sneha Patil", vehicle: "MH-12-EV-2210", type: "Battery check", dealer: "Sahyadri EV World", tech: "Amit P", status: "Checked in" },
	{ time: "12:00", customer: "Rahul Gupta", vehicle: "DL-3S-EV-9031", type: "Accident repair estimate", dealer: "Capital EV Hub", tech: "Deepak R", status: "Booked" },
	{ time: "14:00", customer: "Divya Menon", vehicle: "TN-09-EV-5512", type: "Brake noise", dealer: "Marina E-Mobility", tech: "Lokesh M", status: "Booked" },
	{ time: "15:30", customer: "Aditya Shetty", vehicle: "TS-07-EV-1874", type: "First service — 1000 km", dealer: "Deccan Electric Wheels", tech: "Farhan S", status: "Booked" },
];
export const damage = [
	{ when: "14 Sep 2026", what: "Minor accident — front panel", where: "Capital EV Hub", detail: "Insurance claim IC-2291 · ₹6,400 · panel and headlamp replaced" },
	{ when: "02 Jun 2026", what: "Rear tyre puncture damage", where: "Roadside assist", detail: "Tyre replaced, no warranty" },
];

// ---------- Business-unit P&L (₹ crore, H1) ----------
export const buPnl = [
	{ bu: "Vehicle manufacturing & sales", revenue: 131.4, cogs: 112.6, opex: 14.9 },
	{ bu: "Swap network", revenue: 16.3, cogs: 6.1, opex: 5.2 },
	{ bu: "Service & spare parts", revenue: 11.1, cogs: 3.9, opex: 3.3 },
];

// ---------- helpers ----------
export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
export const lakh = (n: number) => `₹${(n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} L`;
export const crore = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
