import { afterEach, describe, expect, it, vi } from "vitest";
import {
	__resetRevocations,
	isRevoked,
} from "../../src/lib/session-revocation";

const verifyLogoutToken = vi.fn();

vi.mock("../../src/lib/backchannel-logout", () => ({
	verifyLogoutToken: (...args: unknown[]) => verifyLogoutToken(...args),
}));

function formRequest(
	body: string,
	contentType = "application/x-www-form-urlencoded",
) {
	return new Request("http://dashboard.test/api/auth/backchannel-logout", {
		method: "POST",
		headers: { "Content-Type": contentType },
		body,
	});
}

afterEach(() => {
	verifyLogoutToken.mockReset();
	__resetRevocations();
});

describe("POST /api/auth/backchannel-logout", () => {
	it("revokes the subject's sessions for a valid logout token", async () => {
		verifyLogoutToken.mockResolvedValue({ sub: "sub-1", iat: 1000 });
		const { Route } = await import(
			"../../src/routes/api/auth/backchannel-logout"
		);

		const res = await Route.options.server.handlers.POST({
			request: formRequest("logout_token=abc"),
		});

		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(verifyLogoutToken).toHaveBeenCalledWith("abc");
		expect(isRevoked("sub-1", 1000)).toBe(true);
		expect(isRevoked("sub-1", 1001)).toBe(false);
	});

	it("ends only the named Authentik session when the token carries a sid", async () => {
		verifyLogoutToken.mockResolvedValue({
			sub: "sub-1",
			iat: 1000,
			sid: "sid-1",
		});
		const { Route } = await import(
			"../../src/routes/api/auth/backchannel-logout"
		);

		const res = await Route.options.server.handlers.POST({
			request: formRequest("logout_token=abc"),
		});

		expect(res.status).toBe(200);
		expect(isRevoked("sub-1", 900, "sid-1")).toBe(true);
		expect(isRevoked("sub-1", 900, "sid-2")).toBe(false);
		expect(isRevoked("sub-1", 1001, "sid-1")).toBe(false);
	});

	it("answers 400 and revokes nothing for an invalid token", async () => {
		verifyLogoutToken.mockResolvedValue(null);
		const { Route } = await import(
			"../../src/routes/api/auth/backchannel-logout"
		);

		const res = await Route.options.server.handlers.POST({
			request: formRequest("logout_token=forged"),
		});

		expect(res.status).toBe(400);
		expect((await res.json()).error).toBe("invalid_request");
		expect(isRevoked("sub-1", 0)).toBe(false);
	});

	it("answers 400 without a logout token, as for lanyard's old JSON post", async () => {
		const { Route } = await import(
			"../../src/routes/api/auth/backchannel-logout"
		);

		const res = await Route.options.server.handlers.POST({
			request: formRequest(
				JSON.stringify({ userId: "sub-1" }),
				"application/json",
			),
		});

		expect(res.status).toBe(400);
		expect(verifyLogoutToken).not.toHaveBeenCalled();
	});
});
