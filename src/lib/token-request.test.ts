import { afterEach, describe, expect, it, vi } from "vitest";

const DOC = {
	issuer: "http://host.docker.internal:9000/application/o/convstack/",
	authorization_endpoint:
		"http://host.docker.internal:9000/application/o/authorize/",
	token_endpoint: "http://host.docker.internal:9000/application/o/token/",
	userinfo_endpoint: "http://host.docker.internal:9000/application/o/userinfo/",
	jwks_uri: "http://host.docker.internal:9000/application/o/convstack/jwks/",
};

function stubAuthentik() {
	const calls: { url: string; headers: Record<string, string> }[] = [];
	vi.stubGlobal(
		"fetch",
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push({
				url,
				headers: (init?.headers ?? {}) as Record<string, string>,
			});
			if (url.includes("openid-configuration")) {
				return new Response(JSON.stringify(DOC));
			}
			return new Response(
				JSON.stringify({
					access_token: "a",
					refresh_token: "r",
					expires_in: 300,
					token_type: "Bearer",
				}),
			);
		},
	);
	return calls;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("token requests to Authentik's internal address", () => {
	it("send the public host on the code exchange", async () => {
		vi.stubEnv("IDP_URL", "http://localhost:9000");
		vi.stubEnv("IDP_INTERNAL_URL", "http://host.docker.internal:9000");
		vi.resetModules();
		const calls = stubAuthentik();
		const { exchangeCodeForTokens } = await import("./auth");

		await exchangeCodeForTokens("code", "verifier");

		const token = calls.find((c) => c.url === DOC.token_endpoint);
		expect(token?.headers.Host).toBe("localhost:9000");
		expect(token?.headers["X-Forwarded-Proto"]).toBe("http");
	});

	it("send the public host on a refresh", async () => {
		vi.stubEnv("IDP_URL", "http://localhost:9000");
		vi.stubEnv("IDP_INTERNAL_URL", "http://host.docker.internal:9000");
		vi.resetModules();
		const calls = stubAuthentik();
		const { refreshAccessToken } = await import("./auth");

		await refreshAccessToken("refresh");

		const token = calls.find((c) => c.url === DOC.token_endpoint);
		expect(token?.headers.Host).toBe("localhost:9000");
	});
});
