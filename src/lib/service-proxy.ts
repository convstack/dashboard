import { decryptSession, getSessionCookie } from "./auth";
import { lanyardFetch } from "./lanyard-client";
import type { ServiceCatalogEntry } from "./types/catalog";

const PROXY_TIMEOUT_MS = 10_000;

// Cache the service catalog server-side
let catalogCache: {
	services: ServiceCatalogEntry[];
	fetchedAt: number;
} | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedCatalog(
	accessToken: string,
): Promise<ServiceCatalogEntry[]> {
	if (catalogCache && Date.now() - catalogCache.fetchedAt < CACHE_TTL_MS) {
		return catalogCache.services;
	}

	const response = await lanyardFetch("/api/services/catalog", {
		accessToken,
	});

	if (!response.ok) return catalogCache?.services ?? [];

	const services: ServiceCatalogEntry[] = await response.json();
	catalogCache = { services, fetchedAt: Date.now() };
	return services;
}

// No proxy-side permission cache — Lanyard's resolver handles caching.
// This ensures permission changes take effect immediately.
export async function resolvePermissions(
	accessToken: string,
	serviceSlug: string,
): Promise<{
	permissions: string[];
	orgRoles: Array<{ orgId: string; slug: string; role: string }>;
}> {
	try {
		const response = await lanyardFetch(
			`/api/services/${serviceSlug}/permissions`,
			{ accessToken },
		);

		if (response.ok) {
			const data = await response.json();
			return {
				permissions: data.permissions || [],
				orgRoles: data.orgRoles || [],
			};
		}
	} catch {
		// Permission resolution is best-effort
	}

	return { permissions: [], orgRoles: [] };
}

export async function proxyRequest(
	request: Request,
	serviceSlug: string,
	remainingPath: string,
): Promise<Response> {
	// 1. Validate session
	const cookie = getSessionCookie(request);
	if (!cookie) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const session = await decryptSession(cookie);
	if (!session) {
		return new Response(JSON.stringify({ error: "Invalid session" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 2. Resolve service from catalog
	const services = await getCachedCatalog(session.accessToken);
	const service = services.find((s) => s.slug === serviceSlug);
	if (!service) {
		return new Response(JSON.stringify({ error: "Service not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 3. Resolve user permissions for this service
	const { permissions, orgRoles } = await resolvePermissions(
		session.accessToken,
		serviceSlug,
	);

	// 4. Build target URL (preserve query string)
	const queryString = new URL(request.url).search;
	const targetUrl = `${service.baseUrl}/${remainingPath}${queryString}`;

	// 5. Forward request with timeout
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

	try {
		const proxyHeaders = new Headers();
		const contentType = request.headers.get("content-type");
		if (contentType) {
			proxyHeaders.set("Content-Type", contentType);
		}

		// User context headers
		proxyHeaders.set("X-User-Id", session.user.id);
		proxyHeaders.set("X-User-Email", session.user.email);
		proxyHeaders.set("X-User-Permissions", permissions.join(","));
		proxyHeaders.set("X-User-Org-Roles", JSON.stringify(orgRoles));
		proxyHeaders.set(
			"X-Forwarded-For",
			request.headers.get("x-forwarded-for") || "",
		);
		proxyHeaders.set("Authorization", `Bearer ${session.accessToken}`);

		const response = await fetch(targetUrl, {
			method: request.method,
			headers: proxyHeaders,
			body:
				request.method !== "GET" && request.method !== "HEAD"
					? await request.arrayBuffer()
					: undefined,
			signal: controller.signal,
		});

		clearTimeout(timeout);

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
