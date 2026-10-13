import { afterEach, describe, expect, it, vi } from "vitest";

const discoverOidc = vi.fn();

vi.mock("../../src/lib/oidc-discovery", () => ({
	discoverOidc: (...args: unknown[]) => discoverOidc(...args),
	publicHostHeaders: () => ({}),
}));

function endpoints() {
	return {
		authorizationEndpoint: "http://idp.test/authorize/",
		tokenEndpoint: "http://idp.test/token/",
		userinfoEndpoint: "http://idp.test/userinfo/",
		endSessionEndpoint: "http://idp.test/end-session/",
	};
}

type LoginRoute = typeof import("../../src/routes/api/auth/login").Route;

function start(route: LoginRoute, cookie?: string): Promise<Response> {
	return route.options.server.handlers.GET({
		request: new Request("http://dashboard.test/api/auth/login", {
			headers: cookie ? { cookie } : {},
		}),
	});
}

afterEach(() => {
	discoverOidc.mockReset();
});

describe("GET /api/auth/login", () => {
	it("sets the login cookie and sends the browser to the IdP with the same state", async () => {
		discoverOidc.mockResolvedValue(endpoints());
		const { Route } = await import("../../src/routes/api/auth/login");

		const res = await start(Route);

		expect(res.status).toBe(302);
		const target = new URL(res.headers.get("Location") as string);
		expect(target.origin + target.pathname).toBe("http://idp.test/authorize/");
		expect(target.searchParams.get("code_challenge_method")).toBe("S256");
		const state = target.searchParams.get("state") as string;
		expect(state).toBeTruthy();
		const cookie = res.headers
			.getSetCookie()
			.find((c) => c.startsWith("dashboard_login=")) as string;
		expect(cookie).toContain("HttpOnly");
		expect(cookie).not.toContain(state);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("uses a fresh state every time", async () => {
		discoverOidc.mockResolvedValue(endpoints());
		const { Route } = await import("../../src/routes/api/auth/login");

		const a = await start(Route);
		const b = await start(Route);

		const state = (r: Response) =>
			new URL(r.headers.get("Location") as string).searchParams.get("state");
		expect(state(a)).not.toBe(state(b));
	});

	it("joins a sign-in another tab already started, so the tabs don't cancel each other", async () => {
		discoverOidc.mockResolvedValue(endpoints());
		const { Route } = await import("../../src/routes/api/auth/login");
		const first = await start(Route);
		const cookie = (
			first.headers
				.getSetCookie()
				.find((c) => c.startsWith("dashboard_login=")) as string
		).split(";")[0];

		const second = await start(Route, cookie);

		const sent = (r: Response) =>
			new URL(r.headers.get("Location") as string).searchParams;
		expect(sent(second).get("state")).toBe(sent(first).get("state"));
		expect(sent(second).get("code_challenge")).toBe(
			sent(first).get("code_challenge"),
		);
		expect(second.headers.getSetCookie()).toEqual([]);
	});

	it("starts a new attempt instead of joining one that is nearly out of time", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
		discoverOidc.mockResolvedValue(endpoints());
		const { Route } = await import("../../src/routes/api/auth/login");
		const first = await start(Route);
		const cookie = (
			first.headers
				.getSetCookie()
				.find((c) => c.startsWith("dashboard_login=")) as string
		).split(";")[0];

		vi.setSystemTime(new Date("2026-10-12T10:01:30Z"));
		const second = await start(Route, cookie);

		const state = (r: Response) =>
			new URL(r.headers.get("Location") as string).searchParams.get("state");
		expect(state(second)).not.toBe(state(first));
		expect(
			second.headers
				.getSetCookie()
				.some((c) => c.startsWith("dashboard_login=")),
		).toBe(true);
		vi.useRealTimers();
	});

	it("sends the user back to the login page when the IdP can't be reached", async () => {
		discoverOidc.mockRejectedValue(new Error("down"));
		const { Route } = await import("../../src/routes/api/auth/login");

		const res = await start(Route);

		expect(res.headers.get("Location")).toBe("/login?error=unreachable");
		expect(res.headers.getSetCookie()).toEqual([]);
	});
});
