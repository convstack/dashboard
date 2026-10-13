import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSession } from "../../src/lib/auth";
import { __resetCatalogCache } from "../../src/lib/service-proxy";

function jwt(payload: Record<string, unknown>): string {
	const encode = (value: object) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const accessToken = jwt({
	sub: "sub-1",
	iat: Math.floor(Date.now() / 1000) - 10,
});

const lanyardFetch = vi.fn();
let lastEntry: unknown = null;

vi.mock("../../src/lib/lanyard-client", () => ({
	LANYARD_URL: "http://lanyard.test",
	lanyardFetch: (...args: unknown[]) => lanyardFetch(...args),
}));

let currentRequest: Request;

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => currentRequest,
}));

const session = {
	accessToken,
	refreshToken: "refresh",
	expiresAt: Math.floor(Date.now() / 1000) + 200,
	user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
};

const clientSession = { expiresAt: session.expiresAt, user: session.user };

beforeEach(async () => {
	currentRequest = new Request("http://dashboard.test/svc", {
		headers: { cookie: `dashboard_session=${await encryptSession(session)}` },
	});
});

const page = (path: string, sections: unknown[]) => ({
	path,
	title: "Page",
	layout: "default",
	sections,
});

function entry(pages: unknown[], extra: Record<string, unknown> = {}) {
	const built = {
		id: "svc-id",
		name: "Svc",
		slug: "svc",
		type: "service",
		description: null,
		version: null,
		baseUrl: "http://svc.test",
		status: "active",
		lastHealthCheck: null,
		lastHealthStatus: null,
		uiManifest: {
			name: "Svc",
			icon: "box",
			version: "1",
			navigation: [],
			widgets: [],
			permissions: [],
			pages,
		},
		...extra,
	};
	// the loaders look the full entry up in the server's catalog
	lastEntry = built;
	return built;
}

function stubFetches(
	answer: object = { permissions: [], orgRoles: [], proof: "proof-token" },
) {
	lanyardFetch.mockImplementation(
		async (path: string) =>
			new Response(
				JSON.stringify(path === "/api/services/catalog" ? [lastEntry] : answer),
			),
	);
	const fetchSpy = vi.fn(
		async (_url: string, _init: RequestInit) =>
			new Response(JSON.stringify({ ok: true })),
	);
	vi.stubGlobal("fetch", fetchSpy);
	return fetchSpy;
}

async function loadIndex(service: ReturnType<typeof entry>) {
	const { Route } = await import(
		"../../src/routes/_authenticated/$service/index"
	);
	return Route.options.loader({
		params: { service: service.slug },
		context: { session: clientSession, services: [service] },
	} as never);
}

afterEach(() => {
	__resetCatalogCache();
	lanyardFetch.mockReset();
	vi.unstubAllGlobals();
});

describe("service page loaders", () => {
	it("report an unavailable app list instead of a missing service", async () => {
		const { Route } = await import(
			"../../src/routes/_authenticated/$service/index"
		);
		const { Route: Splat } = await import(
			"../../src/routes/_authenticated/$service/$"
		);
		const args = {
			params: { service: "svc", _splat: "x" },
			context: {
				session: clientSession,
				services: [],
				servicesUnavailable: true,
			},
		} as never;
		await expect(Route.options.loader(args)).rejects.toThrow(/reload/i);
		await expect(Splat.options.loader(args)).rejects.toThrow(/reload/i);
	});

	it("still treat a service missing from a loaded list as not found", async () => {
		const { Route } = await import(
			"../../src/routes/_authenticated/$service/index"
		);
		const result = await Route.options.loader({
			params: { service: "svc" },
			context: {
				session: clientSession,
				services: [],
				servicesUnavailable: false,
			},
		} as never);
		expect(result).toBeNull();
	});

	it("send a service lanyard's proof and nothing else", async () => {
		const fetchSpy = stubFetches();

		await loadIndex(
			entry([
				page("/", [{ type: "detail", endpoint: "/api/items", config: {} }]),
			]),
		);

		expect(fetchSpy.mock.calls).toEqual([
			[
				"http://svc.test/api/items",
				{ headers: { Authorization: "Bearer proof-token" } },
			],
		]);
	});

	it("gets the token from the request's cookie, never from the route context", async () => {
		const fetchSpy = stubFetches();
		expect(JSON.stringify(clientSession)).not.toMatch(/token/i);

		await loadIndex(
			entry([
				page("/", [{ type: "detail", endpoint: "/api/items", config: {} }]),
			]),
		);

		expect(lanyardFetch).toHaveBeenCalledWith("/api/services/svc/permissions", {
			accessToken,
		});
		expect(fetchSpy.mock.calls).toEqual([
			[
				"http://svc.test/api/items",
				{ headers: { Authorization: "Bearer proof-token" } },
			],
		]);
	});

	it("yields no section data and asks nobody when the request has no session", async () => {
		currentRequest = new Request("http://dashboard.test/svc");
		const fetchSpy = stubFetches();

		const data = await loadIndex(
			entry([
				page("/", [{ type: "detail", endpoint: "/api/items", config: {} }]),
			]),
		);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(lanyardFetch).not.toHaveBeenCalled();
		expect(data?.sectionData).toEqual([null]);
	});

	it("send lanyard's own pages the user's token at LANYARD_URL", async () => {
		const fetchSpy = stubFetches();

		await loadIndex(
			entry(
				[
					page("/", [
						{ type: "detail", endpoint: "/api/user/profile", config: {} },
					]),
				],
				{
					slug: "my-account",
					baseUrl: "http://localhost:3000",
					lanyardOwned: true,
				},
			),
		);

		expect(fetchSpy.mock.calls).toEqual([
			[
				"http://lanyard.test/api/user/profile",
				{
					headers: { Authorization: `Bearer ${accessToken}` },
					redirect: "manual",
				},
			],
		]);
		expect(lanyardFetch).not.toHaveBeenCalledWith(
			"/api/services/my-account/permissions",
			expect.anything(),
		);
	});

	it("never fetch a section endpoint on another origin", async () => {
		const fetchSpy = stubFetches();

		const data = await loadIndex(
			entry([
				page("/", [
					{ type: "detail", endpoint: "//evil.test/x", config: {} },
					{ type: "detail", endpoint: "https://evil.test/x", config: {} },
					{ type: "detail", endpoint: "/\\evil.test/x", config: {} },
					{ type: "detail", endpoint: "/api/items", config: {} },
				]),
			]),
		);

		expect(fetchSpy.mock.calls.map(([url]) => new URL(url).origin)).toEqual([
			"http://svc.test",
			"http://svc.test",
			"http://svc.test",
		]);
		expect(data?.sectionData).toEqual([
			{ ok: true },
			null,
			{ ok: true },
			{ ok: true },
		]);
	});

	it("keep a base url's path", async () => {
		const fetchSpy = stubFetches();

		await loadIndex(
			entry(
				[page("/", [{ type: "detail", endpoint: "/api/items", config: {} }])],
				{ baseUrl: "http://svc.test/prefix" },
			),
		);

		expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
			"http://svc.test/prefix/api/items",
		]);
	});

	it("check the sections inside tabs on sub-pages too", async () => {
		const fetchSpy = stubFetches();
		const { Route } = await import(
			"../../src/routes/_authenticated/$service/$"
		);
		const service = entry([
			page("/items/:id", [
				{
					type: "tabs",
					endpoint: "",
					config: {
						tabs: [
							{
								key: "a",
								label: "A",
								sections: [
									{ type: "detail", endpoint: "@evil.test/x", config: {} },
									{ type: "detail", endpoint: "/api/items/:id", config: {} },
								],
							},
						],
					},
				},
			]),
		]);

		await Route.options.loader({
			params: { service: "svc", _splat: "items/42" },
			context: { session: clientSession, services: [service] },
		} as never);

		expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
			"http://svc.test/api/items/42",
		]);
	});

	it("check a sub-page's endpoint after filling in an empty param", async () => {
		const fetchSpy = stubFetches();
		const { Route } = await import(
			"../../src/routes/_authenticated/$service/$"
		);
		const service = entry([
			page("/items/:id", [
				{ type: "detail", endpoint: "/:id/evil.test/x", config: {} },
				{ type: "detail", endpoint: "/api/items/:id", config: {} },
			]),
		]);

		await Route.options.loader({
			params: { service: "svc", _splat: "items/" },
			context: { session: clientSession, services: [service] },
		} as never);

		expect(
			fetchSpy.mock.calls.map(([url, init]) => [new URL(url).origin, init]),
		).toEqual([
			["http://svc.test", { headers: { Authorization: "Bearer proof-token" } }],
			["http://svc.test", { headers: { Authorization: "Bearer proof-token" } }],
		]);
	});

	it("keep the browser's calls inside the service's proxy route", async () => {
		const fetchSpy = stubFetches();
		vi.stubGlobal("window", {});

		const data = await loadIndex(
			entry([
				page("/", [
					{ type: "detail", endpoint: "/../other/x", config: {} },
					{ type: "detail", endpoint: "/%2e%2e/other/x", config: {} },
					{ type: "detail", endpoint: "/api/items?x=1", config: {} },
				]),
			]),
		);

		expect(fetchSpy.mock.calls).toEqual([
			["/api/proxy/svc/api/items?x=1", { headers: {} }],
		]);
		expect(data?.sectionData).toEqual([null, null, { ok: true }]);
		expect(lanyardFetch).not.toHaveBeenCalled();
	});

	it("keep a sub-page's browser calls inside the service's proxy route", async () => {
		const fetchSpy = stubFetches();
		vi.stubGlobal("window", {});
		const { Route } = await import(
			"../../src/routes/_authenticated/$service/$"
		);
		const service = entry([
			page("/items/:id", [
				{ type: "detail", endpoint: "/..\\other/x", config: {} },
				{ type: "detail", endpoint: "/.%2E/other/x", config: {} },
				{ type: "detail", endpoint: "/api/items/:id?x=1", config: {} },
			]),
		]);

		await Route.options.loader({
			params: { service: "svc", _splat: "items/42" },
			context: { session: clientSession, services: [service] },
		} as never);

		expect(fetchSpy.mock.calls).toEqual([
			["/api/proxy/svc/api/items/42?x=1", { headers: {} }],
		]);
	});

	it("never fetch lanyard's proof route for lanyard's own pages", async () => {
		const fetchSpy = stubFetches();
		const { Route } = await import(
			"../../src/routes/_authenticated/$service/$"
		);
		const service = entry(
			[
				page("/", [
					{
						type: "detail",
						endpoint: "/api/user/../services/guidebook/permissions",
						config: {},
					},
					{ type: "detail", endpoint: "/api/user/profile", config: {} },
				]),
				page("/items/:id", [
					{
						type: "detail",
						endpoint: "/api/services/:id/permissions",
						config: {},
					},
					{ type: "detail", endpoint: "/api/user/departments", config: {} },
				]),
			],
			{
				slug: "my-account",
				baseUrl: "http://localhost:3000",
				lanyardOwned: true,
			},
		);

		const index = await loadIndex(service);
		const sub = await Route.options.loader({
			params: { service: "my-account", _splat: "items/guidebook" },
			context: { session: clientSession, services: [service] },
		} as never);

		expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
			"http://lanyard.test/api/user/profile",
			"http://lanyard.test/api/user/departments",
		]);
		expect(index?.sectionData).toEqual([null, { ok: true }]);
		expect(sub?.sectionData).toEqual([null, { ok: true }]);
	});

	it("never fetch a service whose base url isn't http or https", async () => {
		const fetchSpy = stubFetches();

		const data = await loadIndex(
			entry(
				[page("/", [{ type: "detail", endpoint: "/passwd", config: {} }])],
				{ baseUrl: "file:///etc" },
			),
		);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(data?.sectionData).toEqual([null]);
	});

	it("send a service nothing when lanyard gives no proof", async () => {
		const fetchSpy = stubFetches({ permissions: [], orgRoles: [] });
		const { Route } = await import(
			"../../src/routes/_authenticated/$service/$"
		);
		const service = entry([
			page("/", [{ type: "detail", endpoint: "/api/items", config: {} }]),
			page("/items/:id", [
				{ type: "detail", endpoint: "/api/items/:id", config: {} },
			]),
		]);

		const index = await loadIndex(service);
		const sub = await Route.options.loader({
			params: { service: "svc", _splat: "items/42" },
			context: { session: clientSession, services: [service] },
		} as never);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(index?.sectionData).toEqual([null]);
		expect(sub?.sectionData).toEqual([null]);
	});
});
