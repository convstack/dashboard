import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { DashboardShell } from "~/components/layout/dashboard-shell";
import { computeRefreshDelayMs } from "~/lib/refresh-timing";
import type { ClientSession } from "~/lib/session-view";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { getSessionFn } from "~/server/functions/auth";
import { getServiceCatalogFn } from "~/server/functions/catalog";

export interface AuthenticatedContext {
	session: ClientSession;
	services: ServiceCatalogEntry[];
	servicesUnavailable: boolean;
}

interface ServiceList {
	services: ServiceCatalogEntry[];
	unavailable: boolean;
}

// Module-level cache that survives across all router operations
let serviceCache: ServiceCatalogEntry[] = [];
let lastFetchTime = 0;
let cachedForUser = "";
const CACHE_DURATION = 30_000; // 30 seconds

async function getServices(userId: string): Promise<ServiceList> {
	// the server renders for every user, so only the browser reuses a list
	if (typeof window === "undefined") {
		try {
			return { services: await getServiceCatalogFn(), unavailable: false };
		} catch {
			return { services: [], unavailable: true };
		}
	}

	// Invalidate cache if user changed
	if (cachedForUser && cachedForUser !== userId) {
		serviceCache = [];
		lastFetchTime = 0;
	}

	// Return cache if fresh
	if (Date.now() - lastFetchTime < CACHE_DURATION) {
		return { services: serviceCache, unavailable: false };
	}

	try {
		// an empty answer counts too: a refused session must lose its old list
		serviceCache = await getServiceCatalogFn();
		lastFetchTime = Date.now();
		cachedForUser = userId;
	} catch {
		// Keep stale cache
		return { services: serviceCache, unavailable: serviceCache.length === 0 };
	}

	return { services: serviceCache, unavailable: false };
}

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const session = await getSessionFn();
		if (!session) {
			throw redirect({ to: "/login" });
		}

		const { services, unavailable } = await getServices(session.user.id);
		return {
			session,
			services,
			servicesUnavailable: unavailable,
		} as AuthenticatedContext;
	},
	shouldReload: true,
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
	const { session, services, servicesUnavailable } = Route.useRouteContext();

	useEffect(() => {
		const timeUntilExpiry = session.expiresAt - Date.now() / 1000;
		const refreshIn = computeRefreshDelayMs(timeUntilExpiry);

		const timer = setTimeout(async () => {
			const res = await fetch("/api/auth/refresh", { method: "POST" });
			if (!res.ok) {
				window.location.href = "/login";
				return;
			}
			const data = await res.json().catch(() => ({}));
			if (data.refreshed) {
				window.location.reload();
			}
		}, refreshIn);

		return () => clearTimeout(timer);
	}, [session.expiresAt]);

	return (
		<DashboardShell
			session={session}
			services={services}
			servicesUnavailable={servicesUnavailable}
		>
			<Outlet />
		</DashboardShell>
	);
}
