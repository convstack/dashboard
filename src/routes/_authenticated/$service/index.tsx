import { createFileRoute, notFound } from "@tanstack/react-router";
import { DynamicPage } from "~/components/pages/dynamic-page";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import type { AuthenticatedContext } from "~/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/$service/")({
	loader: async ({ params, context }) => {
		const ctx = context as unknown as AuthenticatedContext;
		const service = ctx.services.find((s) => s.slug === params.service);
		if (!service || !service.uiManifest) throw notFound();

		const page =
			service.uiManifest.pages.find((p) => p.path === "/") ||
			service.uiManifest.pages[0];

		if (!page) {
			return { service, page: null, sectionData: [], pathParams: {} };
		}

		const sectionData = await Promise.all(
			page.sections.map(async (section) => {
				if (
					!section.endpoint ||
					section.type === "form" ||
					section.type === "two-factor" ||
					section.type === "passkey-manager" ||
					section.type === "widget-grid"
				) {
					return null;
				}
				const endpoint = interpolateEndpoint(section.endpoint, {});
				try {
					const response = await fetch(`${service.baseUrl}${endpoint}`, {
						headers: {
							Authorization: `Bearer ${ctx.session.accessToken}`,
						},
					});
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
	const { service, page, sectionData, pathParams } = Route.useLoaderData();

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
