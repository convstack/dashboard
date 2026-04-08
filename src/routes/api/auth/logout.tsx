import { createFileRoute } from "@tanstack/react-router";
import {
	clearSessionCookie,
	decryptSession,
	getSessionCookie,
} from "~/lib/auth";

export const Route = createFileRoute("/api/auth/logout")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				// Read the ID token before clearing the session (needed for end-session)
				let idToken: string | undefined;
				const cookie = getSessionCookie(request);
				if (cookie) {
					const session = await decryptSession(cookie);
					idToken = session?.idToken;
				}

				return new Response(
					JSON.stringify({ success: true, idToken }),
					{
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Set-Cookie": clearSessionCookie(),
						},
					},
				);
			},
		},
	},
});
