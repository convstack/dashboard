import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("lanyard-client", () => {
	it("doesn't double the slash when LANYARD_URL ends with one", async () => {
		vi.stubEnv("LANYARD_URL", "http://lanyard.test:3000/");
		const fetchSpy = vi.fn(async (_url: string) => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);
		const { LANYARD_URL, lanyardFetch } = await import("./lanyard-client");

		await lanyardFetch("/api/services/catalog");

		expect(LANYARD_URL).toBe("http://lanyard.test:3000");
		expect(fetchSpy.mock.calls[0][0]).toBe(
			"http://lanyard.test:3000/api/services/catalog",
		);
	});
});
