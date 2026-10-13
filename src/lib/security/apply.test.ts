import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "./apply";

const options = {
	nonce: "nonce-1",
	pathname: "/home",
	production: true,
	imgSources: [],
	connectSources: [],
	noStorePrefixes: ["/_serverFn/", "/api/"],
};

function html() {
	return new Response("<html></html>", {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

describe("applySecurityHeaders", () => {
	it("adds the plain headers and an enforced CSP in production", () => {
		const res = applySecurityHeaders(html(), options);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
		expect(res.headers.get("Content-Security-Policy")).toContain(
			"'nonce-nonce-1'",
		);
		expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
	});

	it("only reports in development, and sends no HSTS", () => {
		const res = applySecurityHeaders(html(), { ...options, production: false });
		expect(res.headers.get("Content-Security-Policy")).toBeNull();
		expect(res.headers.get("Content-Security-Policy-Report-Only")).toContain(
			"'nonce-nonce-1'",
		);
		expect(res.headers.get("Strict-Transport-Security")).toBeNull();
	});

	it("marks pages, server functions and API answers no-store", () => {
		expect(
			applySecurityHeaders(html(), options).headers.get("Cache-Control"),
		).toBe("no-store");
		for (const pathname of [
			"/_serverFn/abc",
			"/api/permissions/x",
			"/api/auth/refresh",
		]) {
			const res = applySecurityHeaders(new Response("{}"), {
				...options,
				pathname,
			});
			expect(res.headers.get("Cache-Control")).toBe("no-store");
		}
	});

	it("leaves an answer's own Cache-Control and CSP alone", () => {
		const res = applySecurityHeaders(
			new Response("{}", {
				headers: {
					"Cache-Control": "private, max-age=5",
					"Content-Security-Policy": "default-src 'none'",
				},
			}),
			{ ...options, pathname: "/api/x" },
		);
		expect(res.headers.get("Cache-Control")).toBe("private, max-age=5");
		expect(res.headers.get("Content-Security-Policy")).toBe(
			"default-src 'none'",
		);
	});

	it("sandboxes everything under the proxy, whatever the service sent", () => {
		const hostile = new Response("<script>alert(1)</script>", {
			headers: { "Content-Type": "text/html" },
		});
		const res = applySecurityHeaders(hostile, {
			...options,
			pathname: "/api/proxy/evil/page",
			production: false,
		});
		expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
		expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("replaces any CSP a proxied answer arrives with, report-only ones included", () => {
		for (const name of [
			"Content-Security-Policy",
			"Content-Security-Policy-Report-Only",
		]) {
			const res = applySecurityHeaders(
				new Response("<script>alert(1)</script>", {
					headers: { "Content-Type": "text/html", [name]: "default-src *" },
				}),
				{ ...options, pathname: "/api/proxy/evil/page" },
			);
			expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
			expect(res.headers.get("Content-Security-Policy")).not.toContain("*");
			expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
		}
	});

	it.each([
		["upper case", "/API/proxy/evil/page"],
		["mixed case", "/Api/Proxy/evil/page"],
		["an encoded letter", "/%61pi/proxy/evil/page"],
		["a doubled slash", "//api/proxy/evil/page"],
		["an encoded slash after the prefix", "/api/proxy%2Fevil/page"],
	])("sandboxes the proxy however the path is spelled: %s", (_label, pathname) => {
		const res = applySecurityHeaders(
			new Response("<script src=/api/proxy/evil/app.js></script>", {
				headers: { "Content-Type": "text/html" },
			}),
			{ ...options, pathname },
		);
		expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it.each([
		["upper case", "/API/permissions/x"],
		["an encoded letter", "/%61pi/auth/refresh"],
		["an encoded underscore", "/%5FserverFn/abc"],
		["mixed case", "/_SERVERFN/abc"],
	])("keeps private answers out of caches however the path is spelled: %s", (_label, pathname) => {
		const res = applySecurityHeaders(new Response("{}"), {
			...options,
			pathname,
		});
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("does not throw on a path with a broken escape", () => {
		const res = applySecurityHeaders(new Response("{}"), {
			...options,
			pathname: "/api/%E0%A4%A",
		});
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("does not throw on a response with immutable headers", () => {
		const redirect = Response.redirect("http://dashboard.test/login", 303);
		const res = applySecurityHeaders(redirect, options);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("http://dashboard.test/login");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("keeps status, body and every Set-Cookie", async () => {
		const headers = new Headers({ "Content-Type": "application/json" });
		headers.append("Set-Cookie", "a=1; Path=/");
		headers.append("Set-Cookie", "b=2; Path=/");
		const res = applySecurityHeaders(
			new Response('{"ok":true}', { status: 201, headers }),
			{ ...options, pathname: "/api/auth/x" },
		);
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ ok: true });
		expect(res.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
	});
});
