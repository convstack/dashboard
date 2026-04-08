import { createFileRoute } from "@tanstack/react-router";
import { DynamicPage } from "~/components/pages/dynamic-page";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import { resolvePermissions } from "~/lib/service-proxy";
import type { AuthenticatedContext } from "~/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/$service/")({
	loader: async ({ params, context }) => {
		const ctx = context as unknown as AuthenticatedContext;
		const service = ctx.services.find((s) => s.slug === params.service);
		if (!service || !service.uiManifest) return null;

		const page =
			service.uiManifest.pages.find((p) => p.path === "/") ||
			service.uiManifest.pages[0];

		if (!page) {
			return { service, page: null, sectionData: [], pathParams: {} };
		}

		// Resolve permissions once for all sections (server-side only — on the
		// client, the proxy resolves them per-request).
		const isServer = typeof window === "undefined";
		let permissions: string[] = [];
		let orgRoles: Array<{ orgId: string; slug: string; role: string }> = [];
		if (isServer) {
			const resolved = await resolvePermissions(
				ctx.session.accessToken,
				service.slug,
			);
			permissions = resolved.permissions;
			orgRoles = resolved.orgRoles;
		}

		const sectionData = await Promise.all(
			page.sections.map(async (section) => {
				if (
					!section.endpoint ||
					section.type === "form" ||
					section.type === "two-factor" ||
					section.type === "passkey-manager" ||
					section.type === "markdown-editor" ||
					section.type === "widget-grid" ||
					section.type === "search"
				) {
					return null;
				}
				const endpoint = interpolateEndpoint(section.endpoint, {});
				try {
					const url = isServer
						? `${service.baseUrl}${endpoint}`
						: `/api/proxy/${service.slug}${endpoint}`;
					const headers: Record<string, string> = {};
					if (isServer) {
						headers.Authorization = `Bearer ${ctx.session.accessToken}`;
						headers["X-User-Id"] = ctx.session.user.id;
						headers["X-User-Email"] = ctx.session.user.email;
						headers["X-User-Permissions"] = permissions.join(",");
						headers["X-User-Org-Roles"] = JSON.stringify(orgRoles);
					}
					const response = await fetch(url, { headers });
					if (!response.ok) return null;
					return response.json();
				} catch {
					return null;
				}
			}),
		);

		return { service, page, sectionData, pathParams: {} };
	},
	component: ServiceIndexPage,
});

function ServiceIndexPage() {
	const data = Route.useLoaderData();
	if (!data?.service) return null;
	const { service, page, sectionData, pathParams } = data;

	if (!page) {
		return (
			<div>
				<h1 className="text-2xl font-bold">
					{service.uiManifest?.name || service.name}
				</h1>
				<p className="mt-2 text-sm text-(--muted-foreground)">
					{service.description || "This service has no pages configured."}
				</p>
			</div>
		);
	}

	return (
		<DynamicPage
			page={page}
			service={service}
			sectionData={sectionData}
			pathParams={pathParams}
		/>
	);
}
