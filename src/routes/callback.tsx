import { createFileRoute } from "@tanstack/react-router";
import {
	createIdTokenCookie,
	createSessionCookie,
	encryptJson,
	encryptSession,
	exchangeCodeForTokens,
	fetchUserInfo,
	readSession,
} from "~/lib/auth";
import { clearLoginCookie, readLoginState } from "~/lib/login-state";

function toLogin(reason: "state" | "denied" | "exchange"): Response {
	const headers = new Headers({
		Location: `/login?error=${reason}`,
		"Cache-Control": "no-store",
	});
	headers.append("Set-Cookie", clearLoginCookie());
	return new Response(null, { status: 303, headers });
}

export const Route = createFileRoute("/callback")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const params = new URL(request.url).searchParams;
				const login = await readLoginState(request);
				const code = params.get("code");
				const state = params.get("state");
				if (!login || (!params.has("error") && state !== login.state)) {
					// another tab finished the attempt they shared
					if (await readSession(request)) {
						return new Response(null, {
							status: 303,
							headers: { Location: "/home", "Cache-Control": "no-store" },
						});
					}
					return toLogin("state");
				}
				if (params.has("error")) return toLogin("denied");
				if (!code || !state) return toLogin("state");

				let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
				let user: Awaited<ReturnType<typeof fetchUserInfo>>;
				try {
					tokens = await exchangeCodeForTokens(code, login.codeVerifier);
					user = tokens ? await fetchUserInfo(tokens.access_token) : null;
				} catch (err) {
					console.error(
						"[callback] sign-in failed:",
						err instanceof Error ? err.message : err,
					);
					return toLogin("exchange");
				}
				if (!tokens || !user) return toLogin("exchange");

				const session = await encryptSession({
					accessToken: tokens.access_token,
					refreshToken: tokens.refresh_token,
					expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
					user,
				});
				const headers = new Headers({
					Location: "/home",
					"Cache-Control": "no-store",
				});
				headers.append("Set-Cookie", createSessionCookie(session));
				if (tokens.id_token) {
					headers.append(
						"Set-Cookie",
						createIdTokenCookie(await encryptJson(tokens.id_token)),
					);
				}
				headers.append("Set-Cookie", clearLoginCookie());
				return new Response(null, { status: 303, headers });
			},
		},
	},
});
