import { createFileRoute } from "@tanstack/react-router";
import { DynamicPage } from "~/components/pages/dynamic-page";
import { findPage, interpolateEndpoint } from "~/lib/manifest-routing";
import type { AuthenticatedContext } from "~/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/$service/$")({
	loader: async ({ params, context }) => {
		const ctx = context as unknown as AuthenticatedContext;
		const service = ctx.services.find((s) => s.slug === params.service);
		if (!service || !service.uiManifest) return null;

		const path = `/${params._splat || ""}`;
		const match = findPage(service.uiManifest.pages, path);
		if (!match) return null;

		const { page, pathParams } = match;

		// Fetch section data server-side with interpolated endpoints
		// Skip sections that don't need server-side data (forms, two-factor, passkey-manager)
		const sectionData = await Promise.all(
			page.sections.map(async (section) => {
				if (
					!section.endpoint ||
					section.type === "form" ||
					section.type === "two-factor" ||
					section.type === "passkey-manager" ||
					section.type === "markdown-editor" ||
					section.type === "widget-grid"
				) {
					return null;
				}
				const endpoint = interpolateEndpoint(section.endpoint, pathParams);
				try {
					const isServer = typeof window === "undefined";
					const url = isServer
						? `${service.baseUrl}${endpoint}`
						: `/api/proxy/${service.slug}${endpoint}`;
					const headers: Record<string, string> = {};
					if (isServer) {
						headers.Authorization = `Bearer ${ctx.session.accessToken}`;
					}
					const response = await fetch(url, { headers });
					if (!response.ok) return null;
					return response.json();
				} catch {
					return null;
				}
			}),
		);

		return { service, page, sectionData, pathParams };
	},
	component: ServiceSubPage,
});

function ServiceSubPage() {
	const data = Route.useLoaderData();
	if (!data?.service) return null;
	const { service, page, sectionData, pathParams } = data;

	return (
		<DynamicPage
			page={page}
			service={service}
			sectionData={sectionData}
			pathParams={pathParams}
		/>
	);
}
