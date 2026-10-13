import { createFileRoute } from "@tanstack/react-router";
import {
	buildAuthorizationUrl,
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
} from "~/lib/auth";
import { createLoginCookie, readLoginState } from "~/lib/login-state";

const JOIN_WINDOW_MS = 60_000;

export const Route = createFileRoute("/api/auth/login")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				// tabs that were signed out together all land here, within seconds. They
				// share one attempt, or the last to start would invalidate the others;
				// an older one may be about to expire, so it is not joined
				const pending = await readLoginState(request, JOIN_WINDOW_MS);
				const state = pending?.state ?? generateState();
				const codeVerifier = pending?.codeVerifier ?? generateCodeVerifier();
				const codeChallenge = await generateCodeChallenge(codeVerifier);

				let authUrl: string;
				try {
					authUrl = await buildAuthorizationUrl(state, codeChallenge);
				} catch {
					return new Response(null, {
						status: 302,
						headers: { Location: "/login?error=unreachable" },
					});
				}

				const headers = new Headers({
					Location: authUrl,
					"Cache-Control": "no-store",
				});
				if (!pending) {
					headers.append(
						"Set-Cookie",
						await createLoginCookie({ state, codeVerifier }),
					);
				}
				return new Response(null, { status: 302, headers });
			},
		},
	},
});
