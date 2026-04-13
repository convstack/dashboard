import { createFileRoute } from "@tanstack/react-router";

/**
 * Backchannel logout endpoint — called by Lanyard when a user is banned
 * or their sessions are revoked. Since Dashboard uses stateless encrypted
 * cookies (not a session store), we can't invalidate individual sessions
 * server-side. The user's next request will fail with 401 when the
 * OAuth2 access token is checked against Lanyard (token was revoked).
 *
 * This endpoint exists so Lanyard's propagation doesn't get a 404.
 * In the future, if Dashboard uses a session store, this would
 * delete the user's session record.
 */
export const Route = createFileRoute("/api/auth/backchannel-logout")({
	server: {
		handlers: {
			POST: async () => {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
