import { createFileRoute, Link } from "@tanstack/react-router";
import { AppsEmptyState } from "~/components/layout/apps-empty-state";
import { DynamicIcon } from "~/components/layout/dynamic-icon";

export const Route = createFileRoute("/_authenticated/home")({
	component: HomePage,
});

function HomePage() {
	const { session, services, servicesUnavailable } = Route.useRouteContext();

	// Filter out Lanyard's own services — they're admin/account tools, not "apps"
	const appServices = services.filter(
		(s) =>
			s.uiManifest &&
			s.status !== "inactive" &&
			s.slug !== "lanyard-admin" &&
			s.slug !== "my-account",
	);

	return (
		<div>
			<h1 className="text-2xl font-bold">Dashboard</h1>
			<p className="mt-1 text-sm text-(--muted-foreground)">
				Welcome back, {session.user.name || session.user.email}.
			</p>

			{appServices.length === 0 ? (
				<AppsEmptyState unavailable={servicesUnavailable} />
			) : (
				<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{appServices.map((service) => (
						<Link
							key={service.id}
							to="/$service"
							params={{ service: service.slug }}
							className="group rounded-lg border border-(--border) bg-(--card) p-6 hover:border-(--primary) hover:shadow-sm transition-all"
						>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--primary) text-(--primary-foreground)">
									<DynamicIcon
										name={service.uiManifest?.icon ?? "box"}
										className="h-5 w-5"
									/>
								</div>
								<div>
									<p className="font-medium group-hover:text-(--primary) transition-colors">
										{service.uiManifest?.name || service.name}
									</p>
									{service.description && (
										<p className="text-xs text-(--muted-foreground)">
											{service.description}
										</p>
									)}
								</div>
							</div>
							<div className="mt-3 flex items-center gap-2 text-xs text-(--muted-foreground)">
								<span
									className={`inline-flex h-1.5 w-1.5 rounded-full ${
										service.status === "active"
											? "bg-green-500"
											: service.status === "degraded"
												? "bg-yellow-500"
												: "bg-gray-400"
									}`}
								/>
								{service.status}
								{service.version && ` · v${service.version}`}
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
