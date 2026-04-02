import { createFileRoute } from "@tanstack/react-router";
import {
	createSessionCookie,
	decryptSession,
	encryptSession,
	fetchUserInfo,
	getSessionCookie,
	refreshAccessToken,
} from "~/lib/auth";

export const Route = createFileRoute("/api/auth/refresh")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const cookie = getSessionCookie(request);
				if (!cookie) {
					return new Response(JSON.stringify({ error: "No session" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const session = await decryptSession(cookie);
				if (!session) {
					return new Response(JSON.stringify({ error: "Invalid session" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				// Only refresh if expiring within 5 minutes
				if (session.expiresAt > Date.now() / 1000 + 300) {
					return new Response(JSON.stringify({ refreshed: false }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!session.refreshToken) {
					return new Response(JSON.stringify({ error: "No refresh token" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const tokens = await refreshAccessToken(session.refreshToken);
				if (!tokens) {
					return new Response(JSON.stringify({ error: "Refresh failed" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const user = await fetchUserInfo(tokens.access_token);
				if (!user) {
					return new Response(JSON.stringify({ error: "User info failed" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const newSession = {
					accessToken: tokens.access_token,
					refreshToken: tokens.refresh_token,
					expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
					user,
				};

				const encrypted = await encryptSession(newSession);
				const newCookie = createSessionCookie(encrypted);

				return new Response(JSON.stringify({ refreshed: true }), {
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Set-Cookie": newCookie,
					},
				});
			},
		},
	},
});
