import { afterEach, describe, expect, it, vi } from "vitest";
import {
	__resetDiscoveryCache,
	discoverOidc,
	parseDiscovery,
	toPublicEndpoints,
} from "./oidc-discovery";

const DOC = {
	issuer: "http://localhost:9000/application/o/convstack/",
	authorization_endpoint: "http://localhost:9000/application/o/authorize/",
	token_endpoint: "http://localhost:9000/application/o/token/",
	userinfo_endpoint: "http://localhost:9000/application/o/userinfo/",
	jwks_uri: "http://localhost:9000/application/o/convstack/jwks/",
	end_session_endpoint:
		"http://localhost:9000/application/o/convstack/end-session/",
};

const INTERNAL_DOC = {
	issuer: "http://host.docker.internal:9000/application/o/convstack/",
	authorization_endpoint:
		"http://host.docker.internal:9000/application/o/authorize/",
	token_endpoint: "http://host.docker.internal:9000/application/o/token/",
	userinfo_endpoint: "http://host.docker.internal:9000/application/o/userinfo/",
	jwks_uri: "http://host.docker.internal:9000/application/o/convstack/jwks/",
	end_session_endpoint:
		"http://host.docker.internal:9000/application/o/convstack/end-session/",
};

afterEach(() => {
	__resetDiscoveryCache();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("parseDiscovery", () => {
	it("maps the standard document to typed endpoints", () => {
		const r = parseDiscovery(DOC);
		expect(r.issuer).toBe(DOC.issuer);
		expect(r.authorizationEndpoint).toBe(DOC.authorization_endpoint);
		expect(r.tokenEndpoint).toBe(DOC.token_endpoint);
		expect(r.userinfoEndpoint).toBe(DOC.userinfo_endpoint);
		expect(r.jwksUri).toBe(DOC.jwks_uri);
		expect(r.endSessionEndpoint).toBe(DOC.end_session_endpoint);
	});

	it("throws when a required endpoint is missing", () => {
		const { token_endpoint, ...incomplete } = DOC;
		expect(() => parseDiscovery(incomplete)).toThrow(/token_endpoint/);
	});

	it("tolerates a missing end_session_endpoint", () => {
		const { end_session_endpoint, ...noLogout } = DOC;
		expect(parseDiscovery(noLogout).endSessionEndpoint).toBeUndefined();
	});
});

describe("toPublicEndpoints", () => {
	const internalUrl = "http://host.docker.internal:9000";
	const publicUrl = "http://localhost:9000";
	const endpoints = parseDiscovery(INTERNAL_DOC);

	it("rewrites the browser-facing endpoints and issuer to the public origin", () => {
		const r = toPublicEndpoints(endpoints, internalUrl, publicUrl);
		expect(r.issuer).toBe("http://localhost:9000/application/o/convstack/");
		expect(r.authorizationEndpoint).toBe(
			"http://localhost:9000/application/o/authorize/",
		);
		expect(r.endSessionEndpoint).toBe(
			"http://localhost:9000/application/o/convstack/end-session/",
		);
	});

	it("leaves the server-fetched endpoints on the internal origin", () => {
		const r = toPublicEndpoints(endpoints, internalUrl, publicUrl);
		expect(r.tokenEndpoint).toBe(endpoints.tokenEndpoint);
		expect(r.userinfoEndpoint).toBe(endpoints.userinfoEndpoint);
		expect(r.jwksUri).toBe(endpoints.jwksUri);
	});

	it("preserves path and query exactly, only swapping the origin", () => {
		const withQuery = parseDiscovery({
			...INTERNAL_DOC,
			authorization_endpoint:
				"http://host.docker.internal:9000/application/o/authorize/?prompt=login",
		});
		const r = toPublicEndpoints(withQuery, internalUrl, publicUrl);
		expect(r.authorizationEndpoint).toBe(
			"http://localhost:9000/application/o/authorize/?prompt=login",
		);
	});

	it("tolerates a missing end_session_endpoint", () => {
		const { end_session_endpoint, ...noLogout } = INTERNAL_DOC;
		const r = toPublicEndpoints(
			parseDiscovery(noLogout),
			internalUrl,
			publicUrl,
		);
		expect(r.endSessionEndpoint).toBeUndefined();
	});

	it("throws when a rewritten endpoint is on an unexpected origin", () => {
		const wrong = parseDiscovery({
			...INTERNAL_DOC,
			authorization_endpoint:
				"http://evil.example.com/application/o/authorize/",
		});
		expect(() => toPublicEndpoints(wrong, internalUrl, publicUrl)).toThrow(
			/not on the expected origin/,
		);
	});
});

describe("discoverOidc", () => {
	it("fetches once and returns correctly mapped endpoints", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(DOC),
		} as Response);

		const r = await discoverOidc();

		expect(r.issuer).toBe(DOC.issuer);
		expect(r.authorizationEndpoint).toBe(DOC.authorization_endpoint);
		expect(r.tokenEndpoint).toBe(DOC.token_endpoint);
		expect(r.userinfoEndpoint).toBe(DOC.userinfo_endpoint);
		expect(r.jwksUri).toBe(DOC.jwks_uri);
		expect(r.endSessionEndpoint).toBe(DOC.end_session_endpoint);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns the cached value on a second call without fetching again", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(DOC),
		} as Response);

		await discoverOidc();
		await discoverOidc();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("fetches again after __resetDiscoveryCache", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(DOC),
		} as Response);

		await discoverOidc();
		__resetDiscoveryCache();
		await discoverOidc();

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("rejects with the status when the response is not ok", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: false,
			status: 404,
			json: () => Promise.resolve({}),
		} as Response);

		await expect(discoverOidc()).rejects.toThrow(/404/);
	});
});

describe("discoverOidc with IDP_INTERNAL_URL set", () => {
	it("fetches from the internal origin and returns public-facing endpoints", async () => {
		vi.stubEnv("IDP_URL", "http://localhost:9000");
		vi.stubEnv("IDP_INTERNAL_URL", "http://host.docker.internal:9000");
		vi.resetModules();
		const mod = await import("./oidc-discovery");

		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(INTERNAL_DOC),
		} as Response);

		const r = await mod.discoverOidc();

		expect(fetchMock).toHaveBeenCalledWith(
			"http://host.docker.internal:9000/application/o/convstack/.well-known/openid-configuration",
		);
		expect(r.issuer).toBe("http://localhost:9000/application/o/convstack/");
		expect(r.authorizationEndpoint).toBe(
			"http://localhost:9000/application/o/authorize/",
		);
		expect(r.tokenEndpoint).toBe(
			"http://host.docker.internal:9000/application/o/token/",
		);
	});
});

describe("publicHostHeaders", () => {
	it("adds nothing when the dashboard reaches Authentik directly", async () => {
		vi.stubEnv("IDP_URL", "http://localhost:9000");
		vi.stubEnv("IDP_INTERNAL_URL", "");
		vi.resetModules();
		const mod = await import("./oidc-discovery");
		expect(mod.publicHostHeaders()).toEqual({});
	});

	it("names the public host and scheme when calling the internal address", async () => {
		vi.stubEnv("IDP_URL", "https://auth.example.org");
		vi.stubEnv("IDP_INTERNAL_URL", "http://authentik-server:9000");
		vi.resetModules();
		const mod = await import("./oidc-discovery");
		expect(mod.publicHostHeaders()).toEqual({
			Host: "auth.example.org",
			"X-Forwarded-Proto": "https",
		});
	});
});
