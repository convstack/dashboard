import { beforeEach, describe, expect, it, vi } from "vitest";

let session: { user: { id: string }; accessToken: string } | null = null;
let catalogs: Array<Array<{ slug: string; baseUrl: string }>> = [];
let catalogError: Error | null = null;
const getCachedCatalog = vi.fn();
const serviceTarget = vi.fn();

vi.mock("@tanstack/react-start", () => ({
	createServerOnlyFn: (fn: unknown) => fn,
}));
vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => new Request("http://x"),
}));
vi.mock("./auth", () => ({ readSession: async () => session }));
vi.mock("./service-proxy", () => ({
	getCachedCatalog: (...a: unknown[]) => getCachedCatalog(...a),
	serviceTarget: (...a: unknown[]) => serviceTarget(...a),
}));

beforeEach(() => {
	session = { user: { id: "u1" }, accessToken: "tok" };
	catalogs = [[{ slug: "ledger", baseUrl: "http://ledger.internal:5002" }]];
	catalogError = null;
	getCachedCatalog.mockReset().mockImplementation(async (_u, _t, refresh) => {
		if (catalogError) throw catalogError;
		const services = catalogs[refresh ? 1 : 0] ?? catalogs[0];
		return { services, fromCache: !refresh };
	});
	serviceTarget.mockReset().mockImplementation(async (s) => ({
		baseUrl: s.baseUrl,
		authorization: "Bearer proof",
	}));
});

describe("serverServiceTarget", () => {
	it("resolves the real base url from the server's catalog, not from the argument", async () => {
		const { serverServiceTarget } = await import("./server-target");
		const target = await serverServiceTarget({ slug: "ledger" });
		expect(target).toEqual({
			baseUrl: "http://ledger.internal:5002",
			authorization: "Bearer proof",
		});
		expect(serviceTarget).toHaveBeenCalledWith(
			expect.objectContaining({ baseUrl: "http://ledger.internal:5002" }),
			"tok",
		);
	});

	it("gives nothing without a session", async () => {
		session = null;
		const { serverServiceTarget } = await import("./server-target");
		expect(await serverServiceTarget({ slug: "ledger" })).toEqual({
			baseUrl: "",
			authorization: null,
		});
		expect(getCachedCatalog).not.toHaveBeenCalled();
	});

	it("refuses a service the catalog doesn't list for this user", async () => {
		const { serverServiceTarget } = await import("./server-target");
		const target = await serverServiceTarget({ slug: "secret" });
		expect(target).toEqual({
			baseUrl: "",
			authorization: null,
			failure: "forbidden",
		});
		expect(serviceTarget).not.toHaveBeenCalled();
	});

	it("refreshes once when a cached catalog predates the service", async () => {
		catalogs = [
			[],
			[{ slug: "ledger", baseUrl: "http://ledger.internal:5002" }],
		];
		const { serverServiceTarget } = await import("./server-target");
		const target = await serverServiceTarget({ slug: "ledger" });
		expect(target.authorization).toBe("Bearer proof");
		expect(getCachedCatalog).toHaveBeenLastCalledWith("u1", "tok", true);
	});

	it("reports unavailable when the catalog call fails", async () => {
		catalogError = new Error("lanyard is down");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const { serverServiceTarget } = await import("./server-target");
		expect(await serverServiceTarget({ slug: "ledger" })).toEqual({
			baseUrl: "",
			authorization: null,
			failure: "unavailable",
		});
	});
});
