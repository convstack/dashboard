import { afterEach, describe, expect, it } from "vitest";
import {
	__resetRevocations,
	isRevoked,
	revokeSession,
	revokeSubject,
} from "./session-revocation";

afterEach(() => {
	__resetRevocations();
});

describe("session revocation", () => {
	it("revokes sessions issued at or before the logout", () => {
		revokeSubject("sub-1", 1000);
		expect(isRevoked("sub-1", 999)).toBe(true);
		expect(isRevoked("sub-1", 1000)).toBe(true);
	});

	it("keeps sessions issued after the logout", () => {
		revokeSubject("sub-1", 1000);
		expect(isRevoked("sub-1", 1001)).toBe(false);
	});

	it("only affects the subject that logged out", () => {
		revokeSubject("sub-1", 1000);
		expect(isRevoked("sub-2", 900)).toBe(false);
	});

	it("never moves a revocation back, so replaying an older logout changes nothing", () => {
		revokeSubject("sub-1", 1000);
		revokeSubject("sub-1", 500);
		expect(isRevoked("sub-1", 800)).toBe(true);
	});

	it("forgets revocations older than a day", () => {
		revokeSubject("sub-1", 1000);
		revokeSubject("sub-2", 1000 + 86401);
		expect(isRevoked("sub-1", 900)).toBe(false);
	});

	it("revokes a session's tokens issued at or before the logout", () => {
		revokeSession("sid-1", 1000);
		expect(isRevoked("sub-1", 999, "sid-1")).toBe(true);
		expect(isRevoked("sub-1", 1000, "sid-1")).toBe(true);
	});

	it("keeps a later sign-in that reuses the Authentik session", () => {
		revokeSession("sid-1", 1000);
		expect(isRevoked("sub-1", 1001, "sid-1")).toBe(false);
	});

	it("keeps the subject's other sessions when one session is revoked", () => {
		revokeSession("sid-1", 1000);
		expect(isRevoked("sub-1", 900, "sid-2")).toBe(false);
		expect(isRevoked("sub-1", 900)).toBe(false);
	});

	it("forgets session revocations older than a day", () => {
		revokeSession("sid-1", 1000);
		revokeSession("sid-2", 1000 + 86401);
		expect(isRevoked("sub-1", 900, "sid-1")).toBe(false);
	});
});
