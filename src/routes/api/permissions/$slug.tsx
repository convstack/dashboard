import { createFileRoute } from "@tanstack/react-router";
import { readSession } from "~/lib/auth";
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
				const session = await readSession(request);
				if (!session) {
					return new Response(JSON.stringify({ permissions: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				const slug = encodeURIComponent(params.slug);
				try {
					const response = await lanyardFetch(
						`/api/services/${slug}/permissions`,
						{ accessToken: session.accessToken },
					);

					if (response.ok) {
						// page JavaScript gets these two only; the proof is for services
						const { permissions, orgRoles } = await response.json();
						return new Response(JSON.stringify({ permissions, orgRoles }), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					}
					console.warn(
						`lanyard /api/services/${slug}/permissions answered ${response.status}`,
					);
				} catch (err) {
					console.warn(
						`lanyard /api/services/${slug}/permissions failed:`,
						err instanceof Error ? err.message : err,
					);
				}

				return new Response(JSON.stringify({ permissions: [], orgRoles: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
