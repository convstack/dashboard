import {
	createLocalJWKSet,
	exportJWK,
	generateKeyPair,
	type JWTPayload,
	SignJWT,
} from "jose";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { CLIENT_ID } from "./auth";
import { verifyLogoutToken } from "./backchannel-logout";

const ISSUER = "http://idp.test/application/o/convstack/";
const EVENT = "http://schemas.openid.net/event/backchannel-logout";

let keySet: ReturnType<typeof createLocalJWKSet>;
let privateKey: CryptoKey;
let otherKey: CryptoKey;

vi.mock("jose", async (importOriginal) => ({
	...(await importOriginal<typeof import("jose")>()),
	createRemoteJWKSet: () => keySet,
}));

vi.mock("./oidc-discovery", () => ({
	discoverOidc: async () => ({
		issuer: ISSUER,
		authorizationEndpoint: "http://idp.test/authorize/",
		tokenEndpoint: "http://idp.test/token/",
		userinfoEndpoint: "http://idp.test/userinfo/",
		jwksUri: "http://idp.test/jwks/",
	}),
}));

beforeAll(async () => {
	const pair = await generateKeyPair("RS256");
	privateKey = pair.privateKey;
	otherKey = (await generateKeyPair("RS256")).privateKey;
	const jwk = await exportJWK(pair.publicKey);
	keySet = createLocalJWKSet({ keys: [{ ...jwk, kid: "k1", alg: "RS256" }] });
});

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function logoutToken(
	claims: JWTPayload = {},
	options: {
		typ?: string;
		key?: CryptoKey;
		iat?: number;
		iss?: string;
		aud?: string;
	} = {},
): Promise<string> {
	return new SignJWT({ events: { [EVENT]: {} }, ...claims })
		.setProtectedHeader({
			alg: "RS256",
			kid: "k1",
			typ: options.typ ?? "logout+jwt",
		})
		.setIssuer(options.iss ?? ISSUER)
		.setAudience(options.aud ?? CLIENT_ID)
		.setSubject("sub-1")
		.setJti("jti-1")
		.setIssuedAt(options.iat)
		.setExpirationTime("5m")
		.sign(options.key ?? privateKey);
}

describe("verifyLogoutToken", () => {
	it("accepts a logout token from Authentik", async () => {
		const iat = Math.floor(Date.now() / 1000) - 10;
		const result = await verifyLogoutToken(await logoutToken({}, { iat }));
		expect(result).toEqual({ sub: "sub-1", iat });
	});

	it("passes on the Authentik session id", async () => {
		const result = await verifyLogoutToken(await logoutToken({ sid: "sid-1" }));
		expect(result?.sid).toBe("sid-1");
	});

	it("rejects a token for another client", async () => {
		expect(
			await verifyLogoutToken(await logoutToken({}, { aud: "other" })),
		).toBeNull();
	});

	it("rejects a token from another issuer", async () => {
		expect(
			await verifyLogoutToken(
				await logoutToken({}, { iss: "http://evil.test/" }),
			),
		).toBeNull();
	});

	it("rejects a token signed with another key", async () => {
		expect(
			await verifyLogoutToken(await logoutToken({}, { key: otherKey })),
		).toBeNull();
	});

	it("rejects a token without the back-channel logout event", async () => {
		expect(
			await verifyLogoutToken(await logoutToken({ events: {} })),
		).toBeNull();
	});

	it("rejects a token carrying a nonce", async () => {
		expect(
			await verifyLogoutToken(await logoutToken({ nonce: "n" })),
		).toBeNull();
	});

	it("rejects a token that is not typed as a logout token", async () => {
		expect(
			await verifyLogoutToken(await logoutToken({}, { typ: "JWT" })),
		).toBeNull();
	});

	it("rejects a token older than five minutes", async () => {
		const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
		expect(
			await verifyLogoutToken(await logoutToken({}, { iat: tenMinutesAgo })),
		).toBeNull();
	});

	it("accepts a token issued a few seconds in the future", async () => {
		const threeSecondsAhead = Math.floor(Date.now() / 1000) + 3;
		const result = await verifyLogoutToken(
			await logoutToken({}, { iat: threeSecondsAhead }),
		);
		expect(result?.sub).toBe("sub-1");
	});

	it("rejects a token issued far in the future", async () => {
		const thirtySecondsAhead = Math.floor(Date.now() / 1000) + 30;
		expect(
			await verifyLogoutToken(
				await logoutToken({}, { iat: thirtySecondsAhead }),
			),
		).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			"back-channel logout rejected:",
			expect.any(String),
		);
	});
});
