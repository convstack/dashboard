import { describe, expect, it } from "vitest";
import { forBrowser } from "./browser-catalog";
import type { ServiceCatalogEntry } from "./types/catalog";

const entry = (slug: string, baseUrl: string): ServiceCatalogEntry => ({
	id: slug,
	name: slug,
	slug,
	type: "service",
	description: null,
	version: "1",
	baseUrl,
	uiManifest: null,
	status: "active",
	lastHealthCheck: null,
	lastHealthStatus: null,
});

describe("forBrowser", () => {
	it("blanks every base url and keeps the rest", () => {
		const input = [
			entry("ledger", "http://ledger.internal:5002"),
			entry("guidebook", "http://10.0.0.7:5000"),
		];
		const out = forBrowser(input);
		expect(out.map((s) => s.baseUrl)).toEqual(["", ""]);
		expect(out.map((s) => s.slug)).toEqual(["ledger", "guidebook"]);
		expect(JSON.stringify(out)).not.toContain("internal");
		expect(JSON.stringify(out)).not.toContain("10.0.0.7");
	});

	it("leaves the input alone", () => {
		const input = [entry("ledger", "http://ledger.internal:5002")];
		forBrowser(input);
		expect(input[0].baseUrl).toBe("http://ledger.internal:5002");
	});
});
