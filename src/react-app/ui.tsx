import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function Page({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
	return (
		<div className="page">
			<header className="page-head">
				<div>
					<h1>{title}</h1>
					{sub && <p className="page-sub">{sub}</p>}
				</div>
				{actions && <div className="page-actions">{actions}</div>}
			</header>
			{children}
		</div>
	);
}

export function Panel({ title, note, right, children, className = "" }: { title?: string; note?: string; right?: ReactNode; children: ReactNode; className?: string }) {
	return (
		<section className={`panel ${className}`}>
			{(title || right) && (
				<div className="panel-head">
					<div>
						{title && <h2>{title}</h2>}
						{note && <p className="panel-note">{note}</p>}
					</div>
					{right}
				</div>
			)}
			{children}
		</section>
	);
}

export function Stat({ label, value, delta, tone, onClick }: { label: string; value: string; delta?: string; tone?: "good" | "warn" | "bad"; onClick?: () => void }) {
	const Tag = onClick ? "button" : "div";
	return (
		<Tag className={`stat ${onClick ? "stat-link" : ""}`} onClick={onClick}>
			<span className="stat-label">{label}</span>
			<span className="stat-value">{value}</span>
			{delta && <span className={`stat-delta ${tone ?? ""}`}>{delta}</span>}
		</Tag>
	);
}

export function Stats({ children }: { children: ReactNode }) {
	return <div className="stats">{children}</div>;
}

const toneFor: Record<string, string> = {
	// good
	Completed: "good", Received: "good", Inspected: "good", Approved: "good", Running: "good", Closed: "good", "Ready for delivery": "good",
	Sold: "good", "Ready at station": "good", Active: "good", Delivered: "good",
	// in flow
	"In progress": "info", Dispatched: "info", "In transit": "info", Charging: "info", "In vehicle": "info", "In repair": "info", Released: "info",
	"At dealer": "info", "Finished goods": "info", "In production": "info", "RFQ sent": "info", Diagnosis: "info", "Converted to PO": "info",
	// waiting
	"Pending approval": "warn", Pending: "warn", "Partially received": "warn", "Awaiting parts": "warn", "Warranty approval": "warn", Slow: "warn",
	"Under review": "warn", Draft: "muted", "In service": "warn", Service: "warn", Low: "warn",
	// problems
	"Awaiting inspection": "warn", Accepted: "good", "Short received": "warn", "Partly rejected": "bad", Rejected: "bad",
	"Recount needed": "warn", Scheduled: "info", "Write-off pending": "warn", Investigating: "warn", Adjusted: "good", Matched: "good",
	"Sent for approval": "info", "Confirmed by vendor": "info", Cancelled: "muted", "Waiting for quotes": "info", "Quotes received": "warn", "PO raised": "good", "Sent back": "bad", "Checked in": "info", Booked: "info", Covered: "good",
	"Material short": "bad", "End of life": "bad", Reorder: "bad", "Below min": "bad",
};
export function Badge({ children, tone }: { children: string; tone?: string }) {
	const t = tone ?? (children.startsWith("Down") ? "bad" : toneFor[children] ?? "muted");
	return <span className={`badge ${t}`}>{children}</span>;
}

export type Col<T> = { key: string; label: string; render?: (r: T) => ReactNode; num?: boolean; hideSm?: boolean };
export function Table<T>({ cols, rows, onRow, dense }: { cols: Col<T>[]; rows: T[]; onRow?: (r: T) => void; dense?: boolean }) {
	return (
		<div className="table-wrap">
			<table className={dense ? "dense" : ""}>
				<thead>
					<tr>
						{cols.map((c) => (
							<th key={c.key} className={`${c.num ? "num" : ""} ${c.hideSm ? "hide-sm" : ""}`}>{c.label}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((r, i) => (
						<tr key={i} className={onRow ? "clickable" : ""} onClick={onRow ? () => onRow(r) : undefined} tabIndex={onRow ? 0 : undefined}
							onKeyDown={onRow ? (e) => { if (e.key === "Enter") onRow(r); } : undefined}>
							{cols.map((c) => (
								<td key={c.key} className={`${c.num ? "num" : ""} ${c.hideSm ? "hide-sm" : ""}`}>
									{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Battery-shaped meter — the visual signature of the product. */
export function Cell({ pct, size = "md", label }: { pct: number; size?: "sm" | "md" | "lg"; label?: string }) {
	const tone = pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad";
	return (
		<span className={`cell cell-${size}`} title={label ?? `${pct}%`}>
			<span className="cell-body">
				<span className={`cell-fill ${tone}`} style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
			</span>
			<span className="cell-cap" />
			{size !== "sm" && <span className="cell-txt">{label ?? `${pct}%`}</span>}
		</span>
	);
}

export function Bar({ pct, tone = "accent" }: { pct: number; tone?: string }) {
	return (
		<span className="bar">
			<span className={`bar-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
		</span>
	);
}

type Series = { name: string; values: number[]; tone: string; kind?: "bar" | "line" | "ghost" };
export function Chart({ labels, series, height = 220, fmt = (n: number) => n.toLocaleString("en-IN"), stacked }: {
	labels: string[]; series: Series[]; height?: number; fmt?: (n: number) => string; stacked?: boolean;
}) {
	const [hover, setHover] = useState<number | null>(null);
	const W = 640, H = height, L = 44, R = 8, T = 12, B = 26;
	const bars = series.filter((s) => s.kind !== "line");
	const totals = labels.map((_, i) => stacked ? bars.reduce((a, s) => a + s.values[i], 0) : 0);
	const all = [...series.flatMap((s) => s.values), ...totals];
	const maxV = Math.max(...all) * 1.05;
	const nice = niceMax(maxV);
	const x0 = (i: number) => L + ((W - L - R) / labels.length) * i;
	const bw = (W - L - R) / labels.length;
	const y = (v: number) => T + (H - T - B) * (1 - v / nice);
	const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);
	const nBars = stacked ? 1 : bars.length;
	const inner = Math.min(34, bw * 0.7);
	return (
		<div className="chart">
			<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(", ")} onMouseLeave={() => setHover(null)}>
				{ticks.map((t) => (
					<g key={t}>
						<line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
						<text x={L - 6} y={y(t) + 4} className="axis" textAnchor="end">{compact(t)}</text>
					</g>
				))}
				{labels.map((lab, i) => (
					<text key={lab + i} x={x0(i) + bw / 2} y={H - 8} className="axis" textAnchor="middle">
						{labels.length > 16 && i % 3 !== 0 ? "" : lab}
					</text>
				))}
				{labels.map((_, i) => {
					let acc = 0;
					return bars.map((s, si) => {
						const v = s.values[i];
						const w = inner / nBars;
						const bx = x0(i) + (bw - inner) / 2 + (stacked ? 0 : si * w);
						const top = stacked ? y(acc + v) : y(v);
						const bottom = stacked ? y(acc) : y(0);
						acc += v;
						return <rect key={s.name + i} x={bx} y={top} width={Math.max(1, w - (stacked ? 0 : 2))} height={Math.max(0, bottom - top)}
							className={`mark ${s.tone} ${s.kind === "ghost" ? "ghost" : ""} ${hover !== null && hover !== i ? "dim" : ""}`} rx={stacked ? 0 : 2} />;
					});
				})}
				{series.filter((s) => s.kind === "line").map((s) => (
					<g key={s.name}>
						<polyline fill="none" className={`line ${s.tone}`} points={s.values.map((v, i) => `${x0(i) + bw / 2},${y(v)}`).join(" ")} />
						{s.values.map((v, i) => labels.length <= 16 && <circle key={i} cx={x0(i) + bw / 2} cy={y(v)} r={3} className={`dot ${s.tone}`} />)}
					</g>
				))}
				{labels.map((_, i) => (
					<rect key={"h" + i} x={x0(i)} y={T} width={bw} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
				))}
				{hover !== null && <line x1={x0(hover) + bw / 2} x2={x0(hover) + bw / 2} y1={T} y2={H - B} className="cursor" />}
			</svg>
			<div className="chart-foot">
				{hover !== null ? (
					<span className="chart-tip"><b>{labels[hover]}</b>{series.map((s) => <span key={s.name}><i className={`key ${s.tone}`} />{s.name} {fmt(s.values[hover])}</span>)}</span>
				) : (
					<span className="legend">{series.map((s) => <span key={s.name}><i className={`key ${s.tone} ${s.kind ?? "bar"}`} />{s.name}</span>)}</span>
				)}
			</div>
		</div>
	);
}
function niceMax(v: number) {
	const p = Math.pow(10, Math.floor(Math.log10(v)));
	const n = v / p;
	return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s) ?? 10) * p;
}
export function compact(n: number) {
	if (n >= 1e7) return (n / 1e7).toFixed(1).replace(/\.0$/, "") + "Cr";
	if (n >= 1e5) return (n / 1e5).toFixed(1).replace(/\.0$/, "") + "L";
	if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function HBars({ rows, fmt = (n: number) => String(n), tone = "accent" }: { rows: { label: string; value: number; sub?: string }[]; fmt?: (n: number) => string; tone?: string }) {
	const max = Math.max(...rows.map((r) => r.value));
	return (
		<ul className="hbars">
			{rows.map((r) => (
				<li key={r.label}>
					<span className="hb-label">{r.label}{r.sub && <small>{r.sub}</small>}</span>
					<Bar pct={(r.value / max) * 100} tone={tone} />
					<span className="hb-val">{fmt(r.value)}</span>
				</li>
			))}
		</ul>
	);
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[]; value: T; onChange: (t: T) => void }) {
	return (
		<div className="tabs" role="tablist">
			{tabs.map((t) => (
				<button key={t} role="tab" aria-selected={t === value} className={t === value ? "on" : ""} onClick={() => onChange(t)}>{t}</button>
			))}
		</div>
	);
}

export function Drawer({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode }) {
	useEffect(() => {
		if (!open) return;
		const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	}, [open, onClose]);
	if (!open) return null;
	return (
		<div className="drawer-wrap" onClick={onClose}>
			<aside className="drawer" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
				<header className="drawer-head">
					<div>
						<h2>{title}</h2>
						{sub && <p className="page-sub">{sub}</p>}
					</div>
					<button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
				</header>
				<div className="drawer-body">{children}</div>
			</aside>
		</div>
	);
}

export function Timeline({ items }: { items: { when: string; what: string; where?: string; detail?: string }[] }) {
	return (
		<ol className="timeline">
			{items.map((it, i) => (
				<li key={i}>
					<span className="tl-dot" />
					<div>
						<div className="tl-what">{it.what}{it.where && <span className="tl-where"> at {it.where}</span>}</div>
						{it.detail && <div className="tl-detail">{it.detail}</div>}
						<div className="tl-when">{it.when}</div>
					</div>
				</li>
			))}
		</ol>
	);
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
	return (
		<dl className="facts">
			{rows.map(([k, v]) => (
				<div key={k}><dt>{k}</dt><dd>{v}</dd></div>
			))}
		</dl>
	);
}

let toastFn: ((m: string) => void) | null = null;
export function toast(msg: string) { toastFn?.(msg); }
export function Toaster() {
	const [msg, setMsg] = useState<string | null>(null);
	useEffect(() => {
		toastFn = (m) => { setMsg(m); window.setTimeout(() => setMsg(null), 2600); };
		return () => { toastFn = null; };
	}, []);
	return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
	return <input className="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />;
}
