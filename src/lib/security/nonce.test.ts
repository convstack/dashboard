import { describe, expect, it } from "vitest";
import { nonceFor } from "./nonce";

describe("nonceFor", () => {
	it("returns the same nonce for the same request", () => {
		const request = new Request("http://dashboard.test/");
		expect(nonceFor(request)).toBe(nonceFor(request));
	});

	it("returns a different, unpredictable-looking nonce for another request", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 50; i++) {
			seen.add(nonceFor(new Request("http://dashboard.test/")));
		}
		expect(seen.size).toBe(50);
		for (const nonce of seen) {
			expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
		}
	});
});
