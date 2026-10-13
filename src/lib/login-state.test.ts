import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptJson } from "./auth";
import {
	clearLoginCookie,
	createLoginCookie,
	readLoginState,
} from "./login-state";

const login = { state: "state-1", codeVerifier: "verifier-1" };

function withCookie(value: string) {
	return new Request("http://dashboard.test/callback", {
		headers: { cookie: value },
	});
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

describe("login cookie", () => {
	it("is HttpOnly, SameSite=Lax and lives ten minutes", async () => {
		const cookie = await createLoginCookie(login);
		expect(cookie).toMatch(/^dashboard_login=/);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Max-Age=600");
		expect(cookie).not.toContain("Secure");
		expect(cookie).not.toContain("verifier-1");
		expect(cookie).not.toContain("state-1");
	});

	it("is Secure in production", async () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(await createLoginCookie(login)).toContain("; Secure");
	});

	it("round-trips", async () => {
		const cookie = await createLoginCookie(login);
		const read = await readLoginState(
			withCookie(`a=1; ${cookie.split(";")[0]}; b=2`),
		);
		expect(read).toEqual(login);
	});

	it.each([
		["no cookie header", ""],
		["another cookie only", "dashboard_session=abc"],
		["a garbled value", "dashboard_login=not-base64-at-all"],
		["a truncated value", "dashboard_login=AAAA"],
		["a look-alike name", "xdashboard_login=AAAA"],
	])("reads nothing from %s", async (_label, cookie) => {
		expect(await readLoginState(withCookie(cookie))).toBeNull();
	});

	it("refuses a well-formed cookie with the wrong payload", async () => {
		const wrong = await encryptJson({ state: 1, codeVerifier: null });
		expect(
			await readLoginState(withCookie(`dashboard_login=${wrong}`)),
		).toBeNull();
	});

	it("refuses a cookie older than ten minutes", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-10T10:00:00Z"));
		const cookie = (await createLoginCookie(login)).split(";")[0];
		vi.setSystemTime(new Date("2026-10-10T10:10:01Z"));
		expect(await readLoginState(withCookie(cookie))).toBeNull();
		vi.setSystemTime(new Date("2026-10-10T10:09:59Z"));
		expect(await readLoginState(withCookie(cookie))).toEqual(login);
	});

	it("reads a cookie only up to the age asked for", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-10T10:00:00Z"));
		const cookie = (await createLoginCookie(login)).split(";")[0];
		vi.setSystemTime(new Date("2026-10-10T10:01:01Z"));
		expect(await readLoginState(withCookie(cookie), 60_000)).toBeNull();
		vi.setSystemTime(new Date("2026-10-10T10:00:59Z"));
		expect(await readLoginState(withCookie(cookie), 60_000)).toEqual(login);
	});

	it("clears with an empty value and a zero age", () => {
		const cleared = clearLoginCookie();
		expect(cleared).toContain("Max-Age=0");
		expect(cleared.startsWith("dashboard_login=;")).toBe(true);
	});
});
