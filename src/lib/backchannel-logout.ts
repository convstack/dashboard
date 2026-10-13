import { createRemoteJWKSet, jwtVerify } from "jose";
import { CLIENT_ID } from "./auth";
import { discoverOidc } from "./oidc-discovery";

const BACKCHANNEL_LOGOUT_EVENT =
	"http://schemas.openid.net/event/backchannel-logout";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyLogoutToken(
	token: string,
): Promise<{ sub: string; iat: number; sid?: string } | null> {
	const { issuer, jwksUri } = await discoverOidc();
	jwks ??= createRemoteJWKSet(new URL(jwksUri));
	try {
		const { payload } = await jwtVerify(token, jwks, {
			issuer,
			audience: CLIENT_ID,
			typ: "logout+jwt",
			maxTokenAge: "5m",
			clockTolerance: 5,
		});
		const events = payload.events as Record<string, unknown> | undefined;
		if (typeof events?.[BACKCHANNEL_LOGOUT_EVENT] !== "object") return null;
		// logout tokens never carry a nonce; one that does is an ID token
		if (payload.nonce !== undefined) return null;
		if (typeof payload.sub !== "string" || typeof payload.iat !== "number") {
			return null;
		}
		return {
			sub: payload.sub,
			iat: payload.iat,
			sid: typeof payload.sid === "string" ? payload.sid : undefined,
		};
	} catch (err) {
		console.warn(
			"back-channel logout rejected:",
			err instanceof Error ? err.message : err,
		);
		return null;
	}
}
