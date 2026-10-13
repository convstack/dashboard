import { describe, expect, it } from "vitest";
import type { SessionData } from "./auth";
import { toClientSession } from "./session-view";

const full: SessionData = {
	accessToken: "access.token.value",
	refreshToken: "refresh-token-value",
	expiresAt: 1_900_000_000,
	user: {
		id: "sub-1",
		name: "Ada",
		email: "ada@x.dev",
		image: "https://img.test/a.png",
		role: "admin",
		deletionPending: true,
	},
};

describe("toClientSession", () => {
	it("keeps the user and the expiry", () => {
		expect(toClientSession(full)).toEqual({
			expiresAt: 1_900_000_000,
			user: full.user,
		});
	});

	it("carries no token anywhere in what the browser receives", () => {
		const text = JSON.stringify(toClientSession(full));
		expect(text).not.toContain("access.token.value");
		expect(text).not.toContain("refresh-token-value");
		expect(Object.keys(toClientSession(full)).sort()).toEqual([
			"expiresAt",
			"user",
		]);
	});

	it("drops a field added to the stored session later", () => {
		const grown = {
			...full,
			idToken: "id.token.value",
			extra: 1,
		} as SessionData;
		const text = JSON.stringify(toClientSession(grown));
		expect(text).not.toContain("id.token.value");
		expect(Object.keys(toClientSession(grown)).sort()).toEqual([
			"expiresAt",
			"user",
		]);
	});
});
