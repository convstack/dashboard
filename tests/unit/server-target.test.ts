import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSession, type SessionData } from "../../src/lib/auth";
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
let currentRequest: Request;

vi.mock("../../src/lib/lanyard-client", () => ({
	LANYARD_URL: "http://lanyard.test",
	lanyardFetch: (...args: unknown[]) => lanyardFetch(...args),
}));
vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => currentRequest,
}));

const service = {
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
	uiManifest: null,
};

async function requestWith(session: Partial<SessionData> | null) {
	const headers: Record<string, string> = {};
	if (session) {
		const full: SessionData = {
			accessToken,
			refreshToken: "refresh",
			expiresAt: Math.floor(Date.now() / 1000) + 200,
			user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
			...session,
		};
		headers.cookie = `dashboard_session=${await encryptSession(full)}`;
	}
	return new Request("http://dashboard.test/svc", { headers });
}

afterEach(() => {
	__resetCatalogCache();
	lanyardFetch.mockReset();
});

function answerWith(proof: object | null) {
	lanyardFetch.mockImplementation(async (path: string) =>
		path === "/api/services/catalog"
			? new Response(JSON.stringify([service]))
			: new Response(JSON.stringify(proof ?? {})),
	);
}

describe("serverServiceTarget", () => {
	it("gets the token from the request's cookie and returns lanyard's proof", async () => {
		answerWith({ proof: "proof-token" });
		currentRequest = await requestWith({});
		const { serverServiceTarget } = await import("../../src/lib/server-target");

		const target = await serverServiceTarget({ slug: "svc" });

		expect(target).toEqual({
			baseUrl: "http://svc.test",
			authorization: "Bearer proof-token",
		});
		expect(lanyardFetch).toHaveBeenCalledWith("/api/services/svc/permissions", {
			accessToken,
		});
	});

	it.each([
		["no cookie", null],
		["an expired session", { expiresAt: Math.floor(Date.now() / 1000) - 10 }],
	])("returns no authorization for %s, without asking lanyard", async (_label, session) => {
		currentRequest = await requestWith(session);
		const { serverServiceTarget } = await import("../../src/lib/server-target");

		const target = await serverServiceTarget(service as never);

		expect(target).toEqual({ baseUrl: "", authorization: null });
		expect(lanyardFetch).not.toHaveBeenCalled();
	});

	it("returns no authorization for a garbled cookie", async () => {
		currentRequest = new Request("http://dashboard.test/svc", {
			headers: { cookie: "dashboard_session=not-a-real-cookie" },
		});
		const { serverServiceTarget } = await import("../../src/lib/server-target");

		const target = await serverServiceTarget(service as never);

		expect(target.authorization).toBeNull();
		expect(lanyardFetch).not.toHaveBeenCalled();
	});

	it("needs no base url from the caller: the browser's catalog has none", async () => {
		answerWith({ proof: "proof-token" });
		currentRequest = await requestWith({});
		const { serverServiceTarget } = await import("../../src/lib/server-target");

		const target = await serverServiceTarget({ slug: "svc" });

		expect(target.baseUrl).toBe("http://svc.test");
	});

	it("refuses a service the user's catalog doesn't list", async () => {
		answerWith({ proof: "proof-token" });
		currentRequest = await requestWith({});
		const { serverServiceTarget } = await import("../../src/lib/server-target");

		const target = await serverServiceTarget({ slug: "not-listed" });

		expect(target).toEqual({
			baseUrl: "",
			authorization: null,
			failure: "forbidden",
		});
	});
});
