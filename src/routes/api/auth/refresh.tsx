import { createFileRoute } from "@tanstack/react-router";
import { decodeJwt } from "jose";
import {
	clearIdTokenCookie,
	clearSessionCookie,
	createIdTokenCookie,
	createSessionCookie,
	decryptSession,
	encryptJson,
	encryptSession,
	fetchUserInfo,
	getSessionCookie,
	isSessionRevoked,
	refreshAccessToken,
} from "~/lib/auth";
import { validateOrigin } from "~/lib/security/csrf";

// a stale cookie would otherwise keep being sent until its Max-Age runs out
function rejected(error: string): Response {
	const headers = new Headers({ "Content-Type": "application/json" });
	headers.append("Set-Cookie", clearSessionCookie());
	headers.append("Set-Cookie", clearIdTokenCookie());
	return new Response(JSON.stringify({ error }), { status: 401, headers });
}

export const Route = createFileRoute("/api/auth/refresh")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				if (!validateOrigin(request)) {
					return new Response(JSON.stringify({ error: "Invalid origin" }), {
						status: 403,
						headers: { "Content-Type": "application/json" },
					});
				}

				const cookie = getSessionCookie(request);
				if (!cookie) {
					return rejected("No session");
				}

				const session = await decryptSession(cookie);
				if (!session) {
					return rejected("Invalid session");
				}

				if (isSessionRevoked(session)) return rejected("Session revoked");

				// Only refresh if expiring within 5 minutes
				if (session.expiresAt > Date.now() / 1000 + 300) {
					return new Response(JSON.stringify({ refreshed: false }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!session.refreshToken) {
					return rejected("No refresh token");
				}

				const tokens = await refreshAccessToken(session.refreshToken);
				if (!tokens) {
					return rejected("Refresh failed");
				}

				// Authentik keeps honouring a refresh token after the session behind it
				// ends, but the tokens it then issues carry no sid
				if (
					decodeJwt(tokens.access_token).sid !==
					decodeJwt(session.accessToken).sid
				) {
					return rejected("Session ended");
				}

				const user = await fetchUserInfo(tokens.access_token);
				if (!user) {
					return rejected("User info failed");
				}

				const newSession = {
					accessToken: tokens.access_token,
					refreshToken: tokens.refresh_token,
					expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
					user,
				};

				const encrypted = await encryptSession(newSession);
				const newCookie = createSessionCookie(encrypted);

				const headers = new Headers({ "Content-Type": "application/json" });
				headers.append("Set-Cookie", newCookie);
				if (tokens.id_token) {
					const encryptedIdToken = await encryptJson(tokens.id_token);
					headers.append("Set-Cookie", createIdTokenCookie(encryptedIdToken));
				}

				return new Response(JSON.stringify({ refreshed: true }), {
					status: 200,
					headers,
				});
			},
		},
	},
});
