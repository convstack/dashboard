import { describe, expect, it } from "vitest";
import { LOGIN_ERRORS, loginOutcome } from "../../src/lib/login-page";

describe("what /login does", () => {
	it("goes straight to sign-in when there is nothing to say", () => {
		expect(loginOutcome(undefined, true)).toBe("sign-in");
	});

	it("shows every sign-in error instead of trying again, so a failure can't loop", () => {
		for (const error of Object.keys(LOGIN_ERRORS)) {
			expect(loginOutcome(error as keyof typeof LOGIN_ERRORS, true)).toBe(
				"show-error",
			);
			expect(loginOutcome(error as keyof typeof LOGIN_ERRORS, false)).toBe(
				"show-error",
			);
		}
	});

	it("shows the notice when lanyard can't be reached", () => {
		expect(loginOutcome(undefined, false)).toBe("show-unreachable");
	});
});
