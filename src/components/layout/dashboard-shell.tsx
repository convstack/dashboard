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
				{session.user.deletionPending && (
					<div className="bg-amber-50 border-b border-amber-200 px-8 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
						Your account is scheduled for deletion. You can cancel this request
						in{" "}
						<a
							href="/my-account/data-deletion"
							className="font-medium underline hover:no-underline"
						>
							My Account &rarr; Data &amp; Privacy
						</a>
						.
					</div>
				)}
				<div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
			</main>
		</div>
	);
}
