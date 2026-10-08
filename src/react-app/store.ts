import { useCallback, useEffect, useState } from "react";

// Demo changes are kept in this browser so a refresh does not lose them.
const PREFIX = "voltera.demo.";
const listeners = new Map<string, Set<(v: unknown) => void>>();

function load<T>(key: string, initial: T): T {
	try {
		const raw = window.localStorage.getItem(PREFIX + key);
		return raw ? (JSON.parse(raw) as T) : initial;
	} catch {
		return initial;
	}
}

export function usePersist<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
	const [val, setVal] = useState<T>(() => load(key, initial));
	useEffect(() => {
		const set = listeners.get(key) ?? new Set();
		const fn = (v: unknown) => setVal(v as T);
		set.add(fn);
		listeners.set(key, set);
		return () => { set.delete(fn); };
	}, [key]);
	const update = useCallback((v: T | ((prev: T) => T)) => {
		const next = typeof v === "function" ? (v as (p: T) => T)(load(key, initial)) : v;
		try { window.localStorage.setItem(PREFIX + key, JSON.stringify(next)); } catch { /* storage unavailable: keep in memory */ }
		listeners.get(key)?.forEach((fn) => fn(next));
		setVal(next);
	}, [key, initial]);
	return [val, update];
}

export function resetDemo() {
	try {
		Object.keys(window.localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => window.localStorage.removeItem(k));
	} catch { /* nothing stored */ }
	window.location.hash = "#/dashboard";
	window.location.reload();
}

/** Reads ?open=ID from the hash so a page can open a record's detail panel. */
export function useOpenParam(): { id: string | null } {
	const read = () => {
		const q = window.location.hash.split("?")[1];
		return { id: q ? new URLSearchParams(q).get("open") : null };
	};
	const [v, setV] = useState<{ id: string | null }>(read);
	useEffect(() => {
		const h = () => setV(read());
		window.addEventListener("hashchange", h);
		return () => window.removeEventListener("hashchange", h);
	}, []);
	return v;
}
