import { describe, expect, it } from "vitest";
import { proxyPath } from "./proxy-path";

describe("proxyPath", () => {
	it.each([
		["/api/items", "/api/proxy/svc/api/items"],
		["/api/items?x=1&y=a%20b", "/api/proxy/svc/api/items?x=1&y=a%20b"],
		[
			"/api/items?next=../../other",
			"/api/proxy/svc/api/items?next=../../other",
		],
		["/api/a/../b?x=1", "/api/proxy/svc/api/b?x=1"],
	])("keeps %j inside the service's proxy route", (endpoint, path) => {
		expect(proxyPath("svc", endpoint)).toBe(path);
	});

	it.each([
		"/../other/x",
		"/%2e%2e/other/x",
		"/.%2E/other/x",
		"/%2E./other/x",
		"/..\\other/x",
		"/api/../../other/x?x=1",
		"/..",
		"api/items",
	])("refuses %j, which leaves the service's proxy route", (endpoint) => {
		expect(proxyPath("svc", endpoint)).toBeNull();
	});

	it.each([
		["an empty slug", ""],
		["a slug with a slash", "a/b"],
		["a slug with a backslash", "a\\b"],
		["a slug with a query", "a?b"],
		["a slug with a fragment", "a#b"],
		["a dot slug", ".."],
		["a single dot slug", "."],
	])("returns null for %s", (_label, slug) => {
		expect(proxyPath(slug, "/api/x")).toBeNull();
	});
});
