import { useCallback, useMemo } from "react";
import { items, warehouses, approvals, requisitions, recon } from "./data";
import type { Item, Approval } from "./data";
import { usePersist } from "./store";
import { toast } from "./ui";

// One stock ledger for the whole demo. Every receipt, issue, transfer and adjustment
// is a movement; on-hand stock per location = opening stock + all movements.

export const LOCS = warehouses;
export const [CENTRAL, LINE, SITE, SERVICE] = warehouses;

export type MoveType = "Receipt" | "Issue to line" | "Line receipt" | "Issue to service" | "Transfer out" | "Transfer in" | "Adjustment" | "Return to vendor" | "Bin move";
export type Move = { id: string; when: string; type: MoveType; code: string; loc: string; qty: number; ref: string; by: string; note?: string; batch?: string; hist?: boolean };
export type NewMove = Omit<Move, "id" | "when">;

export const itemByCode = (code: string) => items.find((i) => i.code === code)!;
export const itemByName = (name: string) => items.find((i) => i.name === name);

const svcCats = new Set(["Brakes", "Lighting", "Wheels", "Accessories", "Electronics", "Chassis"]);
const lineCats = new Set(["Drivetrain", "Electronics", "Chassis", "Wheels", "Brakes", "Lighting", "Body"]);
/** Opening stock per location, adding up to the item's on-hand quantity. */
export function openingSplit(i: Item): Record<string, number> {
	const t = i.onHand;
	const line = lineCats.has(i.category) ? Math.round(t * 0.1) : 0;
	const site = Math.round(t * (i.warehouse === SITE ? 0.5 : 0.12));
	const svc = svcCats.has(i.category) ? Math.round(t * 0.08) : 0;
	return { [CENTRAL]: t - line - site - svc, [LINE]: line, [SITE]: site, [SERVICE]: svc };
}

export function stamp() {
	const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
	return `${p.day} ${p.month} ${p.hour}:${p.minute}`;
}

/** Earlier movements shown in the register for context; already part of opening stock. */
const history: Move[] = [
	[items[0], "Receipt", CENTRAL, 300, "GRN-88137", "Gate G1", "B-2610-07"],
	[items[0], "Issue to line", CENTRAL, -60, "TR-0930", "Stores — Hosur"],
	[items[0], "Line receipt", LINE, 60, "TR-0930", "Line 1"],
	[items[1], "Issue to line", CENTRAL, -60, "TR-0930", "Stores — Hosur"],
	[items[1], "Line receipt", LINE, 60, "TR-0930", "Line 1"],
	[items[14], "Receipt", CENTRAL, 498, "GRN-88135", "Gate G1", "B-2610-05"],
	[items[5], "Receipt", CENTRAL, 228, "GRN-88131", "Gate G2", "B-2610-03"],
	[items[5], "Return to vendor", CENTRAL, -12, "RTV-0311", "Quality"],
	[items[23], "Transfer out", CENTRAL, -400, "TR-0931", "Stores — Hosur"],
	[items[9], "Transfer out", CENTRAL, -120, "TR-0931", "Stores — Hosur"],
	[items[19], "Transfer out", CENTRAL, -60, "TR-0927", "Stores — Hosur"],
	[items[19], "Transfer in", SITE, 60, "TR-0927", "Pune stores"],
	[items[19], "Adjustment", CENTRAL, 12, "SA-0409", "Finance", undefined, "Return not booked"],
	[items[23], "Issue to service", SERVICE, -6, "JC-31190", "Lokesh M"],
].map(([it, type, loc, qty, ref, by, batch, note], k) => ({
	id: `H-${k}`, when: ["08 Oct 09:40", "08 Oct 08:02", "08 Oct 08:10", "08 Oct 08:02", "08 Oct 08:10", "07 Oct 11:52", "06 Oct 15:41", "06 Oct 16:20", "05 Oct 10:05", "05 Oct 10:05", "03 Oct 11:10", "04 Oct 09:30", "02 Oct 17:15", "02 Oct 12:40"][k],
	type: type as MoveType, code: (it as Item).code, loc: loc as string, qty: qty as number, ref: ref as string, by: by as string, batch: batch as string | undefined, note: note as string | undefined, hist: true,
}));

// ---------- shared requisitions and approvals ----------
export type PR = { no: string; item: string; qty: number; need: string; by: string; reason: string; source: "Manual" | "MRP" | "Reorder"; status: string; link?: string };
export function usePRs() {
	return usePersist<PR[]>("prs", requisitions.map((r) => ({ ...r, reason: r.no === "PR-1882" ? "Cells for next week's production plan" : "Below reorder level", source: r.no === "PR-1882" ? "MRP" : "Reorder", link: r.no === "PR-1879" ? "RFQ-0416" : r.no === "PR-1876" ? "PO-26-4125" : undefined })));
}
export function useApprovalList() { return usePersist<Approval[]>("approvals", approvals); }

// ---------- levels ----------
export type Levels = { min: number; reorder: number; max: number };
export function useLevels() { return usePersist<Record<string, Levels>>("levels", {}); }
export const levelsOf = (i: Item, ov: Record<string, Levels>): Levels => ov[i.code] ?? { min: i.min, reorder: i.reorder, max: i.max };

// ---------- the ledger ----------
function buildMap(moves: Move[]) {
	const map: Record<string, Record<string, number>> = {};
	items.forEach((i) => { map[i.code] = openingSplit(i); });
	moves.forEach((m) => { if (!m.hist && map[m.code]) map[m.code][m.loc] = (map[m.code][m.loc] ?? 0) + m.qty; });
	return map;
}
const totalOf = (map: Record<string, Record<string, number>>, code: string) => Object.values(map[code] ?? {}).reduce((a, b) => a + b, 0);

export function useStock() {
	const [moves, setMoves] = usePersist<Move[]>("stockMoves", []);
	const [lv] = useLevels();
	const [, setPrs] = usePRs();
	const [, setApprovals] = useApprovalList();
	const map = useMemo(() => buildMap(moves), [moves]);
	const qty = useCallback((code: string, loc?: string) => (loc ? map[code]?.[loc] ?? 0 : totalOf(map, code)), [map]);

	/** Posts movements. Any item that falls below its reorder level gets a requisition raised automatically. */
	const post = useCallback((list: NewMove[]) => {
		const s = stamp();
		let below: { i: Item; after: number }[] = [];
		setMoves((prev) => {
			const before = buildMap(prev);
			const added = list.map((m, k) => ({ ...m, id: `MV-${Date.now() % 1000000}-${k}`, when: s }));
			const next = [...added, ...prev];
			const after = buildMap(next);
			below = Array.from(new Set(list.map((m) => m.code))).map(itemByCode).filter((i) => {
				const l = levelsOf(i, lv);
				return totalOf(before, i.code) >= l.reorder && totalOf(after, i.code) < l.reorder;
			}).map((i) => ({ i, after: totalOf(after, i.code) }));
			return next;
		});
		if (below.length) {
			const made: { no: string; i: Item; q: number }[] = [];
			setPrs((prev) => {
				const add = below.filter(({ i }) => !prev.some((p) => p.item === i.name && !["Rejected", "PO raised"].includes(p.status) && !p.link?.startsWith("PO"))).map(({ i, after }, k) => {
					const l = levelsOf(i, lv);
					const q = Math.max(10, Math.ceil((l.max - after) / 10) * 10);
					const no = `PR-${1950 + prev.length + k}`;
					made.push({ no, i, q });
					return { no, item: i.name, qty: q, need: "20 Oct", by: "Auto reorder", reason: `Fell below reorder level ${l.reorder}`, source: "Reorder" as const, status: "Pending approval" };
				});
				return [...add, ...prev];
			});
			if (made.length) {
				setApprovals((l) => [...made.map((m) => ({ id: m.no, type: "Purchase requisition", title: `${m.q.toLocaleString("en-IN")} × ${m.i.name} (auto reorder)`, by: "Auto reorder", value: m.q * m.i.unitCost, age: "just now", step: "Plant head" })), ...l]);
				toast(`${made.map((m) => m.i.name).join(", ")} fell below reorder level — ${made.map((m) => m.no).join(", ")} raised automatically`);
			}
		}
	}, [setMoves, setPrs, setApprovals, lv]);

	return { moves, map, qty, post, all: [...moves, ...history] };
}

// ---------- adjustments (need approval before they touch stock) ----------
export type Adj = { no: string; code: string; loc: string; qty: number; reason: string; status: "Pending approval" | "Approved" | "Rejected"; when: string; by: string };
const adjSeed: Adj[] = [
	{ no: "SA-0412", code: items[15].code, loc: CENTRAL, qty: -46, reason: "Damaged in storage", status: "Pending approval", when: "07 Oct 16:10", by: "Stores — Hosur" },
	{ no: "SA-0409", code: items[19].code, loc: CENTRAL, qty: 12, reason: "Found in count — return not booked", status: "Approved", when: "02 Oct 17:15", by: "Stores — Hosur" },
];
export function useAdjustments() { return usePersist<Adj[]>("adjustments", adjSeed); }

export type ReconRow = { item: string; system: number; physical: number; diff: number; value: number; reason: string; status: string; code?: string; loc?: string; adj?: string };
export function useRecon() { return usePersist<ReconRow[]>("recon", recon); }

export function useRequestAdjustment() {
	const [adjs, setAdjs] = useAdjustments();
	const [, setApprovals] = useApprovalList();
	return (a: Omit<Adj, "no" | "status" | "when" | "by">) => {
		const no = `SA-0${413 + adjs.length}`;
		const it = itemByCode(a.code);
		setAdjs((l) => [{ ...a, no, status: "Pending approval", when: stamp(), by: "Demo User" }, ...l]);
		setApprovals((l) => [{ id: no, type: "Stock adjustment", title: `${a.qty > 0 ? "+" : ""}${a.qty} × ${it.name} at ${a.loc} — ${a.reason}`, by: "Demo User", value: Math.abs(a.qty) * it.unitCost, age: "just now", step: Math.abs(a.qty) * it.unitCost > 50000 ? "Stores head, then finance" : "Stores head" }, ...l]);
		return no;
	};
}

/** Called from the Approvals page for stock workflows. */
export function useStockDecision() {
	const { post } = useStock();
	const [adjs, setAdjs] = useAdjustments();
	const [, setRecon] = useRecon();
	return (id: string, type: string, ok: boolean) => {
		if (type === "Stock adjustment") {
			const a = adjs.find((x) => x.no === id);
			if (!a) return;
			setAdjs((l) => l.map((x) => (x.no === id ? { ...x, status: ok ? "Approved" : "Rejected" } : x)));
			setRecon((l) => l.map((r) => (r.adj === id ? { ...r, status: ok ? "Adjusted" : "Investigating" } : r)));
			if (ok) post([{ type: a.reason.startsWith("Return to vendor") ? "Return to vendor" : "Adjustment", code: a.code, loc: a.loc, qty: a.qty, ref: a.no, by: "Approved adjustment", note: a.reason }]);
		}
		if (type === "Material return" && ok) {
			const it = itemByName("Motor controller 48V")!;
			post([
				{ type: "Transfer out", code: it.code, loc: LINE, qty: -18, ref: id, by: "Line 1", note: "Unused, returned to stores" },
				{ type: "Transfer in", code: it.code, loc: CENTRAL, qty: 18, ref: id, by: "Stores — Hosur", note: "Material return" },
			]);
		}
	};
}
