import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = "a-valid-session-secret-longer-than-32-chars";

async function loadAuth(secret: string | undefined) {
	vi.resetModules();
	vi.stubEnv("SESSION_SECRET", secret);
	return import("./auth");
}

// rejects.toThrow prints the whole loaded module when it fails
async function refusal(secret: string | undefined) {
	const auth = await loadAuth(secret);
	return auth.encryptJson({}).then(
		() => "accepted",
		(error: unknown) => String(error),
	);
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("session secret", () => {
	it("can be imported without a secret, as the browser bundle does", async () => {
		await expect(loadAuth(undefined)).resolves.toBeDefined();
	});

	it("refuses a missing secret", async () => {
		expect(await refusal(undefined)).toMatch(/SESSION_SECRET/);
	});

	it("refuses an empty secret", async () => {
		expect(await refusal("")).toMatch(/SESSION_SECRET/);
	});

	it("refuses a secret shorter than 32 characters", async () => {
		expect(await refusal("x".repeat(31))).toMatch(/SESSION_SECRET/);
	});

	it("refuses the .env.example placeholder", async () => {
		expect(
			await refusal("change-me-to-a-random-string-at-least-32-chars"),
		).toMatch(/SESSION_SECRET/);
	});

	it("refuses the old docker-compose.yml secret", async () => {
		expect(
			await refusal(
				"CHANGEMEPLEASE_dashboard_session_secret_at_least_32_chars",
			),
		).toMatch(/SESSION_SECRET/);
	});

	it("round-trips data under a valid secret", async () => {
		const auth = await loadAuth(VALID);
		const token = await auth.encryptJson({ hello: "world" });
		expect(await auth.decryptJson(token)).toEqual({ hello: "world" });
	});

	it("can't open a cookie made with a secret that shares its first 32 characters", async () => {
		const first = await loadAuth(VALID);
		const token = await first.encryptJson({ hello: "world" });
		const second = await loadAuth(`${VALID}-longer`);
		expect(await second.decryptJson(token)).toBeNull();
		const again = await loadAuth(VALID);
		expect(await again.decryptJson(token)).toEqual({ hello: "world" });
	});
});
