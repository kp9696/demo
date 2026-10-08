import { useState } from "react";
import type { FormEvent } from "react";
import { items, vendors, warehouses, swapStations, cities } from "./data";
import { Page, Panel, Table, Tabs, Drawer, Badge, toast } from "./ui";
import type { Col } from "./ui";
import { usePersist } from "./store";

type Row = Record<string, string> & { _new?: string };
type Field = { key: string; label: string; type?: "text" | "number" | "select" | "email"; options?: string[]; required?: boolean; placeholder?: string; hint?: string };
type Spec = { singular: string; cols: { key: string; label: string; num?: boolean; hideSm?: boolean }[]; fields: Field[]; base: Row[]; makeId?: (all: Row[], v: Row) => Row; validate?: (v: Row) => string | null };

const tabs = ["Items", "Vendors", "Warehouses", "Swap stations", "Users & roles"] as const;
type TabName = (typeof tabs)[number];

const specs: Record<TabName, Spec> = {
	Items: {
		singular: "item",
		cols: [{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "category", label: "Category", hideSm: true }, { key: "uom", label: "Unit", hideSm: true }, { key: "tracking", label: "Tracking" }, { key: "rfid", label: "RFID" }, { key: "min", label: "Min", num: true, hideSm: true }, { key: "max", label: "Max", num: true, hideSm: true }],
		fields: [
			{ key: "name", label: "Item name", required: true, placeholder: "e.g. Throttle assembly" },
			{ key: "category", label: "Category", type: "select", options: ["Drivetrain", "Electronics", "Battery", "Chassis", "Brakes", "Wheels", "Lighting", "Body", "Fasteners", "Accessories"] },
			{ key: "uom", label: "Unit", type: "select", options: ["EA", "SET", "BOX", "ROLL", "KG", "M"] },
			{ key: "tracking", label: "Tracking", type: "select", options: ["Serial", "Batch", "None"] },
			{ key: "rfid", label: "RFID tagged", type: "select", options: ["Yes", "No"] },
			{ key: "min", label: "Minimum stock", type: "number", required: true, placeholder: "100" },
			{ key: "max", label: "Maximum stock", type: "number", required: true, placeholder: "500" },
		],
		base: items.map((i) => ({ code: i.code, name: i.name, category: i.category, uom: i.uom, tracking: i.tracking, rfid: i.rfid ? "Yes" : "No", min: String(i.min), max: String(i.max) })),
		makeId: (all, v) => ({ ...v, code: `MAT-${1200 + all.length}` }),
		validate: (v) => (Number(v.min) >= Number(v.max) ? "Maximum stock must be higher than minimum stock." : null),
	},
	Vendors: {
		singular: "vendor",
		cols: [{ key: "name", label: "Vendor" }, { key: "category", label: "Supplies" }, { key: "city", label: "City", hideSm: true }, { key: "gstin", label: "GSTIN", hideSm: true }],
		fields: [
			{ key: "name", label: "Vendor name", required: true, placeholder: "Company name" },
			{ key: "category", label: "What they supply", required: true, placeholder: "e.g. Battery cells" },
			{ key: "city", label: "City", required: true },
			{ key: "gstin", label: "GSTIN", required: true, placeholder: "15 characters", hint: "2-digit state code followed by 13 letters or digits" },
		],
		base: vendors.map((v) => ({ name: v.name, category: v.category, city: v.city, gstin: `29AAB${v.name.slice(0, 3).toUpperCase()}1234F1Z5` })),
		validate: (v) => (/^[0-9]{2}[A-Z0-9]{13}$/.test(v.gstin.toUpperCase()) ? null : "GSTIN must be 15 characters: a 2-digit state code, then 13 letters or digits."),
	},
	Warehouses: {
		singular: "location",
		cols: [{ key: "name", label: "Location" }, { key: "type", label: "Type" }, { key: "bins", label: "Bins", num: true }],
		fields: [
			{ key: "name", label: "Location name", required: true, placeholder: "e.g. Delhi site WH" },
			{ key: "type", label: "Type", type: "select", options: ["Central warehouse", "Site warehouse", "Line-side store", "Service store"] },
			{ key: "bins", label: "Number of bins", type: "number", required: true, placeholder: "120" },
		],
		base: warehouses.map((n, i) => ({ name: n, type: ["Central warehouse", "Line-side store", "Site warehouse", "Service store"][i], bins: String([480, 64, 120, 90][i]) })),
	},
	"Swap stations": {
		singular: "swap station",
		cols: [{ key: "id", label: "Station" }, { key: "name", label: "Name" }, { key: "city", label: "City" }, { key: "slots", label: "Slots", num: true }],
		fields: [
			{ key: "name", label: "Station name", required: true, placeholder: "e.g. Electronic City Phase 1" },
			{ key: "city", label: "City", type: "select", options: [...cities] },
			{ key: "slots", label: "Battery slots", type: "select", options: ["8", "16", "24", "32"] },
		],
		base: swapStations.map((s) => ({ id: s.id, name: s.name, city: s.city, slots: String(s.slots) })),
		makeId: (all, v) => ({ ...v, id: `SS-${v.city.slice(0, 3).toUpperCase()}-${String(all.filter((r) => r.city === v.city).length + 1).padStart(2, "0")}` }),
	},
	"Users & roles": {
		singular: "user",
		cols: [{ key: "name", label: "User" }, { key: "email", label: "Email", hideSm: true }, { key: "role", label: "Role" }, { key: "access", label: "Access", hideSm: true }],
		fields: [
			{ key: "name", label: "Full name", required: true },
			{ key: "email", label: "Work email", type: "email", required: true, placeholder: "name@company.com" },
			{ key: "role", label: "Role", type: "select", options: ["Plant head", "Production planner", "Stores", "Service technician", "Dealer", "Finance controller", "Management"] },
		],
		base: [
			{ name: "Demo User", email: "demo.user@demo.in", role: "Plant head", access: "All modules, approves up to ₹5 L" },
			{ name: "Production planner", email: "planner@demo.in", role: "Production planner", access: "Production, inventory" },
			{ name: "Service technician", email: "tech@demo.in", role: "Service technician", access: "Mobile app, job cards" },
			{ name: "Finance controller", email: "finance@demo.in", role: "Finance controller", access: "Finance, approves up to ₹50 L" },
		],
		makeId: (_all, v) => ({ ...v, access: roleAccess[v.role] ?? "Read only" }),
		validate: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) ? null : "Enter a valid email address, like name@company.com."),
	},
};
const roleAccess: Record<string, string> = {
	"Plant head": "All modules, approves up to ₹5 L", "Production planner": "Production, inventory", Stores: "Inventory, procurement receipts, mobile app",
	"Service technician": "Mobile app, job cards", Dealer: "Dealer portal: own vehicles and jobs", "Finance controller": "Finance, approves up to ₹50 L", Management: "Dashboard, reports, all approvals",
};

export function Masters() {
	const [tab, setTab] = useState<TabName>("Items");
	const [extra, setExtra] = usePersist<Record<string, Row[]>>("masters", {});
	const [formOpen, setFormOpen] = useState(false);
	const [vals, setVals] = useState<Row>({});
	const [err, setErr] = useState<string | null>(null);
	const spec = specs[tab];
	const added = extra[tab] ?? [];
	const rows: Row[] = [...added, ...spec.base];

	const openForm = () => {
		const init: Row = {};
		spec.fields.forEach((f) => { init[f.key] = f.type === "select" && f.options ? f.options[0] : ""; });
		setVals(init); setErr(null); setFormOpen(true);
	};
	const save = (e: FormEvent) => {
		e.preventDefault();
		const missing = spec.fields.filter((f) => f.required && !String(vals[f.key] ?? "").trim());
		if (missing.length) { setErr(`Fill in ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`); return; }
		const v = spec.validate?.(vals);
		if (v) { setErr(v); return; }
		let rec: Row = { ...vals };
		if (spec.makeId) rec = spec.makeId(rows, rec);
		if (rec.gstin) rec.gstin = rec.gstin.toUpperCase();
		rec._new = "1";
		setExtra((x) => ({ ...x, [tab]: [rec, ...(x[tab] ?? [])] }));
		setFormOpen(false);
		toast(`New ${spec.singular} “${rec.name}” saved${tab === "Users & roles" ? " — login invite emailed" : ""}`);
	};
	const remove = (r: Row) => {
		setExtra((x) => ({ ...x, [tab]: (x[tab] ?? []).filter((y) => y !== r && JSON.stringify(y) !== JSON.stringify(r)) }));
		toast(`Removed “${r.name}”`);
	};
	const cols: Col<Row>[] = spec.cols.map((c, i) => ({
		key: c.key, label: c.label, num: c.num, hideSm: c.hideSm,
		render: i === 0 ? (r: Row) => <>{r[c.key]} {r._new && <Badge tone="info">New</Badge>}</> : undefined,
	}));
	cols.push({ key: "_a", label: "", render: (r: Row) => (r._new ? <button className="btn sm ghost" onClick={() => remove(r)}>Remove</button> : null) });

	return (
		<Page title="Master data" sub="One source of truth for items, partners, locations and people"
			actions={<button className="btn" onClick={openForm}>Add {spec.singular}</button>}>
			<Panel right={<Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); setFormOpen(false); }} />}>
				<p className="hint">{rows.length} records{added.length ? ` · ${added.length} added in this demo` : ""}</p>
				<Table dense cols={cols} rows={rows} />
			</Panel>
			<Drawer open={formOpen} onClose={() => setFormOpen(false)} title={`Add ${spec.singular}`} sub={`New record in ${tab}`}>
				<form className="rec-form" onSubmit={save} noValidate>
					{spec.fields.map((f) => (
						<label key={f.key} htmlFor={`mf-${f.key}`}>
							<span>{f.label}{f.required && <i aria-hidden="true"> *</i>}</span>
							{f.type === "select" ? (
								<select id={`mf-${f.key}`} value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}>
									{f.options!.map((o) => <option key={o}>{o}</option>)}
								</select>
							) : (
								<input id={`mf-${f.key}`} className="search" type={f.type ?? "text"} value={vals[f.key] ?? ""} placeholder={f.placeholder}
									onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
							)}
							{f.hint && <small>{f.hint}</small>}
						</label>
					))}
					{spec.makeId && tab !== "Users & roles" && <p className="hint">The {tab === "Items" ? "item code" : "station ID"} is created when you save.</p>}
					{tab === "Users & roles" && <p className="hint">Access is set from the role. The user gets a login invite by email.</p>}
					{err && <p className="form-err" role="alert">{err}</p>}
					<div className="row-btns">
						<button type="button" className="btn ghost" onClick={() => setFormOpen(false)}>Cancel</button>
						<button type="submit" className="btn">Save {spec.singular}</button>
					</div>
				</form>
			</Drawer>
		</Page>
	);
}
