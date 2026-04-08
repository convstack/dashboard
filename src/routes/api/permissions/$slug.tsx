import { createFileRoute } from "@tanstack/react-router";
import { decryptSession, getSessionCookie } from "~/lib/auth";
import { lanyardFetch } from "~/lib/lanyard-client";

export const Route = createFileRoute("/api/permissions/$slug")({
	server: {
		handlers: {
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { slug: string };
			}) => {
				const cookie = getSessionCookie(request);
				if (!cookie) {
					return new Response(JSON.stringify({ permissions: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				const session = await decryptSession(cookie);
				if (!session) {
					return new Response(JSON.stringify({ permissions: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				try {
					const response = await lanyardFetch(
						`/api/services/${params.slug}/permissions`,
						{ accessToken: session.accessToken },
					);

					if (response.ok) {
						const data = await response.json();
						return new Response(JSON.stringify(data), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					}
				} catch {
					// Best effort
				}

				return new Response(JSON.stringify({ permissions: [], orgRoles: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
