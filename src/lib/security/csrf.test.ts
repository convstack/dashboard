import { afterEach, describe, expect, it, vi } from "vitest";
import { validateOrigin } from "./csrf";

function post(headers: Record<string, string> = {}) {
	return new Request("http://dashboard.test/api/anything", {
		method: "POST",
		headers,
	});
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("validateOrigin", () => {
	it("accepts the configured dashboard origin", () => {
		vi.stubEnv("DASHBOARD_URL", "https://dash.example.com/");
		expect(validateOrigin(post({ origin: "https://dash.example.com" }))).toBe(
			true,
		);
	});

	it.each([
		["another site", "https://evil.test"],
		["a look-alike host", "https://dash.example.com.evil.test"],
		["the wrong scheme", "http://dash.example.com"],
		["the wrong port", "https://dash.example.com:8443"],
		["a null origin", "null"],
	])("refuses %s", (_label, origin) => {
		vi.stubEnv("DASHBOARD_URL", "https://dash.example.com");
		expect(validateOrigin(post({ origin }))).toBe(false);
	});

	it("no longer trusts the old hardcoded localhost origin", () => {
		vi.stubEnv("DASHBOARD_URL", "https://dash.example.com");
		expect(validateOrigin(post({ origin: "http://localhost:4000" }))).toBe(
			false,
		);
	});

	it("falls back to Sec-Fetch-Site when there is no Origin header", () => {
		vi.stubEnv("DASHBOARD_URL", "https://dash.example.com");
		expect(validateOrigin(post({ "sec-fetch-site": "same-origin" }))).toBe(
			true,
		);
		expect(validateOrigin(post({ "sec-fetch-site": "same-site" }))).toBe(false);
		expect(validateOrigin(post({ "sec-fetch-site": "cross-site" }))).toBe(
			false,
		);
		expect(validateOrigin(post({ "sec-fetch-site": "none" }))).toBe(false);
	});

	it("refuses a request that carries neither header", () => {
		vi.stubEnv("DASHBOARD_URL", "https://dash.example.com");
		expect(validateOrigin(post())).toBe(false);
	});

	it("lets a wrong Origin win over a same-origin Sec-Fetch-Site", () => {
		vi.stubEnv("DASHBOARD_URL", "https://dash.example.com");
		expect(
			validateOrigin(
				post({ origin: "https://evil.test", "sec-fetch-site": "same-origin" }),
			),
		).toBe(false);
	});
});
