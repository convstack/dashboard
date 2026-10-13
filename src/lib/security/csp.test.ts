import { describe, expect, it } from "vitest";
import { buildCsp, PROXIED_CSP, parseSources } from "./csp";

describe("buildCsp", () => {
	const csp = buildCsp({ nonce: "abc123" });
	const directive = (name: string) =>
		csp.split("; ").find((d) => d.startsWith(`${name} `));

	it("allows scripts only from self and the request's nonce", () => {
		expect(directive("script-src")).toBe("script-src 'self' 'nonce-abc123'");
		expect(csp).not.toContain("unsafe-eval");
		expect(directive("script-src")).not.toContain("unsafe-inline");
	});

	it("locks frames, forms, base and objects", () => {
		expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
		expect(directive("form-action")).toBe("form-action 'self'");
		expect(directive("base-uri")).toBe("base-uri 'self'");
		expect(directive("object-src")).toBe("object-src 'none'");
		expect(directive("default-src")).toBe("default-src 'self'");
	});

	it("keeps fetches to the dashboard and images open to https", () => {
		expect(directive("connect-src")).toBe("connect-src 'self'");
		expect(directive("img-src")).toBe("img-src 'self' data: https:");
	});

	it("adds the self-hoster's extra sources to images and fetches only", () => {
		const extended = buildCsp({
			nonce: "n",
			imgSources: ["https://cdn.example.com"],
			connectSources: ["https://api.example.com", "wss://live.example.com"],
		});
		expect(extended).toContain(
			"img-src 'self' data: https: https://cdn.example.com",
		);
		expect(extended).toContain(
			"connect-src 'self' https://api.example.com wss://live.example.com",
		);
		expect(extended).toContain("script-src 'self' 'nonce-n'");
	});
});

describe("buildCsp page-specific sources", () => {
	it("adds script and style sources only when asked", () => {
		const plain = buildCsp({ nonce: "n" });
		expect(plain).not.toContain("jsdelivr");

		const docs = buildCsp({
			nonce: "n",
			scriptSources: ["https://cdn.jsdelivr.net"],
			styleSources: ["https://cdn.jsdelivr.net"],
		});
		expect(docs).toContain(
			"script-src 'self' 'nonce-n' https://cdn.jsdelivr.net",
		);
		expect(docs).toContain(
			"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
		);
		expect(docs).toContain("connect-src 'self'");
	});
});

describe("buildCsp form targets", () => {
	it("lets a form hand off to the identity provider only when asked", () => {
		expect(buildCsp({ nonce: "n" })).toContain("form-action 'self'");
		expect(
			buildCsp({ nonce: "n", formActionSources: ["https://idp.example.com"] }),
		).toContain("form-action 'self' https://idp.example.com");
	});
});

describe("PROXIED_CSP", () => {
	it("sandboxes and blocks everything", () => {
		expect(PROXIED_CSP).toContain("sandbox");
		expect(PROXIED_CSP).toContain("default-src 'none'");
	});
});

describe("parseSources", () => {
	it("returns nothing for a missing or blank value", () => {
		expect(parseSources("X", undefined)).toEqual([]);
		expect(parseSources("X", "")).toEqual([]);
		expect(parseSources("X", "   ")).toEqual([]);
	});

	it("splits on any whitespace and ignores the edges", () => {
		expect(
			parseSources(
				"X",
				"  https://a.example.com\thttps://b.example.com   https: ",
			),
		).toEqual(["https://a.example.com", "https://b.example.com", "https:"]);
	});

	it("accepts hosts, wildcards, ports and paths", () => {
		expect(
			parseSources(
				"X",
				"cdn.example.com *.example.com localhost:9000 http://127.0.0.1:9000 https://a.example.com/img/",
			),
		).toHaveLength(5);
	});

	it.each([
		[
			"a semicolon that would start a new directive",
			"https://a.test; script-src *",
		],
		["a quote that would make a keyword", "'unsafe-inline'"],
		["a comma", "https://a.test,https://b.test"],
		["a lone wildcard", "*"],
		["a path-less nonsense token", "not a source!"],
	])("rejects %s and names the setting", (_label, value) => {
		expect(() => parseSources("DASHBOARD_CSP_IMG_SRC", value)).toThrow(
			/DASHBOARD_CSP_IMG_SRC/,
		);
	});
});
