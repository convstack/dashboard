import { createFileRoute } from "@tanstack/react-router";
import { DynamicPage } from "~/components/pages/dynamic-page";
import { interpolateEndpoint, sectionUrl } from "~/lib/manifest-routing";
import { proxyPath } from "~/lib/proxy-path";
import { serverServiceTarget } from "~/lib/server-target";
import { lanyardPathAllowed } from "~/lib/service-proxy";
import type { AuthenticatedContext } from "~/routes/_authenticated";

export const Route = createFileRoute("/_authenticated/$service/")({
	loader: async ({ params, context }) => {
		const ctx = context as unknown as AuthenticatedContext;
		const service = ctx.services.find((s) => s.slug === params.service);
		if (!service && ctx.servicesUnavailable) {
			throw new Error(
				"Your apps can't be loaded right now. Reload in a moment.",
			);
		}
		if (!service || !service.uiManifest) return null;

		const page =
			service.uiManifest.pages.find((p) => p.path === "/") ||
			service.uiManifest.pages[0];

		if (!page) {
			return { service, page: null, sectionData: [], pathParams: {} };
		}

		// Where sections come from, and with which credential, once for all
		// sections (server-side only - on the client, the proxy decides per request).
		const isServer = typeof window === "undefined";
		const target = isServer ? await serverServiceTarget(service) : null;

		const sectionData = await Promise.all(
			page.sections.map(async (section) => {
				if (
					!section.endpoint ||
					section.type === "form" ||
					section.type === "markdown-editor" ||
					section.type === "widget-grid" ||
					section.type === "search"
				) {
					return null;
				}
				const endpoint = interpolateEndpoint(section.endpoint, {});
				try {
					const headers: Record<string, string> = {};
					let url: string | null;
					if (target) {
						const checked = sectionUrl(endpoint, target.baseUrl);
						if (!checked) return null;
						if (service.lanyardOwned && !lanyardPathAllowed(checked)) {
							return null;
						}
						url = checked.href;
						if (!target.authorization) return null;
						headers.Authorization = target.authorization;
					} else {
						url = proxyPath(service.slug, endpoint);
						if (!url) return null;
					}
					const response = await fetch(url, {
						headers,
						...(target && service.lanyardOwned
							? { redirect: "manual" as const }
							: {}),
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
