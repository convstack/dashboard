import { createFileRoute } from "@tanstack/react-router";
import { WidgetRenderer } from "~/components/widgets/widget-renderer";

export const Route = createFileRoute("/_authenticated/home")({
	component: HomePage,
});

function HomePage() {
	const { session, services } = Route.useRouteContext();

	const activeServices = services.filter(
		(s) => s.uiManifest && s.status !== "inactive",
	);

	const allWidgets = activeServices.flatMap((service) =>
		(service.uiManifest?.widgets ?? []).map((widget) => ({
			widget,
			service,
		})),
	);

	return (
		<div>
			<h1 className="text-2xl font-bold">Dashboard</h1>
			<p className="mt-1 text-sm text-(--muted-foreground)">
				Welcome back, {session.user.name}.
			</p>

			{activeServices.length === 0 ? (
				<div className="mt-8 rounded-lg border border-dashed border-(--border) p-12 text-center">
					<p className="text-sm text-(--muted-foreground)">
						No services connected yet. Register a service in Lanyard to see it
						here.
					</p>
				</div>
			) : (
				<>
					{/* Service status overview */}
					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{activeServices.map((service) => (
							<div
								key={service.id}
								className="rounded-lg border border-(--border) bg-(--card) p-4"
							>
								<div className="flex items-center justify-between">
									<p className="text-sm font-medium">
										{service.uiManifest?.name || service.name}
									</p>
									<span
										className={`inline-flex h-2 w-2 rounded-full ${
											service.status === "active"
												? "bg-green-500"
												: service.status === "degraded"
													? "bg-yellow-500"
													: "bg-gray-400"
										}`}
									/>
								</div>
								<p className="mt-1 text-xs text-(--muted-foreground)">
									{service.status}
									{service.version && ` · v${service.version}`}
								</p>
							</div>
						))}
					</div>

					{/* Widget grid */}
					{allWidgets.length > 0 && (
						<div className="mt-8">
							<h2 className="text-lg font-semibold mb-4">Overview</h2>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{allWidgets.map(({ widget, service }) => (
									<div
										key={`${service.id}-${widget.id}`}
										className={
											widget.size === "full"
												? "col-span-full"
												: widget.size === "lg"
													? "sm:col-span-2"
													: ""
										}
									>
										<WidgetRenderer widget={widget} service={service} />
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
