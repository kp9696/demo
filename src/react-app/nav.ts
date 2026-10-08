export function go(route: string) {
	window.location.hash = `#/${route}`;
	window.scrollTo({ top: 0 });
}
