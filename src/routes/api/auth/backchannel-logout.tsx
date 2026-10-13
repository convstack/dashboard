import { createFileRoute } from "@tanstack/react-router";
import { verifyLogoutToken } from "~/lib/backchannel-logout";
import { revokeSession, revokeSubject } from "~/lib/session-revocation";

function invalidRequest(): Response {
	return new Response(JSON.stringify({ error: "invalid_request" }), {
		status: 400,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
		},
	});
}

// OIDC Back-Channel Logout: Authentik posts a signed logout token when a
// user's session ends
export const Route = createFileRoute("/api/auth/backchannel-logout")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const form = await request.formData().catch(() => null);
				const token = form?.get("logout_token");
				if (typeof token !== "string") return invalidRequest();

				const claims = await verifyLogoutToken(token);
				if (!claims) return invalidRequest();

				// a token without a sid ends every session of its subject
				if (claims.sid) revokeSession(claims.sid, claims.iat);
				else revokeSubject(claims.sub, claims.iat);
				return new Response(null, {
					status: 200,
					headers: { "Cache-Control": "no-store" },
				});
			},
		},
	},
});
