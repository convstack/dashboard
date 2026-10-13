import { decodeJwt } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSession, type SessionData } from "./auth";
import {
	__resetCatalogCache,
	getCachedCatalog,
	getShellCatalog,
	proxyRequest,
	serviceTarget,
} from "./service-proxy";

const lanyardFetch = vi.fn();
const forgetBranding = vi.fn();

vi.mock("./branding", () => ({
	forgetBranding: () => forgetBranding(),
}));

vi.mock("./lanyard-client", () => ({
	LANYARD_URL: "http://lanyard.test",
	lanyardFetch: (...args: unknown[]) => lanyardFetch(...args),
}));

function jwt(payload: Record<string, unknown>): string {
	const encode = (value: object) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

async function requestFor(sub: string, slug: string): Promise<Request> {
	const now = Math.floor(Date.now() / 1000);
	const session: SessionData = {
		accessToken: jwt({ sub, iat: now - 10 }),
		refreshToken: "refresh",
		expiresAt: now + 200,
		user: { id: sub, name: sub, email: `${sub}@x.dev`, role: "user" },
	};
	return new Request(`http://dashboard.test/api/proxy/${slug}/x`, {
		headers: { cookie: `dashboard_session=${await encryptSession(session)}` },
	});
}

function catalogFetches(): number {
	return lanyardFetch.mock.calls.filter(
		([path]) => path === "/api/services/catalog",
	).length;
}

afterEach(() => {
	lanyardFetch.mockReset();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	__resetCatalogCache();
});

describe("proxyRequest", () => {
	it("refuses an expired session before calling anything", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const now = Math.floor(Date.now() / 1000);
		const session: SessionData = {
			accessToken: jwt({ sub: "sub-1", iat: now - 400 }),
			refreshToken: "refresh",
			expiresAt: now - 100,
			user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
		};
		const request = new Request("http://dashboard.test/api/proxy/svc/x", {
			headers: { cookie: `dashboard_session=${await encryptSession(session)}` },
		});

		const res = await proxyRequest(request, "svc", "x");

		expect(res.status).toBe(401);
		expect(lanyardFetch).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("keeps each user's service list separate", async () => {
		const forwarded = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(
			async (path: string, { accessToken }: { accessToken: string }) => {
				if (path === "/api/services/catalog") {
					const services =
						decodeJwt(accessToken).sub === "sub-admin"
							? [{ slug: "admin-only", baseUrl: "http://svc.test" }]
							: [];
					return new Response(JSON.stringify(services));
				}
				return new Response(
					JSON.stringify({
						permissions: [],
						orgRoles: [],
						proof: "proof-token",
					}),
				);
			},
		);
		const now = Math.floor(Date.now() / 1000);
		const requestFor = async (sub: string) => {
			const session: SessionData = {
				accessToken: jwt({ sub, iat: now - 10 }),
				refreshToken: "refresh",
				expiresAt: now + 200,
				user: { id: sub, name: sub, email: `${sub}@x.dev`, role: "user" },
			};
			return new Request("http://dashboard.test/api/proxy/admin-only/x", {
				headers: {
					cookie: `dashboard_session=${await encryptSession(session)}`,
				},
			});
		};

		const admin = await proxyRequest(
			await requestFor("sub-admin"),
			"admin-only",
			"x",
		);
		const other = await proxyRequest(
			await requestFor("sub-other"),
			"admin-only",
			"x",
		);

		expect(admin.status).toBe(200);
		expect(other.status).toBe(404);
		expect(forwarded).toHaveBeenCalledTimes(1);
	});

	it("logs when lanyard fails the catalog or the permissions, and answers 503", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const forwarded = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(async (path: string) =>
			path === "/api/services/catalog"
				? new Response(
						JSON.stringify([{ slug: "svc", baseUrl: "http://svc.test" }]),
					)
				: new Response("nope", { status: 503 }),
		);
		const now = Math.floor(Date.now() / 1000);
		const session: SessionData = {
			accessToken: jwt({ sub: "sub-log", iat: now - 10 }),
			refreshToken: "refresh",
			expiresAt: now + 200,
			user: { id: "sub-log", name: "Ada", email: "ada@x.dev", role: "user" },
		};
		const request = new Request("http://dashboard.test/api/proxy/svc/x", {
			headers: { cookie: `dashboard_session=${await encryptSession(session)}` },
		});

		const res = await proxyRequest(request, "svc", "x");

		expect(res.status).toBe(503);
		expect(forwarded).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(
			"lanyard /api/services/svc/permissions answered 503",
		);
	});

	it("refetches a cached list that lacks the slug", async () => {
		const forwarded = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", forwarded);
		let services = [{ slug: "svc", baseUrl: "http://svc.test" }];
		lanyardFetch.mockImplementation(async (path: string) =>
			path === "/api/services/catalog"
				? new Response(JSON.stringify(services))
				: new Response(
						JSON.stringify({
							permissions: [],
							orgRoles: [],
							proof: "proof-token",
						}),
					),
		);
		await proxyRequest(await requestFor("sub-late", "svc"), "svc", "x");
		services = [...services, { slug: "late", baseUrl: "http://late.test" }];

		const res = await proxyRequest(
			await requestFor("sub-late", "late"),
			"late",
			"x",
		);

		expect(res.status).toBe(200);
		expect(forwarded).toHaveBeenLastCalledWith(
			"http://late.test/x",
			expect.anything(),
		);
		expect(catalogFetches()).toBe(2);
	});

	it("refetches a cached list once before a 404", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("{}")),
		);
		lanyardFetch.mockImplementation(async (path: string) =>
			path === "/api/services/catalog"
				? new Response(
						JSON.stringify([{ slug: "svc", baseUrl: "http://svc.test" }]),
					)
				: new Response(JSON.stringify({ permissions: [], orgRoles: [] })),
		);
		await proxyRequest(await requestFor("sub-miss", "svc"), "svc", "x");

		const res = await proxyRequest(
			await requestFor("sub-miss", "unknown"),
			"unknown",
			"x",
		);

		expect(res.status).toBe(404);
		expect(catalogFetches()).toBe(2);
	});

	it("fetches a cold catalog once before a 404", async () => {
		lanyardFetch.mockImplementation(
			async () => new Response(JSON.stringify([])),
		);

		const res = await proxyRequest(
			await requestFor("sub-cold", "unknown"),
			"unknown",
			"x",
		);

		expect(res.status).toBe(404);
		expect(catalogFetches()).toBe(1);
	});

	it("sends a service lanyard's proof and nothing else", async () => {
		const forwarded = vi.fn(
			async (_url: string, _init: RequestInit) => new Response("{}"),
		);
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(async (path: string) =>
			path === "/api/services/catalog"
				? new Response(
						JSON.stringify([{ slug: "svc", baseUrl: "http://svc.test" }]),
					)
				: new Response(
						JSON.stringify({
							permissions: ["p1"],
							orgRoles: [],
							proof: "proof-token",
						}),
					),
		);

		await proxyRequest(await requestFor("sub-proof", "svc"), "svc", "x");

		const [url, init] = forwarded.mock.calls[0];
		const headers = init.headers as Headers;
		expect(url).toBe("http://svc.test/x");
		expect(headers.get("authorization")).toBe("Bearer proof-token");
		expect([...headers.keys()]).toEqual(["authorization"]);
	});

	it("sends lanyard's own pages the user's token at LANYARD_URL", async () => {
		const forwarded = vi.fn(
			async (_url: string, _init: RequestInit) => new Response("{}"),
		);
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(
			async () =>
				new Response(
					JSON.stringify([
						{
							slug: "my-account",
							baseUrl: "http://127.0.0.1:3000",
							lanyardOwned: true,
						},
					]),
				),
		);

		await proxyRequest(
			await requestFor("sub-own", "my-account"),
			"my-account",
			"api/user/profile",
		);

		const [url, init] = forwarded.mock.calls[0];
		const token = (init.headers as Headers).get("authorization")?.slice(7);
		expect(url).toBe("http://lanyard.test/api/user/profile");
		expect(decodeJwt(token ?? "").sub).toBe("sub-own");
		expect(lanyardFetch).toHaveBeenCalledTimes(1);
	});

	it("refuses a service call that lanyard gave no proof for", async () => {
		const forwarded = vi.fn(
			async (_url: string, _init: RequestInit) => new Response("{}"),
		);
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(async (path: string) =>
			path === "/api/services/catalog"
				? new Response(
						JSON.stringify([{ slug: "svc", baseUrl: "http://svc.test" }]),
					)
				: new Response(JSON.stringify({ permissions: [], orgRoles: [] })),
		);

		const res = await proxyRequest(
			await requestFor("sub-none", "svc"),
			"svc",
			"x",
		);

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "Forbidden" });
		expect(forwarded).not.toHaveBeenCalled();
	});

	// lanyard signs user proofs at /api/services/<slug>/permissions, and its
	// router ignores case, decodes escapes and trims slashes
	it.each([
		"api/services/guidebook/permissions",
		"api/user/../services/guidebook/permissions",
		"api/user/%2e%2e/services/guidebook/permissions",
		"API/SERVICES/guidebook/PERMISSIONS",
		"/api/services/guidebook/permissions",
		"api/services/guidebook/permissions/",
		"api/services/guidebook/permission%73",
	])("refuses %j on lanyard's own pages without forwarding it", async (path) => {
		const forwarded = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(
			async () =>
				new Response(
					JSON.stringify([
						{
							slug: "my-account",
							baseUrl: "http://127.0.0.1:3000",
							lanyardOwned: true,
						},
					]),
				),
		);

		const res = await proxyRequest(
			await requestFor("sub-guard", "my-account"),
			"my-account",
			path,
		);

		expect(res.status).toBe(403);
		expect(forwarded).not.toHaveBeenCalled();
	});

	it("still forwards lanyard's other pages", async () => {
		const forwarded = vi.fn(async (_url: string) => new Response("{}"));
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(
			async () =>
				new Response(
					JSON.stringify([
						{
							slug: "my-account",
							baseUrl: "http://127.0.0.1:3000",
							lanyardOwned: true,
						},
					]),
				),
		);

		const res = await proxyRequest(
			await requestFor("sub-guard-ok", "my-account"),
			"my-account",
			"api/user/departments",
		);

		expect(res.status).toBe(200);
		expect(forwarded.mock.calls.map(([url]) => url)).toEqual([
			"http://lanyard.test/api/user/departments",
		]);
	});

	it("refuses a service whose base URL isn't http or https", async () => {
		const forwarded = vi.fn(async () => new Response("{}"));
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(async (path: string) =>
			path === "/api/services/catalog"
				? new Response(
						JSON.stringify([{ slug: "svc", baseUrl: "file:///etc" }]),
					)
				: new Response(
						JSON.stringify({
							permissions: [],
							orgRoles: [],
							proof: "proof-token",
						}),
					),
		);

		const res = await proxyRequest(
			await requestFor("sub-file", "svc"),
			"svc",
			"passwd",
		);

		expect(res.status).toBe(403);
		expect(forwarded).not.toHaveBeenCalled();
	});

	// whatever path arrives, the forwarded call stays on the target's host
	it.each([
		"//evil.test/x",
		"https://evil.test/x",
		"/\\evil.test/x",
		"/\t/evil.test/x",
		"\\\\evil.test/x",
		"@evil.test/x",
	])("keeps the forwarded path %j on the target's host", async (path) => {
		const forwarded = vi.fn(
			async (_url: string, _init: RequestInit) => new Response("{}"),
		);
		vi.stubGlobal("fetch", forwarded);
		lanyardFetch.mockImplementation(async (lanyardPath: string) =>
			lanyardPath === "/api/services/catalog"
				? new Response(
						JSON.stringify([
							{ slug: "svc", baseUrl: "http://svc.test" },
							{
								slug: "my-account",
								baseUrl: "http://127.0.0.1:3000",
								lanyardOwned: true,
							},
						]),
					)
				: new Response(
						JSON.stringify({
							permissions: [],
							orgRoles: [],
							proof: "proof-token",
						}),
					),
		);

		await proxyRequest(await requestFor("sub-host", "svc"), "svc", path);
		await proxyRequest(
			await requestFor("sub-host", "my-account"),
			"my-account",
			path,
		);

		expect(forwarded.mock.calls.map(([url]) => new URL(url).origin)).toEqual([
			"http://svc.test",
			"http://lanyard.test",
		]);
	});
});

const plainService = {
	id: "id",
	name: "Svc",
	slug: "svc",
	type: "service",
	baseUrl: "http://svc.test",
	status: "active",
} as never;

const svcEntry = { slug: "svc", baseUrl: "http://svc.test" };
const accountEntry = {
	slug: "my-account",
	baseUrl: "http://localhost:3000",
	lanyardOwned: true,
};

function lanyardAnswers(permissions: () => Response) {
	lanyardFetch.mockImplementation(async (path: string) => {
		if (path === "/api/services/catalog") {
			return new Response(JSON.stringify([svcEntry, accountEntry]));
		}
		if (path.endsWith("/permissions")) return permissions();
		throw new Error(`unexpected lanyard call ${path}`);
	});
}

describe("serviceTarget failures", () => {
	it.each([
		["a 401", 401, "forbidden"],
		["a 403", 403, "forbidden"],
		["a 404", 404, "forbidden"],
		["a 429", 429, "unavailable"],
		["a 500", 500, "unavailable"],
		["a 503", 503, "unavailable"],
	])("treats lanyard answering %s (status %i) as %s", async (_label, status, failure) => {
		lanyardFetch.mockResolvedValue(new Response("{}", { status }));
		const target = await serviceTarget(plainService, "token");
		expect(target.authorization).toBeNull();
		expect(target.failure).toBe(failure);
	});

	it("maps a network error to unavailable", async () => {
		lanyardFetch.mockRejectedValue(new Error("connect ECONNREFUSED"));
		const target = await serviceTarget(plainService, "token");
		expect(target).toMatchObject({
			authorization: null,
			failure: "unavailable",
		});
	});

	it("treats a 200 without a proof as forbidden", async () => {
		lanyardFetch.mockResolvedValue(
			new Response(JSON.stringify({ permissions: [] })),
		);
		const target = await serviceTarget(plainService, "token");
		expect(target).toMatchObject({ authorization: null, failure: "forbidden" });
	});

	it("carries no failure when it has a proof", async () => {
		lanyardFetch.mockResolvedValue(
			new Response(JSON.stringify({ proof: "p" })),
		);
		const target = await serviceTarget(plainService, "token");
		expect(target).toEqual({
			baseUrl: "http://svc.test",
			authorization: "Bearer p",
		});
	});
});

describe("proxyRequest status codes", () => {
	it("answers 503 when lanyard can't be reached for the catalog", async () => {
		lanyardFetch.mockRejectedValue(new Error("down"));
		const res = await proxyRequest(
			await requestFor("sub-1", "svc"),
			"svc",
			"x",
		);
		expect(res.status).toBe(503);
	});

	it.each([
		["500", 500],
		["503", 503],
		["429", 429],
	])("answers 503, not 404, when lanyard answers %s for a cold catalog", async (_label, status) => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValue(new Response("{}", { status }));
		const res = await proxyRequest(
			await requestFor("sub-1", "svc"),
			"svc",
			"x",
		);
		expect(res.status).toBe(503);
	});

	it("still answers 404 when lanyard refuses the catalog to this session", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValue(new Response("{}", { status: 401 }));
		const res = await proxyRequest(
			await requestFor("sub-1", "svc"),
			"svc",
			"x",
		);
		expect(res.status).toBe(404);
	});

	it("answers 503, not 403, when the proof lookup fails on lanyard's side", async () => {
		const upstream = vi.fn();
		vi.stubGlobal("fetch", upstream);
		lanyardAnswers(() => new Response("{}", { status: 500 }));
		const res = await proxyRequest(
			await requestFor("sub-1", "svc"),
			"svc",
			"x",
		);
		expect(res.status).toBe(503);
		expect(upstream).not.toHaveBeenCalled();
	});

	it("answers 403 when lanyard says the user has no access", async () => {
		const upstream = vi.fn();
		vi.stubGlobal("fetch", upstream);
		lanyardAnswers(() => new Response("{}", { status: 403 }));
		const res = await proxyRequest(
			await requestFor("sub-1", "svc"),
			"svc",
			"x",
		);
		expect(res.status).toBe(403);
		expect(upstream).not.toHaveBeenCalled();
	});

	it("does not follow a redirect from a lanyard-owned target", async () => {
		const upstream = vi.fn(
			async (_url: string, _init?: RequestInit) =>
				new Response(null, {
					status: 302,
					headers: { Location: "/api/services/svc/permissions" },
				}),
		);
		vi.stubGlobal("fetch", upstream);
		lanyardAnswers(() => new Response(JSON.stringify({ proof: "p" })));

		const res = await proxyRequest(
			await requestFor("sub-1", "my-account"),
			"my-account",
			"api/user/profile",
		);

		expect(upstream).toHaveBeenCalledTimes(1);
		expect(upstream.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
		expect(res.status).toBe(502);
		expect(res.headers.get("Location")).toBeNull();
	});

	it("still follows redirects for an ordinary service", async () => {
		const upstream = vi.fn(
			async (_url: string, _init?: RequestInit) => new Response("{}"),
		);
		vi.stubGlobal("fetch", upstream);
		lanyardAnswers(() => new Response(JSON.stringify({ proof: "p" })));

		await proxyRequest(await requestFor("sub-1", "svc"), "svc", "x");

		expect(upstream.mock.calls[0][1]).not.toHaveProperty("redirect", "manual");
	});
});

describe("every proxy answer sandboxes itself", () => {
	const sandboxed = (res: Response) => {
		expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
		expect(res.headers.get("Content-Security-Policy")).toContain(
			"default-src 'none'",
		);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	};

	it("on a service's own HTML", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async (_url: string, _init?: RequestInit) =>
					new Response("<script src=/api/proxy/svc/app.js></script>", {
						headers: { "Content-Type": "text/html" },
					}),
			),
		);
		lanyardAnswers(() => new Response(JSON.stringify({ proof: "p" })));

		const res = await proxyRequest(
			await requestFor("sub-1", "svc"),
			"svc",
			"page",
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/html");
		sandboxed(res);
	});

	it.each([
		["no session", async () => new Request("http://dashboard.test/x"), 401],
		["an unknown service", async () => requestFor("sub-1", "nope"), 404],
	])("on %s", async (_label, build, status) => {
		lanyardAnswers(() => new Response(JSON.stringify({ proof: "p" })));
		const res = await proxyRequest(await build(), "nope", "x");
		expect(res.status).toBe(status);
		sandboxed(res);
	});

	it("when lanyard refuses or is down", async () => {
		lanyardAnswers(() => new Response("{}", { status: 403 }));
		const refused = await proxyRequest(
			await requestFor("sub-1", "svc"),
			"svc",
			"x",
		);
		expect(refused.status).toBe(403);
		sandboxed(refused);

		__resetCatalogCache();
		lanyardFetch.mockRejectedValue(new Error("down"));
		const down = await proxyRequest(
			await requestFor("sub-2", "svc"),
			"svc",
			"x",
		);
		expect(down.status).toBe(503);
		sandboxed(down);
	});
});

describe("getCachedCatalog when lanyard fails", () => {
	const list = [{ slug: "svc", baseUrl: "http://svc.test" }];

	it("keeps serving the last list through a lanyard failure", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValueOnce(Response.json(list));
		await getCachedCatalog("u-stale", "token");

		lanyardFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
		const again = await getCachedCatalog("u-stale", "token", true);

		expect(again.services).toEqual(list);
	});

	it("forgets the last list once lanyard refuses the session", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValueOnce(Response.json(list));
		await getCachedCatalog("u-revoked", "token");

		lanyardFetch.mockResolvedValueOnce(new Response("{}", { status: 401 }));
		expect(
			(await getCachedCatalog("u-revoked", "token", true)).services,
		).toEqual([]);

		lanyardFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
		await expect(
			getCachedCatalog("u-revoked", "token", true),
		).rejects.toThrow();
	});
});

describe("getShellCatalog, asked on every page the server renders", () => {
	const list = [{ slug: "svc", baseUrl: "http://svc.test" }];

	afterEach(() => {
		vi.useRealTimers();
	});

	it("asks lanyard once however many renders come in", async () => {
		lanyardFetch.mockImplementation(async () => Response.json(list));

		for (let render = 0; render < 40; render++) {
			expect(await getShellCatalog("u-busy", "token")).toEqual(list);
		}

		expect(catalogFetches()).toBe(1);
	});

	it("shares one answer between renders that arrive together", async () => {
		lanyardFetch.mockImplementation(async () => Response.json(list));

		const answers = await Promise.all(
			Array.from({ length: 5 }, () => getShellCatalog("u-burst", "token")),
		);

		expect(answers).toEqual(Array(5).fill(list));
		expect(catalogFetches()).toBe(1);
	});

	it("asks again once the answer is fifteen seconds old", async () => {
		vi.useFakeTimers();
		lanyardFetch.mockImplementation(async () => Response.json(list));

		await getShellCatalog("u-later", "token");
		vi.advanceTimersByTime(14_000);
		await getShellCatalog("u-later", "token");
		expect(catalogFetches()).toBe(1);

		vi.advanceTimersByTime(2_000);
		await getShellCatalog("u-later", "token");
		expect(catalogFetches()).toBe(2);
	});

	it("asks again five seconds after a failure, so the nav recovers soon after lanyard does", async () => {
		vi.useFakeTimers();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));

		await expect(getShellCatalog("u-down", "token")).rejects.toThrow();
		vi.advanceTimersByTime(4_000);
		await expect(getShellCatalog("u-down", "token")).rejects.toThrow();
		expect(catalogFetches()).toBe(1);

		lanyardFetch.mockImplementation(async () => Response.json(list));
		vi.advanceTimersByTime(2_000);
		expect(await getShellCatalog("u-down", "token")).toEqual(list);
		expect(catalogFetches()).toBe(2);
	});

	it("keeps each user's list apart", async () => {
		lanyardFetch.mockImplementation(async (_path, options) =>
			Response.json([{ slug: options.accessToken, baseUrl: "http://x.test" }]),
		);

		const one = await getShellCatalog("u-one", "first");
		const two = await getShellCatalog("u-two", "second");

		expect(one[0].slug).toBe("first");
		expect(two[0].slug).toBe("second");
	});

	it("does not keep asking a lanyard that is refusing, which would never let its limit recover", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockImplementation(
			async () => new Response("{}", { status: 429 }),
		);

		for (let render = 0; render < 10; render++) {
			await expect(getShellCatalog("u-limited", "token")).rejects.toThrow();
		}

		expect(catalogFetches()).toBe(1);
	});

	it("shows the last list while lanyard is failing", async () => {
		vi.useFakeTimers();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValueOnce(Response.json(list));
		await getShellCatalog("u-kept", "token");

		vi.advanceTimersByTime(16_000);
		lanyardFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));

		expect(await getShellCatalog("u-kept", "token")).toEqual(list);
	});
});

describe("a change made through one of lanyard's own pages", () => {
	const list = [
		{
			slug: "lanyard-admin",
			baseUrl: "http://127.0.0.1:3000",
			lanyardOwned: true,
		},
		{ slug: "svc", baseUrl: "http://svc.test" },
	];

	async function refetchesAfter(slug: string, method: string, status = 200) {
		vi.stubGlobal("fetch", async () => new Response("{}", { status }));
		lanyardFetch.mockImplementation(async () => Response.json(list));
		const base = await requestFor("u-admin", slug);
		const request =
			method === "GET" ? base : new Request(base, { method, body: "{}" });

		await getShellCatalog("u-admin", "token");
		await getShellCatalog("u-other", "token");
		const before = catalogFetches();
		await proxyRequest(request, slug, "api/admin/services/s1/toggle");
		await getShellCatalog("u-admin", "token");
		await getShellCatalog("u-other", "token");
		return catalogFetches() - before;
	}

	it.each([
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
	])("makes every user's next page ask lanyard again after a %s", async (method) => {
		expect(await refetchesAfter("lanyard-admin", method)).toBe(2);
	});

	it("leaves the lists alone for a read", async () => {
		expect(await refetchesAfter("lanyard-admin", "GET")).toBe(0);
	});

	it("leaves the lists alone when lanyard refused the change", async () => {
		expect(await refetchesAfter("lanyard-admin", "POST", 400)).toBe(0);
	});

	it("leaves the lists alone for an ordinary service", async () => {
		expect(await refetchesAfter("svc", "POST")).toBe(0);
	});
});

describe("the brand after a change made through one of lanyard's own pages", () => {
	const list = [
		{
			slug: "lanyard-admin",
			baseUrl: "http://127.0.0.1:3000",
			lanyardOwned: true,
		},
		{ slug: "svc", baseUrl: "http://svc.test" },
	];

	async function forgets(slug: string, method: string, status = 200) {
		forgetBranding.mockClear();
		vi.stubGlobal("fetch", async () => new Response("{}", { status }));
		lanyardFetch.mockImplementation(async () => Response.json(list));
		const base = await requestFor("u-brand", slug);
		const request =
			method === "GET" ? base : new Request(base, { method, body: "{}" });
		await proxyRequest(request, slug, "api/admin/branding");
		return forgetBranding.mock.calls.length;
	}

	it("is forgotten after a successful change, so the next page shows the new one", async () => {
		expect(await forgets("lanyard-admin", "PUT")).toBe(1);
	});

	it("is kept for a read, a refused change and an ordinary service", async () => {
		expect(await forgets("lanyard-admin", "GET")).toBe(0);
		expect(await forgets("lanyard-admin", "PUT", 400)).toBe(0);
		expect(await forgets("svc", "PUT")).toBe(0);
	});
});
