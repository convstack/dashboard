import { describe, expect, it } from "vitest";
import { computeRefreshDelayMs } from "./refresh-timing";

describe("computeRefreshDelayMs", () => {
	it("schedules a 5-minute token's refresh well before expiry, not at 0", () => {
		const delay = computeRefreshDelayMs(300);
		expect(delay).toBe(240_000);
		expect(delay).toBeGreaterThan(0);
	});

	it("scales proportionally for a much longer token", () => {
		const delay = computeRefreshDelayMs(86_400);
		expect(delay).toBe(86_400 * 0.8 * 1000);
	});

	it("floors at a positive delay instead of firing immediately near/past expiry", () => {
		expect(computeRefreshDelayMs(0)).toBe(5000);
		expect(computeRefreshDelayMs(-50)).toBe(5000);
	});
});
