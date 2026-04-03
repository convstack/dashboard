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

	// 3. Build target URL (preserve query string)
	const queryString = new URL(request.url).search;
	const targetUrl = `${service.baseUrl}/${remainingPath}${queryString}`;

	// 4. Forward request with timeout
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

	try {
		const proxyHeaders = new Headers();
		const contentType = request.headers.get("content-type");
		if (contentType) {
			proxyHeaders.set("Content-Type", contentType);
		}

		// Add user context headers for the backend service
		proxyHeaders.set("X-User-Id", session.user.id);
		proxyHeaders.set("X-User-Role", session.user.role);
		proxyHeaders.set("X-User-Email", session.user.email);
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

		// 5. Return sanitized response
		const responseHeaders = new Headers();
		const respContentType = response.headers.get("content-type");
		if (respContentType) {
			responseHeaders.set("Content-Type", respContentType);
		}
		// Strip any internal headers from the backend service
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
