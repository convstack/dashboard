import type { PageSection, TabsConfig } from "@convstack/service-sdk/types";
import { createFileRoute } from "@tanstack/react-router";
import { DynamicPage } from "~/components/pages/dynamic-page";
import { findPage, interpolateEndpoint } from "~/lib/manifest-routing";
import { resolvePermissions } from "~/lib/service-proxy";
import type { AuthenticatedContext } from "~/routes/_authenticated";

interface FetchContext {
	isServer: boolean;
	serviceSlug: string;
	serviceBaseUrl: string;
	pathParams: Record<string, string>;
	session: AuthenticatedContext["session"];
	permissions: string[];
	orgRoles: Array<{ orgId: string; slug: string; role: string }>;
}

async function fetchOneSection(
	section: PageSection,
	ctx: FetchContext,
	windowParams?: { from: string; to: string },
): Promise<unknown | null> {
	if (
		!section.endpoint ||
		section.type === "form" ||
		section.type === "two-factor" ||
		section.type === "passkey-manager" ||
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
		const rawUrl = ctx.isServer
			? `${ctx.serviceBaseUrl}${endpoint}`
			: `/api/proxy/${ctx.serviceSlug}${endpoint}`;
		// Client path is relative; resolve against a dummy origin for URL parsing.
		const base = ctx.isServer ? undefined : "http://localhost";
		const url = new URL(rawUrl, base);
		if (windowParams) {
			url.searchParams.set("from", windowParams.from);
			url.searchParams.set("to", windowParams.to);
		}
		const headers: Record<string, string> = {};
		if (ctx.isServer) {
			headers.Authorization = `Bearer ${ctx.session.accessToken}`;
			headers["X-User-Id"] = ctx.session.user.id;
			headers["X-User-Email"] = ctx.session.user.email;
			headers["X-User-Permissions"] = ctx.permissions.join(",");
			headers["X-User-Org-Roles"] = JSON.stringify(ctx.orgRoles);
		}
		// On the client, reconstruct the relative URL from pathname+search only.
		const fetchUrl = ctx.isServer
			? url.toString()
			: `${url.pathname}${url.search}`;
		const response = await fetch(fetchUrl, { headers });
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
		if (!service || !service.uiManifest) return null;

		const path = `/${params._splat || ""}`;
		const match = findPage(service.uiManifest.pages, path);
		if (!match) return null;

		const { page, pathParams } = match;

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

		const fetchCtx: FetchContext = {
			isServer,
			serviceSlug: service.slug,
			serviceBaseUrl: service.baseUrl,
			pathParams,
			session: ctx.session,
			permissions,
			orgRoles,
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
