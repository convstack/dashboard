import { afterEach, describe, expect, it } from "vitest";
import { encryptSession, readSession, type SessionData } from "./auth";
import {
	__resetRevocations,
	revokeSession,
	revokeSubject,
} from "./session-revocation";

function jwt(payload: Record<string, unknown>): string {
	const encode = (value: object) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

function session(overrides: Partial<SessionData> = {}): SessionData {
	const now = Math.floor(Date.now() / 1000);
	return {
		accessToken: jwt({ sub: "sub-1", iat: now - 60 }),
		refreshToken: "refresh",
		expiresAt: now + 240,
		user: { id: "sub-1", name: "Ada", email: "ada@x.dev", role: "user" },
		...overrides,
	};
}

async function requestWith(data?: SessionData): Promise<Request> {
	const headers = new Headers();
	if (data) {
		headers.set("cookie", `dashboard_session=${await encryptSession(data)}`);
	}
	return new Request("http://dashboard.test/", { headers });
}

afterEach(() => {
	__resetRevocations();
});

describe("readSession", () => {
	it("returns a live session", async () => {
		const result = await readSession(await requestWith(session()));
		expect(result?.user.id).toBe("sub-1");
	});

	it("returns null without a cookie", async () => {
		expect(await readSession(await requestWith())).toBeNull();
	});

	it("returns null for a cookie it cannot decrypt", async () => {
		const request = new Request("http://dashboard.test/", {
			headers: { cookie: "dashboard_session=garbage" },
		});
		expect(await readSession(request)).toBeNull();
	});

	it("returns null once the access token has expired", async () => {
		const now = Math.floor(Date.now() / 1000);
		expect(
			await readSession(await requestWith(session({ expiresAt: now - 1 }))),
		).toBeNull();
	});

	it("returns null for a session issued before a back-channel logout", async () => {
		revokeSubject("sub-1", Math.floor(Date.now() / 1000));
		expect(await readSession(await requestWith(session()))).toBeNull();
	});

	it("keeps a session issued after the logout", async () => {
		revokeSubject("sub-1", Math.floor(Date.now() / 1000) - 120);
		expect(await readSession(await requestWith(session()))).not.toBeNull();
	});

	it("returns null when the access token is not a readable JWT", async () => {
		expect(
			await readSession(await requestWith(session({ accessToken: "opaque" }))),
		).toBeNull();
	});

	it("returns null for a session from a logged-out Authentik session", async () => {
		const now = Math.floor(Date.now() / 1000);
		revokeSession("sid-1", now);
		const accessToken = jwt({ sub: "sub-1", iat: now - 60, sid: "sid-1" });
		expect(
			await readSession(await requestWith(session({ accessToken }))),
		).toBeNull();
	});

	it("keeps a sign-in after the dashboard's own logout, in the same Authentik session", async () => {
		const now = Math.floor(Date.now() / 1000);
		revokeSession("sid-1", now - 120);
		const accessToken = jwt({ sub: "sub-1", iat: now - 60, sid: "sid-1" });
		expect(
			await readSession(await requestWith(session({ accessToken }))),
		).not.toBeNull();
	});

	it("keeps the same user's session from another Authentik session", async () => {
		const now = Math.floor(Date.now() / 1000);
		revokeSession("sid-1", now);
		const accessToken = jwt({ sub: "sub-1", iat: now - 60, sid: "sid-2" });
		expect(
			await readSession(await requestWith(session({ accessToken }))),
		).not.toBeNull();
	});
});
