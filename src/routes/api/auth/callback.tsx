import { createFileRoute } from "@tanstack/react-router";
import {
	createSessionCookie,
	encryptSession,
	exchangeCodeForTokens,
	fetchUserInfo,
} from "~/lib/auth";

export const Route = createFileRoute("/api/auth/callback")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				try {
					const body = await request.json();
					const { code, codeVerifier } = body;

					if (!code || !codeVerifier) {
						return new Response(
							JSON.stringify({ error: "Missing code or codeVerifier" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					console.log("[auth/callback] Exchanging code for tokens...");
					const tokens = await exchangeCodeForTokens(code, codeVerifier);
					console.log("[auth/callback] Tokens result:", tokens ? "success" : "null");
					if (!tokens) {
						return new Response(
							JSON.stringify({
								error: "Failed to exchange authorization code",
							}),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const user = await fetchUserInfo(tokens.access_token);
					if (!user) {
						return new Response(
							JSON.stringify({
								error: "Failed to fetch user information",
							}),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const session = {
						accessToken: tokens.access_token,
						refreshToken: tokens.refresh_token,
						expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
						user,
					};

					const encrypted = await encryptSession(session);
					const cookie = createSessionCookie(encrypted);

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Set-Cookie": cookie,
						},
					});
				} catch (err) {
					console.error("[auth/callback] Error:", err);
					return new Response(
						JSON.stringify({ error: "Internal server error" }),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
