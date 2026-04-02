import type { ReactNode } from "react";
import type { SessionData } from "~/lib/auth";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { DynamicSidebar } from "./dynamic-sidebar";

interface Props {
	session: SessionData;
	services: ServiceCatalogEntry[];
	children: ReactNode;
}

export function DashboardShell({ session, services, children }: Props) {
	return (
		<div className="min-h-screen flex">
			<DynamicSidebar session={session} services={services} />
			<main className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
			</main>
		</div>
	);
}
