import type { PageDefinition } from "@convstack/service-sdk/types";
import { describe, expect, it } from "vitest";
import { findPage, interpolateEndpoint, matchPath } from "./manifest-routing";

// ---------------------------------------------------------------------------
// matchPath
// ---------------------------------------------------------------------------

describe("matchPath", () => {
	it("matches an exact static path and returns empty params", () => {
		expect(matchPath("/users", "/users")).toEqual({});
	});

	it("matches the root path", () => {
		expect(matchPath("/", "/")).toEqual({});
	});

	it("extracts a single param segment", () => {
		expect(matchPath("/users/:userId", "/users/abc123")).toEqual({
			userId: "abc123",
		});
	});

	it("extracts multiple param segments", () => {
		expect(
			matchPath("/orgs/:orgId/users/:userId", "/orgs/acme/users/42"),
		).toEqual({ orgId: "acme", userId: "42" });
	});

	it("returns null when segment counts differ (path too short)", () => {
		expect(matchPath("/users/:userId", "/users")).toBeNull();
	});

	it("returns null when segment counts differ (path too long)", () => {
		expect(matchPath("/users", "/users/abc123")).toBeNull();
	});

	it("returns null when a static segment does not match", () => {
		expect(matchPath("/users/:userId", "/clients/abc123")).toBeNull();
	});

	it("returns null for a completely different path", () => {
		expect(matchPath("/users", "/clients")).toBeNull();
	});

	it("returns null when pattern root doesn't match path root", () => {
		expect(matchPath("/users/:userId", "/users/abc/extra")).toBeNull();
	});

	it("handles param at root level", () => {
		expect(matchPath("/:id", "/hello")).toEqual({ id: "hello" });
	});
});

// ---------------------------------------------------------------------------
// findPage
// ---------------------------------------------------------------------------

function makePage(path: string): PageDefinition {
	return {
		path,
		title: path,
		layout: "default",
		sections: [],
	};
}

describe("findPage", () => {
	it("returns null for an empty page list", () => {
		expect(findPage([], "/users")).toBeNull();
	});

	it("finds an exact static match", () => {
		const pages = [makePage("/users"), makePage("/clients")];
		const result = findPage(pages, "/users");
		expect(result).not.toBeNull();
		expect(result?.page.path).toBe("/users");
		expect(result?.pathParams).toEqual({});
	});

	it("finds a parameterized match", () => {
		const pages = [makePage("/users/:userId")];
		const result = findPage(pages, "/users/abc");
		expect(result).not.toBeNull();
		expect(result?.page.path).toBe("/users/:userId");
		expect(result?.pathParams).toEqual({ userId: "abc" });
	});

	it("prefers exact match over parameterized match", () => {
		const pages = [makePage("/users/:userId"), makePage("/users/me")];
		const result = findPage(pages, "/users/me");
		expect(result?.page.path).toBe("/users/me");
		expect(result?.pathParams).toEqual({});
	});

	it("falls back to parameterized when no exact match", () => {
		const pages = [makePage("/users/me"), makePage("/users/:userId")];
		const result = findPage(pages, "/users/other");
		expect(result?.page.path).toBe("/users/:userId");
		expect(result?.pathParams).toEqual({ userId: "other" });
	});

	it("returns null when no page matches", () => {
		const pages = [makePage("/users"), makePage("/users/:userId")];
		expect(findPage(pages, "/clients")).toBeNull();
	});

	it("matches the root page", () => {
		const pages = [makePage("/"), makePage("/about")];
		const result = findPage(pages, "/");
		expect(result?.page.path).toBe("/");
		expect(result?.pathParams).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// interpolateEndpoint
// ---------------------------------------------------------------------------

describe("interpolateEndpoint", () => {
	it("replaces a single param", () => {
		expect(interpolateEndpoint("/api/users/:userId", { userId: "abc" })).toBe(
			"/api/users/abc",
		);
	});

	it("replaces multiple params", () => {
		expect(
			interpolateEndpoint("/api/orgs/:orgId/users/:userId", {
				orgId: "acme",
				userId: "42",
			}),
		).toBe("/api/orgs/acme/users/42");
	});

	it("URI-encodes values with spaces", () => {
		expect(interpolateEndpoint("/api/users/:userId", { userId: "a b" })).toBe(
			"/api/users/a%20b",
		);
	});

	it("URI-encodes values with slashes", () => {
		expect(interpolateEndpoint("/api/users/:userId", { userId: "a b/c" })).toBe(
			"/api/users/a%20b%2Fc",
		);
	});

	it("leaves unmatched params as-is", () => {
		expect(interpolateEndpoint("/api/users/:userId", {})).toBe(
			"/api/users/:userId",
		);
	});

	it("returns the template unchanged when no params", () => {
		expect(interpolateEndpoint("/api/users", {})).toBe("/api/users");
	});

	it("partially replaces when only some params are provided", () => {
		expect(
			interpolateEndpoint("/api/orgs/:orgId/users/:userId", {
				orgId: "acme",
			}),
		).toBe("/api/orgs/acme/users/:userId");
	});
});
