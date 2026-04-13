import { useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import type { SessionData } from "~/lib/auth";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { TopBarProvider } from "~/lib/use-topbar-context";
import { DynamicSidebar } from "./dynamic-sidebar";
import { MobileDrawer } from "./mobile-drawer";
import { TopBar } from "./top-bar";

interface Props {
	session: SessionData;
	services: ServiceCatalogEntry[];
	children: ReactNode;
}

/**
 * Find the active service for the current URL. A service is "active" when the
 * URL is inside its routes (e.g. /guidebook/* → guidebook). The global /home
 * and other non-service routes return null.
 */
function findActiveService(
	location: { pathname: string },
	services: ServiceCatalogEntry[],
): ServiceCatalogEntry | null {
	return (
		services.find(
			(s) =>
				s.uiManifest &&
				(location.pathname === `/${s.slug}` ||
					location.pathname.startsWith(`/${s.slug}/`)),
		) ?? null
	);
}

export function DashboardShell({ session, services, children }: Props) {
	const location = useLocation();
	const [drawerOpen, setDrawerOpen] = useState(false);

	const activeService = findActiveService(location, services);
	const accent = activeService?.uiManifest?.accentColor;

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value
	useEffect(() => {
		setDrawerOpen(false);
	}, [location.pathname]);

	const accentStyle = accent
		? ({
				"--accent": accent,
				"--accent-hover": `color-mix(in oklch, ${accent} 75%, white)`,
				"--accent-muted": `color-mix(in oklch, ${accent} 14%, var(--bg))`,
				"--accent-glow": `color-mix(in oklch, ${accent} 24%, transparent)`,
				"--accent-fg": `oklch(from ${accent} clamp(0, (0.62 - l) * 1000, 1) 0 0)`,
				"--focus-ring": accent,
			} as React.CSSProperties)
		: undefined;

	return (
		<TopBarProvider>
			{/* h-screen (not min-h-screen) so the inner main element actually
			    scrolls instead of letting the body scroll. Without this, sticky
			    elements inside main don't work because main never becomes a
			    real scroll container. */}
			<div
				className="flex h-screen flex-col bg-(--bg) text-(--fg)"
				style={accentStyle}
			>
				{/* Global deletion warning banner */}
				{session.user.deletionPending && (
					<div className="border-b border-(--warning-muted) bg-(--warning-muted) px-6 py-2.5 text-sm text-(--fg)">
						Your account is scheduled for deletion. You can cancel this request
						in{" "}
						<a
							href="/my-account/data-deletion"
							className="font-medium text-(--accent) underline hover:no-underline"
						>
							My Account → Data &amp; Privacy
						</a>
						.
					</div>
				)}

				{/* Global top bar */}
				<TopBar
					activeService={activeService}
					onHamburgerClick={() => setDrawerOpen(true)}
				/>

				<div className="flex flex-1 min-h-0 overflow-hidden">
					{/* Desktop sidebar */}
					<div className="hidden lg:flex lg:w-65 lg:shrink-0">
						<DynamicSidebar
							session={session}
							services={services}
							mode="static"
						/>
					</div>

					{/* Mobile drawer sidebar */}
					<MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
						<DynamicSidebar
							session={session}
							services={services}
							mode="drawer"
						/>
					</MobileDrawer>

					<main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 lg:px-8 lg:py-10">
						{children}
					</main>
				</div>
			</div>
		</TopBarProvider>
	);
}
