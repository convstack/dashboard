const BASE = "http://dashboard.invalid";
const DATA_IMAGE =
	/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i;

// plain http is fine for files kept on this machine, such as local dev storage
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// the dashboard's own origin as the browser or the server knows it
export function ownOrigin(): string {
	if (typeof window !== "undefined") return window.location.origin;
	return new URL(process.env.DASHBOARD_URL || "http://localhost:4000").origin;
}

export function isSafeImageSrc(src: string, serviceSlug: string): boolean {
	if (DATA_IMAGE.test(src)) return true;
	// the browser resolves a bare path against the page, not the dashboard root
	if (!src.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(src)) return false;
	let url: URL;
	try {
		url = new URL(src, BASE);
	} catch {
		return false;
	}
	// a relative path and an absolute url to this dashboard are the same request
	if (url.origin === BASE || url.origin === ownOrigin()) {
		return (
			serviceSlug !== "" &&
			url.pathname.startsWith(`/api/proxy/${serviceSlug}/`)
		);
	}
	return (
		url.protocol === "https:" ||
		(url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))
	);
}

export function safeRedirect(target: unknown): string | null {
	if (typeof target !== "string" || !target.startsWith("/")) return null;
	let url: URL;
	try {
		url = new URL(target, BASE);
	} catch {
		return null;
	}
	// the parser drops tabs and newlines and reads a backslash as a slash,
	// so what it resolves to is what the browser will go to
	if (url.origin !== BASE) return null;
	// a dot segment can leave a leading "//", which the browser reads as a host
	const resolved = `${url.pathname}${url.search}${url.hash}`;
	return resolved.startsWith("//") ? null : resolved;
}
