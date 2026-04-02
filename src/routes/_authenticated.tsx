import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DashboardShell } from "~/components/layout/dashboard-shell";
import type { SessionData } from "~/lib/auth";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { getSessionFn } from "~/server/functions/auth";
import { getServiceCatalogFn } from "~/server/functions/catalog";

export interface AuthenticatedContext {
	session: SessionData;
	services: ServiceCatalogEntry[];
}

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session) {
			throw redirect({ to: "/login" });
		}
		const services = await getServiceCatalogFn();
		return { session, services } as AuthenticatedContext;
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const { session, services } = Route.useRouteContext();

	return (
		<DashboardShell session={session} services={services}>
			<Outlet />
		</DashboardShell>
	);
}
