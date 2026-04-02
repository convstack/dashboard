import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { DashboardShell } from "~/components/layout/dashboard-shell";
import type { SessionData } from "~/lib/auth";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { getSessionFn } from "~/server/functions/auth";
import { getServiceCatalogFn } from "~/server/functions/catalog";

export interface AuthenticatedContext {
	session: SessionData;
	services: ServiceCatalogEntry[];
}

// Module-level cache that survives across all router operations
let serviceCache: ServiceCatalogEntry[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 60_000; // 1 minute

async function getServices(
	accessToken: string,
): Promise<ServiceCatalogEntry[]> {
	// Return cache if fresh
	if (serviceCache.length > 0 && Date.now() - lastFetchTime < CACHE_DURATION) {
		return serviceCache;
	}

	try {
		const fresh = await getServiceCatalogFn({ data: { accessToken } });
		if (fresh.length > 0) {
			serviceCache = fresh;
			lastFetchTime = Date.now();
		}
	} catch {
		// Keep stale cache
	}

	return serviceCache;
}

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session) {
			throw redirect({ to: "/login" });
		}

		const services = await getServices(session.accessToken);
		return { session, services } as AuthenticatedContext;
	},
	shouldReload: false,
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

	useEffect(() => {
		const timeUntilExpiry = session.expiresAt - Date.now() / 1000;
		const refreshIn = Math.max((timeUntilExpiry - 300) * 1000, 0);

		const timer = setTimeout(async () => {
			const res = await fetch("/api/auth/refresh", { method: "POST" });
			if (res.ok) {
				window.location.reload();
			} else {
				window.location.href = "/login";
			}
		}, refreshIn);

		return () => clearTimeout(timer);
	}, [session.expiresAt]);

	return (
		<DashboardShell session={session} services={services}>
			<Outlet />
		</DashboardShell>
	);
}
