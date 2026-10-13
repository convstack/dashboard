import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSession, type SessionData } from "../../src/lib/auth";
import {
	__resetRevocations,
	revokeSubject,
} from "../../src/lib/session-revocation";

const refreshAccessToken = vi.fn();
const fetchUserInfo = vi.fn();

vi.mock("../../src/lib/auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/auth")>()),
	refreshAccessToken: (...args: unknown[]) => refreshAccessToken(...args),
	fetchUserInfo: (...args: unknown[]) => fetchUserInfo(...args),
}));

function jwt(payload: Record<string, unknown>): string {
	const encode = (value: object) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

async function refreshRequest(overrides: Partial<SessionData> = {}) {
	const now = Math.floor(Date.now() / 1000);
	const session: SessionData = {
		accessToken: jwt({ sub: "sub-1", iat: now - 280 }),
		refreshToken: "refresh",
		expiresAt: now + 20,
		user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
		...overrides,
	};
	return new Request("http://dashboard.test/api/auth/refresh", {
		method: "POST",
		headers: {
			cookie: `dashboard_session=${await encryptSession(session)}`,
			origin: "http://dashboard.test",
		},
	});
}

function clearsBothCookies(res: Response) {
	const cookies = res.headers.getSetCookie();
	expect(cookies.some((c) => c.startsWith("dashboard_session=;"))).toBe(true);
	expect(cookies.some((c) => c.startsWith("dashboard_id_token=;"))).toBe(true);
}

beforeEach(() => {
	refreshAccessToken.mockReset();
	fetchUserInfo.mockReset();
});

afterEach(() => {
	__resetRevocations();
});

describe("POST /api/auth/refresh", () => {
	it("refuses a foreign origin without touching the session or the IdP", async () => {
		const { Route } = await import("../../src/routes/api/auth/refresh");
		const request = new Request("http://dashboard.test/api/auth/refresh", {
			method: "POST",
			headers: {
				cookie: (await refreshRequest()).headers.get("cookie") as string,
				origin: "https://evil.test",
			},
		});

		const res = await Route.options.server.handlers.POST({ request });

		expect(res.status).toBe(403);
		expect(refreshAccessToken).not.toHaveBeenCalled();
		expect(res.headers.getSetCookie()).toEqual([]);
	});

	it("rejects a revoked session without refreshing and clears its cookies", async () => {
		revokeSubject("sub-1", Math.floor(Date.now() / 1000));
		const { Route } = await import("../../src/routes/api/auth/refresh");

		const res = await Route.options.server.handlers.POST({
			request: await refreshRequest(),
		});

		expect(res.status).toBe(401);
		expect((await res.json()).error).toBe("Session revoked");
		clearsBothCookies(res);
		expect(refreshAccessToken).not.toHaveBeenCalled();
	});

	it("clears the cookies when Authentik refuses the refresh", async () => {
		refreshAccessToken.mockResolvedValue(null);
		const { Route } = await import("../../src/routes/api/auth/refresh");

		const res = await Route.options.server.handlers.POST({
			request: await refreshRequest(),
		});

		expect(res.status).toBe(401);
		clearsBothCookies(res);
	});

	it("refreshes a live session near expiry", async () => {
		const now = Math.floor(Date.now() / 1000);
		refreshAccessToken.mockResolvedValue({
			access_token: jwt({ sub: "sub-1", iat: now }),
			refresh_token: "refresh-2",
			expires_in: 300,
		});
		fetchUserInfo.mockResolvedValue({
			id: "sub-1",
			name: "Ada",
			email: "ada@x.dev",
			role: "user",
		});
		const { Route } = await import("../../src/routes/api/auth/refresh");

		const res = await Route.options.server.handlers.POST({
			request: await refreshRequest(),
		});

		expect(res.status).toBe(200);
		expect((await res.json()).refreshed).toBe(true);
	});

	it("refuses a refresh whose Authentik session has ended", async () => {
		const now = Math.floor(Date.now() / 1000);
		refreshAccessToken.mockResolvedValue({
			access_token: jwt({ sub: "sub-1", iat: now }),
			refresh_token: "refresh-2",
			expires_in: 300,
		});
		const { Route } = await import("../../src/routes/api/auth/refresh");

		const res = await Route.options.server.handlers.POST({
			request: await refreshRequest({
				accessToken: jwt({ sub: "sub-1", iat: now - 280, sid: "sid-1" }),
			}),
		});

		expect(res.status).toBe(401);
		expect((await res.json()).error).toBe("Session ended");
		clearsBothCookies(res);
		expect(fetchUserInfo).not.toHaveBeenCalled();
	});

	it("refreshes while the Authentik session lives", async () => {
		const now = Math.floor(Date.now() / 1000);
		refreshAccessToken.mockResolvedValue({
			access_token: jwt({ sub: "sub-1", iat: now, sid: "sid-1" }),
			refresh_token: "refresh-2",
			expires_in: 300,
		});
		fetchUserInfo.mockResolvedValue({
			id: "sub-1",
			name: "Ada",
			email: "ada@x.dev",
			role: "user",
		});
		const { Route } = await import("../../src/routes/api/auth/refresh");

		const res = await Route.options.server.handlers.POST({
			request: await refreshRequest({
				accessToken: jwt({ sub: "sub-1", iat: now - 280, sid: "sid-1" }),
			}),
		});

		expect(res.status).toBe(200);
		expect((await res.json()).refreshed).toBe(true);
	});
});
