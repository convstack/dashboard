import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getServiceCatalogFn = vi.fn();

vi.mock("../../src/server/functions/auth", () => ({
	getSessionFn: async () => ({
		expiresAt: Math.floor(Date.now() / 1000) + 200,
		user: { id: "u1", name: "Ada", email: "ada@x.dev", role: "user" },
	}),
}));
vi.mock("../../src/server/functions/catalog", () => ({
	getServiceCatalogFn: (...args: unknown[]) => getServiceCatalogFn(...args),
}));

const list = [{ slug: "svc", baseUrl: "" }];

async function load() {
	const { Route } = await import("../../src/routes/_authenticated");
	return Route.options.beforeLoad();
}

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
	vi.stubGlobal("window", {});
});

afterEach(() => {
	getServiceCatalogFn.mockReset();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const later = () => vi.advanceTimersByTime(31_000);

describe("_authenticated beforeLoad in the browser", () => {
	it("reuses a list for half a minute", async () => {
		getServiceCatalogFn.mockResolvedValue(list);
		await load();
		await load();
		expect(getServiceCatalogFn).toHaveBeenCalledTimes(1);
	});

	it("drops the list once lanyard says there is nothing to see", async () => {
		getServiceCatalogFn.mockResolvedValueOnce(list);
		expect((await load()).services).toEqual(list);

		later();
		getServiceCatalogFn.mockResolvedValueOnce([]);
		const refused = await load();

		expect(refused.services).toEqual([]);
		expect(refused.servicesUnavailable).toBe(false);
	});

	it("keeps the last list through a lanyard failure", async () => {
		getServiceCatalogFn.mockResolvedValueOnce(list);
		await load();

		later();
		getServiceCatalogFn.mockRejectedValueOnce(new Error("lanyard down"));
		const during = await load();

		expect(during.services).toEqual(list);
		expect(during.servicesUnavailable).toBe(false);
	});

	it("reports the list as unavailable when the first load fails", async () => {
		getServiceCatalogFn.mockRejectedValueOnce(new Error("lanyard down"));
		const first = await load();

		expect(first.services).toEqual([]);
		expect(first.servicesUnavailable).toBe(true);
	});
});
