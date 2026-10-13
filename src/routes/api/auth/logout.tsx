import { createFileRoute } from "@tanstack/react-router";
import {
	CLIENT_ID,
	clearIdTokenCookie,
	clearSessionCookie,
	DASHBOARD_URL,
	decryptJson,
	getIdTokenCookie,
} from "~/lib/auth";
import { discoverOidc } from "~/lib/oidc-discovery";
import { validateOrigin } from "~/lib/security/csrf";

export const Route = createFileRoute("/api/auth/logout")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				if (!validateOrigin(request)) {
					return new Response(JSON.stringify({ error: "Invalid origin" }), {
						status: 403,
						headers: { "Content-Type": "application/json" },
					});
				}

				const idTokenCookie = getIdTokenCookie(request);
				const idToken = idTokenCookie
					? await decryptJson<string>(idTokenCookie)
					: null;

				// local sign-out has to work even when the IdP is unreachable
				let endSession: string | undefined;
				try {
					endSession = (await discoverOidc()).endSessionEndpoint;
				} catch {
					endSession = undefined;
				}

				let location = "/login";
				if (endSession) {
					// the IdP refuses a return target without the hint
					const params = new URLSearchParams({ client_id: CLIENT_ID });
					if (idToken) {
						params.set("id_token_hint", idToken);
						params.set("post_logout_redirect_uri", `${DASHBOARD_URL}/login`);
					}
					const target = new URL(`${endSession}?${params.toString()}`);
					location = target.toString();
					// Authentik answers end-session with an empty page while the
					// browser has any flow open, and its own settings page leaves one
					// open. Its cancel address clears that and forwards to `next`
					const authentikPath = target.pathname.indexOf("/application/o/");
					if (authentikPath !== -1) {
						const cancel = new URL(
							`${target.pathname.slice(0, authentikPath)}/flows/-/cancel/`,
							target.origin,
						);
						cancel.searchParams.set("next", target.pathname + target.search);
						location = cancel.toString();
					}
				}

				const headers = new Headers({
					Location: location,
					"Cache-Control": "no-store",
				});
				headers.append("Set-Cookie", clearSessionCookie());
				headers.append("Set-Cookie", clearIdTokenCookie());
				return new Response(null, { status: 303, headers });
			},
		},
	},
});
