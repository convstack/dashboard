import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSession } from "../../src/lib/auth";
import { createLoginCookie } from "../../src/lib/login-state";

const exchangeCodeForTokens = vi.fn();
const fetchUserInfo = vi.fn();

vi.mock("../../src/lib/auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/auth")>()),
	exchangeCodeForTokens: (...args: unknown[]) => exchangeCodeForTokens(...args),
	fetchUserInfo: (...args: unknown[]) => fetchUserInfo(...args),
}));

const user = { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" };

async function callback(
	query: string,
	login: { state: string; codeVerifier: string } | null = {
		state: "state-1",
		codeVerifier: "verifier-1",
	},
) {
	const headers: Record<string, string> = {};
	if (login) headers.cookie = (await createLoginCookie(login)).split(";")[0];
	const { Route } = await import("../../src/routes/callback");
	return Route.options.server.handlers.GET({
		request: new Request(`http://dashboard.test/callback${query}`, { headers }),
	});
}

function location(res: Response) {
	return res.headers.get("Location");
}

function setCookie(res: Response, name: string) {
	return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
}

afterEach(() => {
	exchangeCodeForTokens.mockReset();
	fetchUserInfo.mockReset();
});

describe("GET /callback", () => {
	it("signs in with the verifier from the login cookie and lands on /home", async () => {
		exchangeCodeForTokens.mockResolvedValue({
			access_token: "access",
			refresh_token: "refresh",
			id_token: "id-token",
			expires_in: 300,
			token_type: "Bearer",
		});
		fetchUserInfo.mockResolvedValue(user);

		const res = await callback("?code=code-1&state=state-1");

		expect(res.status).toBe(303);
		expect(location(res)).toBe("/home");
		expect(exchangeCodeForTokens).toHaveBeenCalledWith("code-1", "verifier-1");
		expect(setCookie(res, "dashboard_session")).toContain("HttpOnly");
		expect(setCookie(res, "dashboard_id_token")).toBeTruthy();
		expect(setCookie(res, "dashboard_login")).toContain("Max-Age=0");
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("goes home when another tab finished the shared sign-in first", async () => {
		const now = Math.floor(Date.now() / 1000);
		const part = (value: object) =>
			Buffer.from(JSON.stringify(value)).toString("base64url");
		const session = await encryptSession({
			accessToken: `${part({ alg: "RS256" })}.${part({ sub: user.id, iat: now - 10 })}.signature`,
			refreshToken: "refresh",
			expiresAt: now + 200,
			user,
		});
		const { Route } = await import("../../src/routes/callback");

		const res = await Route.options.server.handlers.GET({
			request: new Request(
				"http://dashboard.test/callback?code=c&state=state-1",
				{
					headers: { cookie: `dashboard_session=${session}` },
				},
			),
		});

		expect(res.status).toBe(303);
		expect(location(res)).toBe("/home");
		expect(exchangeCodeForTokens).not.toHaveBeenCalled();
		expect(setCookie(res, "dashboard_session")).toBeUndefined();
	});

	it.each([
		["a state that doesn't match the cookie", "?code=c&state=other", "state"],
		["no state", "?code=c", "state"],
		["no code", "?state=state-1", "state"],
		["an error from the IdP", "?error=access_denied&state=state-1", "denied"],
	])("refuses %s and starts nothing", async (_label, query, reason) => {
		const res = await callback(query);

		expect(res.status).toBe(303);
		expect(location(res)).toBe(`/login?error=${reason}`);
		expect(exchangeCodeForTokens).not.toHaveBeenCalled();
		expect(setCookie(res, "dashboard_login")).toContain("Max-Age=0");
		expect(setCookie(res, "dashboard_session")).toBeUndefined();
	});

	it("refuses a callback with no login cookie, which is what a forged login looks like", async () => {
		const res = await callback("?code=c&state=state-1", null);

		expect(location(res)).toBe("/login?error=state");
		expect(exchangeCodeForTokens).not.toHaveBeenCalled();
	});

	it("never echoes attacker-supplied text into the redirect", async () => {
		const res = await callback(
			"?error=%3Cscript%3E&error_description=%22%3E%3Csvg&state=state-1",
		);

		expect(location(res)).toBe("/login?error=denied");
	});

	it("sends a failed code exchange back to the login page without a session", async () => {
		exchangeCodeForTokens.mockResolvedValue(null);

		const res = await callback("?code=c&state=state-1");

		expect(location(res)).toBe("/login?error=exchange");
		expect(setCookie(res, "dashboard_session")).toBeUndefined();
	});

	it("sends a thrown code exchange back to the login page and clears the login cookie", async () => {
		exchangeCodeForTokens.mockRejectedValue(new Error("connect ECONNREFUSED"));

		const res = await callback("?code=c&state=state-1");

		expect(res.status).toBe(303);
		expect(location(res)).toBe("/login?error=exchange");
		expect(setCookie(res, "dashboard_session")).toBeUndefined();
		expect(setCookie(res, "dashboard_login")).toContain("Max-Age=0");
	});

	it("sends a thrown userinfo lookup back to the login page without a session", async () => {
		exchangeCodeForTokens.mockResolvedValue({
			access_token: "a",
			refresh_token: "r",
			expires_in: 300,
			token_type: "Bearer",
		});
		fetchUserInfo.mockRejectedValue(new SyntaxError("Unexpected token <"));

		const res = await callback("?code=c&state=state-1");

		expect(location(res)).toBe("/login?error=exchange");
		expect(setCookie(res, "dashboard_session")).toBeUndefined();
	});

	it("sends a failed userinfo lookup back to the login page without a session", async () => {
		exchangeCodeForTokens.mockResolvedValue({
			access_token: "a",
			refresh_token: "r",
			expires_in: 300,
			token_type: "Bearer",
		});
		fetchUserInfo.mockResolvedValue(null);

		const res = await callback("?code=c&state=state-1");

		expect(location(res)).toBe("/login?error=exchange");
		expect(setCookie(res, "dashboard_session")).toBeUndefined();
	});
});
