import { buildCsp, PROXIED_CSP } from "./csp";

export interface SecurityOptions {
	nonce: string;
	pathname: string;
	production: boolean;
	imgSources: string[];
	connectSources: string[];
	scriptSources?: string[];
	styleSources?: string[];
	formActionSources?: string[];
	noStorePrefixes: string[];
}

// the router matches paths decoded and without regard to case, so the prefix
// tests have to as well
function routedPath(pathname: string): string {
	let decoded = pathname;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		// a broken escape stays as it is; the prefix tests still see its start
	}
	return decoded.toLowerCase().replace(/\/{2,}/g, "/");
}

export function applySecurityHeaders(
	response: Response,
	options: SecurityOptions,
): Response {
	const path = routedPath(options.pathname);
	// Response.redirect and some framework responses have immutable headers
	const headers = new Headers(response.headers);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	if (options.production) {
		headers.set(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains",
		);
	}

	if (path.startsWith("/api/proxy/")) {
		// whatever a service sent, it must not loosen this
		headers.delete("Content-Security-Policy-Report-Only");
		headers.set("Content-Security-Policy", PROXIED_CSP);
	} else if (
		!headers.has("Content-Security-Policy") &&
		!headers.has("Content-Security-Policy-Report-Only")
	) {
		headers.set(
			options.production
				? "Content-Security-Policy"
				: "Content-Security-Policy-Report-Only",
			buildCsp(options),
		);
	}

	const isHtml = headers.get("content-type")?.includes("text/html") ?? false;
	const isPrivate = options.noStorePrefixes.some((prefix) =>
		path.startsWith(prefix.toLowerCase()),
	);
	if (!headers.has("Cache-Control") && (isHtml || isPrivate)) {
		headers.set("Cache-Control", "no-store");
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
