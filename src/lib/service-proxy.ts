import { readSession } from "./auth";
import { forgetBranding } from "./branding";
import { LANYARD_URL, lanyardFetch } from "./lanyard-client";
import { PROXIED_CSP } from "./security/csp";
import type { ServiceCatalogEntry } from "./types/catalog";

const PROXY_TIMEOUT_MS = 10_000;

// Cache the service catalog server-side
// lanyard filters the catalog per user, so each user gets their own entry
const catalogCache = new Map<
	string,
	{ services: ServiceCatalogEntry[]; fetchedAt: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedCatalog(
	userId: string,
	accessToken: string,
	refresh = false,
): Promise<{ services: ServiceCatalogEntry[]; fromCache: boolean }> {
	const now = Date.now();
	const cached = catalogCache.get(userId);
	if (!refresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
		return { services: cached.services, fromCache: true };
	}

	const response = await lanyardFetch("/api/services/catalog", {
		accessToken,
	});

	if (!response.ok) {
		console.warn(`lanyard /api/services/catalog answered ${response.status}`);
		// a refused session sees no services; any other failure is lanyard's
		if (response.status === 401 || response.status === 403) {
			catalogCache.delete(userId);
			return { services: [], fromCache: false };
		}
		if (cached) return { services: cached.services, fromCache: false };
		throw new Error(`lanyard catalog answered ${response.status}`);
	}

	const services: ServiceCatalogEntry[] = await response.json();
	for (const [key, entry] of catalogCache) {
		if (now - entry.fetchedAt >= CACHE_TTL_MS) catalogCache.delete(key);
	}
	catalogCache.set(userId, { services, fetchedAt: now });
	return { services, fromCache: false };
}

// The shell wants the list on every page the server renders, and a browser
// asks for more than pages (a missing icon, say). Lanyard allows a user 30
// catalog calls a minute, so one answer serves them all for a while. A failure
// is kept briefly, so a refusing lanyard is not asked again at once, but the
// nav recovers soon after it does
const SHELL_MAX_AGE_MS = 15_000;
const SHELL_FAILURE_MAX_AGE_MS = 5_000;
const shellAnswers = new Map<
	string,
	{ askedAt: number; failed: boolean; services: Promise<ServiceCatalogEntry[]> }
>();

export function getShellCatalog(
	userId: string,
	accessToken: string,
): Promise<ServiceCatalogEntry[]> {
	const now = Date.now();
	for (const [key, answer] of shellAnswers) {
		const maxAge = answer.failed ? SHELL_FAILURE_MAX_AGE_MS : SHELL_MAX_AGE_MS;
		if (now - answer.askedAt >= maxAge) shellAnswers.delete(key);
	}
	let answer = shellAnswers.get(userId);
	if (!answer) {
		const services = getCachedCatalog(userId, accessToken, true).then(
			(catalog) => catalog.services,
		);
		answer = { askedAt: now, failed: false, services };
		const entry = answer;
		services.catch(() => {
			entry.failed = true;
		});
		shellAnswers.set(userId, answer);
	}
	return answer.services;
}

// a change made through one of lanyard's own pages (a service switched off, a
// role or department changed) can alter every user's list, so none is kept
function forgetCatalogs(): void {
	catalogCache.clear();
	shellAnswers.clear();
	forgetBranding();
}

export function __resetCatalogCache(): void {
	forgetCatalogs();
}

// No proxy-side permission cache — Lanyard's resolver handles caching.
// This ensures permission changes take effect immediately.
export async function resolveProof(
	accessToken: string,
	serviceSlug: string,
): Promise<{ proof: string } | { failure: "forbidden" | "unavailable" }> {
	try {
		const response = await lanyardFetch(
			`/api/services/${serviceSlug}/permissions`,
			{ accessToken },
		);

		if (response.ok) {
			const data = await response.json();
			return typeof data.proof === "string"
				? { proof: data.proof }
				: { failure: "forbidden" };
		}
		console.warn(
			`lanyard /api/services/${serviceSlug}/permissions answered ${response.status}`,
		);
		return {
			failure: [401, 403, 404].includes(response.status)
				? "forbidden"
				: "unavailable",
		};
	} catch (err) {
		console.warn(
			`lanyard /api/services/${serviceSlug}/permissions failed:`,
			err instanceof Error ? err.message : err,
		);
		return { failure: "unavailable" };
	}
}

// the only lanyard route that signs user proofs, which must never reach the
// browser
const PROOF_ROUTE = /^\/api\/services\/.+\/permissions$/;

/**
 * Whether a lanyard-owned request whose path the browser can steer may go to
 * this URL: inside LANYARD_URL, and not to the route that signs user proofs.
 */
export function lanyardPathAllowed(url: URL): boolean {
	const base = new URL(LANYARD_URL);
	const prefix = base.pathname.replace(/\/+$/, "");
	if (url.origin !== base.origin || !url.pathname.startsWith(`${prefix}/`)) {
		return false;
	}
	let path: string;
	try {
		path = decodeURIComponent(url.pathname.slice(prefix.length));
	} catch {
		return false;
	}
	if (path.split("/").some((segment) => segment === ".." || segment === ".")) {
		return false;
	}
	// lanyard's router matches paths decoded, without control characters,
	// repeated or trailing slashes, and ignoring case
	const routed = path
		.replace(/\p{Cc}/gu, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/$/, "")
		.toLowerCase();
	return !PROOF_ROUTE.test(routed);
}

// lanyard's own pages check the user's token themselves, so they get it, at
// LANYARD_URL; every other service only ever sees lanyard's proof
export interface ServiceTarget {
	baseUrl: string;
	authorization: string | null;
	failure?: "forbidden" | "unavailable";
}

export async function serviceTarget(
	service: ServiceCatalogEntry,
	accessToken: string,
): Promise<ServiceTarget> {
	if (service.lanyardOwned) {
		return { baseUrl: LANYARD_URL, authorization: `Bearer ${accessToken}` };
	}
	// Bun's fetch reads a file: URL from the dashboard's own disk
	const protocol = URL.canParse(service.baseUrl)
		? new URL(service.baseUrl).protocol
		: null;
	if (protocol !== "http:" && protocol !== "https:") {
		return {
			baseUrl: service.baseUrl,
			authorization: null,
			failure: "forbidden",
		};
	}
	const result = await resolveProof(accessToken, service.slug);
	if ("proof" in result) {
		return {
			baseUrl: service.baseUrl,
			authorization: `Bearer ${result.proof}`,
		};
	}
	return {
		baseUrl: service.baseUrl,
		authorization: null,
		failure: result.failure,
	};
}

async function forward(
	request: Request,
	serviceSlug: string,
	remainingPath: string,
): Promise<Response> {
	// 1. Validate session
	const session = await readSession(request);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 2. Resolve service from catalog
	let service: ServiceCatalogEntry | undefined;
	try {
		const catalog = await getCachedCatalog(
			session.user.id,
			session.accessToken,
		);
		service = catalog.services.find((s) => s.slug === serviceSlug);
		// the cached list can predate a service registered or made visible since
		if (!service && catalog.fromCache) {
			const fresh = await getCachedCatalog(
				session.user.id,
				session.accessToken,
				true,
			);
			service = fresh.services.find((s) => s.slug === serviceSlug);
		}
	} catch (err) {
		console.warn(
			"lanyard catalog failed:",
			err instanceof Error ? err.message : err,
		);
		return new Response(JSON.stringify({ error: "Service unavailable" }), {
			status: 503,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!service) {
		return new Response(JSON.stringify({ error: "Service not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 3. Where the request goes, and with which credential
	const target = await serviceTarget(service, session.accessToken);
	if (!target.authorization) {
		const unavailable = target.failure === "unavailable";
		return new Response(
			JSON.stringify({
				error: unavailable ? "Service unavailable" : "Forbidden",
			}),
			{
				status: unavailable ? 503 : 403,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// 4. Build target URL (preserve query string)
	const queryString = new URL(request.url).search;
	const targetUrl = `${target.baseUrl}/${remainingPath}${queryString}`;
	if (service.lanyardOwned && !lanyardPathAllowed(new URL(targetUrl))) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 5. Forward request with timeout
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

	try {
		const proxyHeaders = new Headers();
		const contentType = request.headers.get("content-type");
		if (contentType) {
			proxyHeaders.set("Content-Type", contentType);
		}

		proxyHeaders.set("Authorization", target.authorization);
		// lanyard rate-limits by the caller's address
		if (service.lanyardOwned) {
			proxyHeaders.set(
				"X-Forwarded-For",
				request.headers.get("x-forwarded-for") || "",
			);
		}

		const response = await fetch(targetUrl, {
			method: request.method,
			headers: proxyHeaders,
			body:
				request.method !== "GET" && request.method !== "HEAD"
					? await request.arrayBuffer()
					: undefined,
			signal: controller.signal,
			redirect: service.lanyardOwned ? "manual" : "follow",
		});

		clearTimeout(timeout);

		if (
			service.lanyardOwned &&
			response.status >= 300 &&
			response.status < 400
		) {
			return new Response(JSON.stringify({ error: "Unexpected redirect" }), {
				status: 502,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (
			service.lanyardOwned &&
			response.ok &&
			request.method !== "GET" &&
			request.method !== "HEAD"
		) {
			forgetCatalogs();
		}

		// 6. Return sanitized response
		const responseHeaders = new Headers();
		const respContentType = response.headers.get("content-type");
		if (respContentType) {
			responseHeaders.set("Content-Type", respContentType);
		}
		responseHeaders.set("X-Content-Type-Options", "nosniff");

		return new Response(response.body, {
			status: response.status,
			headers: responseHeaders,
		});
	} catch (error) {
		clearTimeout(timeout);

		if (error instanceof Error && error.name === "AbortError") {
			return new Response(
				JSON.stringify({ error: "Service request timed out" }),
				{
					status: 504,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response(JSON.stringify({ error: "Service unavailable" }), {
			status: 502,
			headers: { "Content-Type": "application/json" },
		});
	}
}

// a service's answer is untrusted content on the dashboard's own origin: it
// must never run as a page, whatever URL spelling reached this route
export async function proxyRequest(
	request: Request,
	serviceSlug: string,
	remainingPath: string,
): Promise<Response> {
	const response = await forward(request, serviceSlug, remainingPath);
	const headers = new Headers(response.headers);
	headers.set("Content-Security-Policy", PROXIED_CSP);
	headers.set("Cache-Control", "no-store");
	headers.set("X-Content-Type-Options", "nosniff");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
