import { afterEach, describe, expect, it, vi } from "vitest";
import { isSafeImageSrc, safeRedirect } from "./safe-url";

const own = "https://dash.example.com";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("isSafeImageSrc", () => {
	it.each([
		["an https image", "https://cdn.test/a.png"],
		["plain http on this machine", "http://127.0.0.1:9002/lanyard/a.png"],
		["plain http on localhost", "http://localhost:9002/lanyard/a.png"],
		["plain http on the ipv6 loopback", "http://[::1]:9002/lanyard/a.png"],
		["a small raster data image", "data:image/png;base64,iVBORw0KGgo="],
		["the service's proxy path", "/api/proxy/guidebook/api/files/a.png"],
		[
			"the same path with the dashboard's own host",
			`${own}/api/proxy/guidebook/api/files/a.png`,
		],
	])("allows %s", (_label, src) => {
		vi.stubEnv("DASHBOARD_URL", own);
		expect(isSafeImageSrc(src, "guidebook")).toBe(true);
	});

	it.each([
		["a javascript url", "javascript:alert(1)"],
		["plain http", "http://cdn.test/a.png"],
		[
			"a host that only starts like localhost",
			"http://localhost.evil.test/a.png",
		],
		[
			"a localhost user name on another host",
			"http://localhost@evil.test/a.png",
		],
		["a protocol-relative url", "//cdn.test/a.png"],
		["a backslash host", "/\\cdn.test/a.png"],
		["an svg data image", "data:image/svg+xml;base64,PHN2Zz4="],
		["an html data url", "data:text/html;base64,PHNjcmlwdD4="],
		["another service's proxy path", "/api/proxy/ledger/api/invoices/1"],
		[
			"another service's path on the dashboard's own host",
			`${own}/api/proxy/ledger/api/invoices/1`,
		],
		["a dashboard path", "/api/permissions/ledger"],
		["a proxy path that climbs out", "/api/proxy/guidebook/../ledger/api/x"],
		["an encoded climb", "/api/proxy/guidebook/%2e%2e/ledger/api/x"],
		["a backslash climb", "/api/proxy/guidebook/..\\ledger/api/x"],
		["a relative file name", "avatar.png"],
		["a proxy path without the leading slash", "api/proxy/guidebook/a.png"],
		["an empty string", ""],
	])("refuses %s", (_label, src) => {
		vi.stubEnv("DASHBOARD_URL", own);
		expect(isSafeImageSrc(src, "guidebook")).toBe(false);
	});

	it("allows no proxy path at all without a service", () => {
		expect(isSafeImageSrc("/api/proxy//api/x", "")).toBe(false);
		expect(isSafeImageSrc("/api/proxy/guidebook/a.png", "")).toBe(false);
		expect(isSafeImageSrc("https://cdn.test/a.png", "")).toBe(true);
	});
});

describe("safeRedirect", () => {
	it.each([
		["a path", "/guidebook/pages/start", "/guidebook/pages/start"],
		["a path with a query and a hash", "/a/b?c=1#d", "/a/b?c=1#d"],
		["the root", "/", "/"],
	])("keeps %s", (_label, target, expected) => {
		expect(safeRedirect(target)).toBe(expected);
	});

	it.each([
		["a protocol-relative url", "//evil.test"],
		["a protocol-relative url with a backslash", "/\\evil.test"],
		["a tab inside the slashes", "/\t/evil.test"],
		["a newline inside the slashes", "/\n/evil.test"],
		["a dot segment ahead of a double slash", "/.//evil.test"],
		["a climb ahead of a double slash", "/a/..//evil.test"],
		["an encoded climb ahead of a double slash", "/x/%2e%2e//evil.test"],
		["an absolute https url", "https://evil.test/x"],
		["an absolute url to the dashboard itself", `${own}/home`],
		["a javascript url", "javascript:alert(1)"],
		["a data url", "data:text/html,x"],
		["a relative path", "guidebook/pages"],
		["an empty string", ""],
		["undefined", undefined],
		["a number", 42],
		["an object", { to: "/home" }],
	])("refuses %s", (_label, target) => {
		expect(safeRedirect(target)).toBeNull();
	});
});
