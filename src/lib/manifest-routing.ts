import type { PageDefinition } from "./types/manifest";

/**
 * Match a URL path against a manifest page path pattern that may contain
 * `:param` segments. Returns an object of extracted param values when the
 * path matches, or `null` when it does not.
 *
 * @example
 * matchPath("/users/:userId", "/users/abc123") // { userId: "abc123" }
 * matchPath("/users", "/users")               // {}
 * matchPath("/users/:userId", "/users")       // null
 */
export function matchPath(
	pattern: string,
	path: string,
): Record<string, string> | null {
	const patternSegments = pattern.split("/");
	const pathSegments = path.split("/");

	if (patternSegments.length !== pathSegments.length) {
		return null;
	}

	const params: Record<string, string> = {};

	for (let i = 0; i < patternSegments.length; i++) {
		const patternSeg = patternSegments[i];
		const pathSeg = pathSegments[i];

		if (patternSeg.startsWith(":")) {
			params[patternSeg.slice(1)] = pathSeg;
		} else if (patternSeg !== pathSeg) {
			return null;
		}
	}

	return params;
}

/**
 * Find the best matching page from a manifest's page list for the given path.
 * Exact static matches are preferred over parameterized matches.
 *
 * Returns `{ page, pathParams }` or `null` when no page matches.
 */
export function findPage(
	pages: PageDefinition[],
	path: string,
): { page: PageDefinition; pathParams: Record<string, string> } | null {
	let parameterizedMatch: {
		page: PageDefinition;
		pathParams: Record<string, string>;
	} | null = null;

	for (const page of pages) {
		const params = matchPath(page.path, path);
		if (params === null) {
			continue;
		}

		// Exact match: no param keys — return immediately (highest priority)
		if (Object.keys(params).length === 0) {
			return { page, pathParams: params };
		}

		// Keep the first parameterized match as a fallback
		if (parameterizedMatch === null) {
			parameterizedMatch = { page, pathParams: params };
		}
	}

	return parameterizedMatch;
}

/**
 * Replace `:param` placeholders in an endpoint template with actual values.
 * Values are URI-encoded via `encodeURIComponent`. Placeholders with no
 * corresponding key in `params` are left unchanged.
 *
 * @example
 * interpolateEndpoint("/api/users/:userId", { userId: "abc" })     // "/api/users/abc"
 * interpolateEndpoint("/api/users/:userId", { userId: "a b/c" })   // "/api/users/a%20b%2Fc"
 * interpolateEndpoint("/api/users/:userId", {})                    // "/api/users/:userId"
 */
export function interpolateEndpoint(
	template: string,
	params: Record<string, string>,
): string {
	return template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (match, key) => {
		if (Object.hasOwn(params, key)) {
			return encodeURIComponent(params[key]);
		}
		return match;
	});
}
