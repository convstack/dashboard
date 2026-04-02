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
		let services: ServiceCatalogEntry[] = [];
		try {
			services = await getServiceCatalogFn({
				data: { accessToken: session.accessToken },
			});
		} catch {
			// Catalog unavailable — show empty sidebar rather than breaking
		}
		return { session, services } as AuthenticatedContext;
	},
	component: AuthenticatedLayout,
	errorComponent: ({ error }) => (
		<div className="flex min-h-screen items-center justify-center">
			<div className="max-w-md text-center space-y-4">
				<h1 className="text-xl font-bold">Something went wrong</h1>
				<p className="text-sm text-(--muted-foreground)">
					{error instanceof Error
						? error.message
						: "An unexpected error occurred."}
				</p>
				<button
					type="button"
					onClick={() => (window.location.href = "/home")}
					className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
				>
					Go to Dashboard
				</button>
			</div>
		</div>
	),
});

function AuthenticatedLayout() {
	const { session, services } = Route.useRouteContext();

	return (
		<DashboardShell session={session} services={services}>
			<Outlet />
		</DashboardShell>
	);
}
