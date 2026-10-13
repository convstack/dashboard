import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSession, type SessionData } from "../../src/lib/auth";

const lanyardFetch = vi.fn();

vi.mock("../../src/lib/lanyard-client", () => ({
	LANYARD_URL: "http://lanyard.test",
	lanyardFetch: (...args: unknown[]) => lanyardFetch(...args),
}));

function jwt(payload: Record<string, unknown>): string {
	const encode = (value: object) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

afterEach(() => {
	lanyardFetch.mockReset();
	vi.restoreAllMocks();
});

describe("GET /api/permissions/$slug", () => {
	it("returns no permissions for an expired session without asking lanyard", async () => {
		const now = Math.floor(Date.now() / 1000);
		const session: SessionData = {
			accessToken: jwt({ sub: "sub-1", iat: now - 400 }),
			refreshToken: "refresh",
			expiresAt: now - 100,
			user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
		};
		const { Route } = await import("../../src/routes/api/permissions/$slug");

		const res = await Route.options.server.handlers.GET({
			request: new Request("http://dashboard.test/api/permissions/svc", {
				headers: {
					cookie: `dashboard_session=${await encryptSession(session)}`,
				},
			}),
			params: { slug: "svc" },
		});

		expect((await res.json()).permissions).toEqual([]);
		expect(lanyardFetch).not.toHaveBeenCalled();
	});

	it("logs a refused lanyard call and still returns no permissions", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValue(new Response("nope", { status: 503 }));
		const now = Math.floor(Date.now() / 1000);
		const session: SessionData = {
			accessToken: jwt({ sub: "sub-1", iat: now - 10 }),
			refreshToken: "refresh",
			expiresAt: now + 200,
			user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
		};
		const { Route } = await import("../../src/routes/api/permissions/$slug");

		const res = await Route.options.server.handlers.GET({
			request: new Request("http://dashboard.test/api/permissions/svc", {
				headers: {
					cookie: `dashboard_session=${await encryptSession(session)}`,
				},
			}),
			params: { slug: "svc" },
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ permissions: [], orgRoles: [] });
		expect(warn).toHaveBeenCalledWith(
			"lanyard /api/services/svc/permissions answered 503",
		);
	});

	it("encodes the slug before it reaches lanyard or the log", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		lanyardFetch.mockResolvedValue(new Response("nope", { status: 404 }));
		const now = Math.floor(Date.now() / 1000);
		const session: SessionData = {
			accessToken: jwt({ sub: "sub-1", iat: now - 10 }),
			refreshToken: "refresh",
			expiresAt: now + 200,
			user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
		};
		const { Route } = await import("../../src/routes/api/permissions/$slug");

		await Route.options.server.handlers.GET({
			request: new Request("http://dashboard.test/api/permissions/x%0Aforged", {
				headers: {
					cookie: `dashboard_session=${await encryptSession(session)}`,
				},
			}),
			params: { slug: "x\nforged" },
		});

		expect(lanyardFetch.mock.calls[0][0]).toBe(
			"/api/services/x%0Aforged/permissions",
		);
		expect(warn.mock.calls).toEqual([
			["lanyard /api/services/x%0Aforged/permissions answered 404"],
		]);
	});

	it("hands the browser only permissions and org roles", async () => {
		lanyardFetch.mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						userId: "sub-1",
						permissions: ["p1"],
						orgRoles: [],
						proof: "proof-token",
					}),
				),
		);
		const now = Math.floor(Date.now() / 1000);
		const session: SessionData = {
			accessToken: jwt({ sub: "sub-1", iat: now - 10 }),
			refreshToken: "refresh",
			expiresAt: now + 200,
			user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
		};
		const { Route } = await import("../../src/routes/api/permissions/$slug");

		const res = await Route.options.server.handlers.GET({
			request: new Request("http://dashboard.test/api/permissions/svc", {
				headers: {
					cookie: `dashboard_session=${await encryptSession(session)}`,
				},
			}),
			params: { slug: "svc" },
		});

		expect(await res.json()).toEqual({ permissions: ["p1"], orgRoles: [] });
	});
});
