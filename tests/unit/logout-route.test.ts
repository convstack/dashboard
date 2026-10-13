import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptJson } from "../../src/lib/auth";

const discoverOidc = vi.fn();

vi.mock("../../src/lib/oidc-discovery", () => ({
	discoverOidc: (...args: unknown[]) => discoverOidc(...args),
	publicHostHeaders: () => ({}),
}));

async function logout(
	headers: Record<string, string>,
	withIdToken = true,
): Promise<Response> {
	const cookie = withIdToken
		? { cookie: `dashboard_id_token=${await encryptJson("the.id.token")}` }
		: {};
	const { Route } = await import("../../src/routes/api/auth/logout");
	return Route.options.server.handlers.POST({
		request: new Request("http://dashboard.test/api/auth/logout", {
			method: "POST",
			headers: { ...cookie, ...headers },
		}),
	});
}

afterEach(() => {
	discoverOidc.mockReset();
});

describe("POST /api/auth/logout", () => {
	it("refuses a foreign origin and leaves the session alone", async () => {
		const res = await logout({ origin: "https://evil.test" });

		expect(res.status).toBe(403);
		expect(res.headers.getSetCookie()).toEqual([]);
		expect(discoverOidc).not.toHaveBeenCalled();
	});

	it("refuses a request with no origin information", async () => {
		const res = await logout({});

		expect(res.status).toBe(403);
	});

	it("clears both cookies and redirects to the IdP with the hint, never in a body", async () => {
		discoverOidc.mockResolvedValue({
			endSessionEndpoint: "http://idp.test/end-session/",
		});

		const res = await logout({ origin: "http://dashboard.test" });

		expect(res.status).toBe(303);
		const target = new URL(res.headers.get("Location") as string);
		expect(target.origin + target.pathname).toBe(
			"http://idp.test/end-session/",
		);
		expect(target.searchParams.get("id_token_hint")).toBe("the.id.token");
		expect(target.searchParams.get("post_logout_redirect_uri")).toBe(
			"http://dashboard.test/login",
		);
		expect(target.searchParams.get("client_id")).toBeTruthy();
		const cookies = res.headers.getSetCookie();
		expect(cookies.some((c) => c.startsWith("dashboard_session=;"))).toBe(true);
		expect(cookies.some((c) => c.startsWith("dashboard_id_token=;"))).toBe(
			true,
		);
		expect(await res.text()).not.toContain("the.id.token");
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("reaches Authentik's sign-out through its cancel address, which clears a flow left open", async () => {
		for (const prefix of ["", "/auth"]) {
			discoverOidc.mockResolvedValue({
				endSessionEndpoint: `http://idp.test${prefix}/application/o/convstack/end-session/`,
			});

			const res = await logout({ origin: "http://dashboard.test" });

			const target = new URL(res.headers.get("Location") as string);
			expect(target.origin + target.pathname).toBe(
				`http://idp.test${prefix}/flows/-/cancel/`,
			);
			const next = target.searchParams.get("next") as string;
			expect(next.startsWith("/")).toBe(true);
			const forwarded = new URL(next, "http://idp.test");
			expect(forwarded.pathname).toBe(
				`${prefix}/application/o/convstack/end-session/`,
			);
			expect(forwarded.searchParams.get("id_token_hint")).toBe("the.id.token");
			expect(forwarded.searchParams.get("post_logout_redirect_uri")).toBe(
				"http://dashboard.test/login",
			);
			expect(forwarded.searchParams.get("client_id")).toBeTruthy();
		}
	});

	it("omits the return target when there is no ID token, since the IdP would refuse it", async () => {
		discoverOidc.mockResolvedValue({
			endSessionEndpoint: "http://idp.test/end-session/",
		});

		const res = await logout({ origin: "http://dashboard.test" }, false);

		const target = new URL(res.headers.get("Location") as string);
		expect(target.searchParams.has("id_token_hint")).toBe(false);
		expect(target.searchParams.has("post_logout_redirect_uri")).toBe(false);
		expect(target.searchParams.get("client_id")).toBeTruthy();
	});

	it("still signs out locally when the IdP can't be reached", async () => {
		discoverOidc.mockRejectedValue(new Error("down"));

		const res = await logout({ origin: "http://dashboard.test" });

		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/login");
		expect(
			res.headers
				.getSetCookie()
				.some((c) => c.startsWith("dashboard_session=;")),
		).toBe(true);
	});

	it("signs out locally when the IdP advertises no end-session endpoint", async () => {
		discoverOidc.mockResolvedValue({});

		const res = await logout({ origin: "http://dashboard.test" });

		expect(res.headers.get("Location")).toBe("/login");
	});
});
