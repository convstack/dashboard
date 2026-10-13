import type { PageSection, TabsConfig } from "@convstack/service-sdk/types";
import { createFileRoute } from "@tanstack/react-router";
import { DynamicPage } from "~/components/pages/dynamic-page";
import {
	findPage,
	interpolateEndpoint,
	sectionUrl,
} from "~/lib/manifest-routing";
import { proxyPath } from "~/lib/proxy-path";
import { serverServiceTarget } from "~/lib/server-target";
import { lanyardPathAllowed } from "~/lib/service-proxy";
import type { AuthenticatedContext } from "~/routes/_authenticated";

interface FetchContext {
	serviceSlug: string;
	lanyardOwned: boolean;
	pathParams: Record<string, string>;
	// server only; on the client the proxy picks the target
	target: { baseUrl: string; authorization: string | null } | null;
}

async function fetchOneSection(
	section: PageSection,
	ctx: FetchContext,
	windowParams?: { from: string; to: string },
): Promise<unknown | null> {
	if (
		!section.endpoint ||
		section.type === "form" ||
		section.type === "markdown-editor" ||
		section.type === "widget-grid" ||
		section.type === "search" ||
		section.type === "callout" ||
		section.type === "empty-state" ||
		section.type === "hero"
	) {
		return null;
	}
	const endpoint = interpolateEndpoint(section.endpoint, ctx.pathParams);
	try {
		let url: URL;
		if (ctx.target) {
			const checked = sectionUrl(endpoint, ctx.target.baseUrl);
			if (!checked) return null;
			if (ctx.lanyardOwned && !lanyardPathAllowed(checked)) return null;
			url = checked;
		} else {
			const path = proxyPath(ctx.serviceSlug, endpoint);
			if (!path) return null;
			// Client path is relative; resolve against a dummy origin for URL parsing.
			url = new URL(path, "http://localhost");
		}
		if (windowParams) {
			url.searchParams.set("from", windowParams.from);
			url.searchParams.set("to", windowParams.to);
		}
		const headers: Record<string, string> = {};
		if (ctx.target) {
			if (!ctx.target.authorization) return null;
			headers.Authorization = ctx.target.authorization;
		}
		// On the client, reconstruct the relative URL from pathname+search only.
		const fetchUrl = ctx.target ? url.href : `${url.pathname}${url.search}`;
		const response = await fetch(fetchUrl, {
			headers,
			...(ctx.target && ctx.lanyardOwned
				? { redirect: "manual" as const }
				: {}),
		});
		if (!response.ok) return null;
		return response.json();
	} catch {
		return null;
	}
}

async function fetchSectionData(
	section: PageSection,
	ctx: FetchContext,
): Promise<unknown | null> {
	if (section.type === "tabs") {
		const tabsConfig = section.config as unknown as TabsConfig;
		return Promise.all(
			tabsConfig.tabs.map((tab) =>
				Promise.all(
					tab.sections.map((inner) => fetchOneSection(inner, ctx, undefined)),
				),
			),
		);
	}
	return fetchOneSection(section, ctx);
}

export const Route = createFileRoute("/_authenticated/$service/$")({
	loader: async ({ params, context }) => {
		const ctx = context as unknown as AuthenticatedContext;
		const service = ctx.services.find((s) => s.slug === params.service);
		if (!service && ctx.servicesUnavailable) {
			throw new Error(
				"Your apps can't be loaded right now. Reload in a moment.",
			);
		}
		if (!service || !service.uiManifest) return null;

		const path = `/${params._splat || ""}`;
		const match = findPage(service.uiManifest.pages, path);
		if (!match) return null;

		const { page, pathParams } = match;

		const isServer = typeof window === "undefined";
		const fetchCtx: FetchContext = {
			serviceSlug: service.slug,
			lanyardOwned: service.lanyardOwned === true,
			pathParams,
			target: isServer ? await serverServiceTarget(service) : null,
		};

		const sectionData = await Promise.all(
			page.sections.map((section) => fetchSectionData(section, fetchCtx)),
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
