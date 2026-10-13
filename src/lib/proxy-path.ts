// check the path the browser will really request, after it resolves dot
// segments (also %2e and "..\"), so a call can't land on another proxy route
export function proxyPath(
	serviceSlug: string,
	endpoint: string,
): string | null {
	if (
		!serviceSlug ||
		/[/\\?#]/.test(serviceSlug) ||
		/^\.+$/.test(serviceSlug)
	) {
		return null;
	}
	const prefix = `/api/proxy/${serviceSlug}/`;
	const url = new URL(
		`/api/proxy/${serviceSlug}${endpoint}`,
		"http://dashboard.invalid",
	);
	return url.pathname.startsWith(prefix)
		? `${url.pathname}${url.search}`
		: null;
}
