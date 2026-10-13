import { afterEach, describe, expect, it, vi } from "vitest";
import { marked } from "~/lib/markdown";
import { sanitizeMarkdownHtml } from "./markdown-sanitize";

const clean = (html: string) => sanitizeMarkdownHtml(html, "guidebook");

describe("sanitizeMarkdownHtml", () => {
	it("removes script, event handlers and javascript: links", () => {
		const out = clean(
			'<script>alert(1)</script><img src="https://x.test/a.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
		);
		expect(out).not.toContain("<script");
		expect(out).not.toContain("onerror");
		expect(out).not.toContain("javascript:");
	});

	it.each([
		[
			"a form that could post to a service as the viewer",
			'<form method="post" action="/api/proxy/ledger/api/invoices"><button>Claim</button></form>',
			["<form", "<button", "action="],
		],
		[
			"a standalone submit button",
			'<button formaction="/api/proxy/ledger/x">go</button>',
			["<button", "formaction"],
		],
		["an iframe", '<iframe src="https://x.test"></iframe>', ["<iframe"]],
		[
			"an object or embed",
			'<object data="x"></object><embed src="x">',
			["<object", "<embed"],
		],
		["a style tag", "<style>body{display:none}</style>", ["<style"]],
		["a base tag", '<base href="https://evil.test/">', ["<base"]],
		[
			"a meta refresh",
			'<meta http-equiv="refresh" content="0;url=https://evil.test">',
			["<meta"],
		],
		[
			"srcset",
			'<img src="https://x.test/a.png" srcset="https://evil.test/b.png 2x">',
			["srcset"],
		],
	])("removes %s", (_label, html, banned) => {
		const out = clean(html);
		for (const fragment of banned) expect(out).not.toContain(fragment);
	});

	describe("images", () => {
		const src = (html: string) => clean(html).match(/src="([^"]*)"/)?.[1];

		it.each([
			["an https image", "https://cdn.test/a.png"],
			["a small data image", "data:image/png;base64,iVBORw0KGgo="],
			["the same service's proxy path", "/api/proxy/guidebook/api/files/a.png"],
		])("keeps %s", (_label, url) => {
			expect(src(`<img src="${url}">`)).toBe(url);
		});

		it.each([
			["another service's proxy path", "/api/proxy/ledger/api/invoices/1"],
			["a dashboard path", "/api/permissions/ledger"],
			["a proxy path that climbs out", "/api/proxy/guidebook/../ledger/api/x"],
			["an encoded climb", "/api/proxy/guidebook/%2e%2e/ledger/api/x"],
			["a backslash climb", "/api/proxy/guidebook/..\\ledger/api/x"],
			["plain http", "http://x.test/a.png"],
			["a protocol-relative url", "//x.test/a.png"],
			["an svg data url", "data:image/svg+xml;base64,PHN2Zz4="],
			["an html data url", "data:text/html;base64,PHNjcmlwdD4="],
			["a javascript url", "javascript:alert(1)"],
			["a relative path on the dashboard", "relative.png"],
		])("drops %s", (_label, url) => {
			expect(clean(`<img src="${url}">`)).not.toContain(url);
		});
	});

	describe("other ways to make the viewer's browser fetch a URL", () => {
		const own = "https://dash.example.com";

		afterEach(() => {
			vi.unstubAllEnvs();
		});

		it.each([
			[
				"an absolute url to the dashboard's own host",
				`<img src="${own}/api/proxy/ledger/api/invoices/1">`,
			],
			[
				"an image-type input",
				'<input type="image" src="/api/proxy/ledger/api/x">',
			],
			["a video", '<video src="/api/proxy/ledger/api/x"></video>'],
			[
				"an audio element",
				'<audio src="/api/proxy/ledger/api/x" autoplay></audio>',
			],
			[
				"a source inside a video",
				'<video><source src="/api/proxy/ledger/api/x"></video>',
			],
			["a video poster", '<video poster="/api/proxy/ledger/api/x"></video>'],
			["a track", '<video><track src="/api/proxy/ledger/api/x"></video>'],
			[
				"a table background",
				'<table><tr><td background="/api/proxy/ledger/api/x">x</td></tr></table>',
			],
			[
				"an svg image",
				'<svg><image href="/api/proxy/ledger/api/x"></image></svg>',
			],
			[
				"an svg image with an xlink href",
				'<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="/api/proxy/ledger/api/x"></image></svg>',
			],
			[
				"a picture source",
				'<picture><source srcset="/api/proxy/ledger/api/x"><img src="https://x.test/a.png"></picture>',
			],
		])("drops %s", (_label, html) => {
			vi.stubEnv("DASHBOARD_URL", own);
			expect(clean(html)).not.toContain("/api/proxy/ledger");
		});

		it("still keeps a checkbox input", () => {
			expect(clean('<input type="checkbox" checked disabled>')).toContain(
				'type="checkbox"',
			);
		});

		it("keeps the same service's proxy path even when written with the dashboard's own host", () => {
			vi.stubEnv("DASHBOARD_URL", own);
			expect(
				clean(`<img src="${own}/api/proxy/guidebook/api/files/a.png">`),
			).toContain("/api/proxy/guidebook/api/files/a.png");
		});
	});

	describe("inline style", () => {
		it("keeps what the callout extension emits", () => {
			const html = marked.parse("> [!NOTE]\n> hello", {
				async: false,
			}) as string;
			const out = clean(html);
			expect(out).toContain("markdown-callout");
			expect(out).toContain("display:flex");
		});

		it.each([
			["position: fixed", 'style="position:fixed;inset:0;z-index:9999"'],
			["position: absolute", 'style="position: absolute; top: 0"'],
			["an overlay by z-index", 'style="z-index: 10; color: red"'],
			[
				"a remote background",
				'style="background: url(https://evil.test/x.png)"',
			],
			[
				"an image-set background",
				'style="background-image: image-set(url(https://evil.test/x.png) 1x)"',
			],
			["an expression", 'style="width: expression(alert(1))"'],
		])("strips %s", (_label, attr) => {
			const out = clean(`<div ${attr}>x</div>`);
			expect(out).not.toMatch(
				/position\s*:|z-index|url\(|image-set|expression/i,
			);
		});

		it("keeps harmless declarations next to a stripped one", () => {
			const out = clean('<div style="color: red; position: fixed">x</div>');
			expect(out).toContain("color");
			expect(out).not.toContain("position");
		});
	});

	it("keeps ordinary markdown output", () => {
		const html = marked.parse(
			"# Title\n\n- [x] done\n- [ ] todo\n\n[link](https://x.test) and `code`",
			{ async: false },
		) as string;
		const out = clean(html);
		expect(out).toContain("<h1");
		expect(out).toContain('type="checkbox"');
		expect(out).toContain('href="https://x.test"');
		expect(out).toContain("<code>");
	});
});
