export function go(route: string, open?: string) {
	window.location.hash = `#/${route}${open ? `?open=${encodeURIComponent(open)}&t=${Date.now()}` : ""}`;
	window.scrollTo({ top: 0 });
}
