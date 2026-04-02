import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import type { SessionData } from "~/lib/auth";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { DynamicIcon } from "./dynamic-icon";

interface Props {
	session: SessionData;
	services: ServiceCatalogEntry[];
}

function HealthDot({ status }: { status: string }) {
	if (status === "active") {
		return <span className="h-1.5 w-1.5 rounded-full bg-green-500" />;
	}
	if (status === "degraded") {
		return <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />;
	}
	return null;
}

function NavLink({
	to,
	label,
	icon,
}: {
	to: string;
	label: string;
	icon?: string;
}) {
	return (
		<Link
			to={to}
			activeOptions={{ exact: true }}
			className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-accent) hover:text-(--sidebar-accent-foreground) [&.active]:bg-(--sidebar-accent) [&.active]:font-medium [&.active]:text-(--sidebar-accent-foreground)"
		>
			{icon && <DynamicIcon name={icon} className="h-4 w-4" />}
			{label}
		</Link>
	);
}

export function DynamicSidebar({ session, services }: Props) {
	const initials = (session.user.name || session.user.email || "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<aside className="w-64 border-r border-(--border) bg-(--sidebar-background) flex flex-col">
			<div className="p-5">
				<Link to="/home" className="text-lg font-bold tracking-tight">
					Dashboard
				</Link>
			</div>

			<nav className="flex-1 px-3 space-y-1 overflow-y-auto">
				<Link
					to="/home"
					className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-accent) hover:text-(--sidebar-accent-foreground) [&.active]:bg-(--sidebar-accent) [&.active]:font-medium [&.active]:text-(--sidebar-accent-foreground)"
				>
					<LayoutDashboard className="h-4 w-4" />
					Home
				</Link>

				{/* Dynamic service sections */}
				{services
					.filter((s) => s.uiManifest && s.status !== "inactive")
					.map((service) => (
						<div key={service.id}>
							<div className="flex items-center gap-1.5 px-2 pt-4 pb-1.5 text-xs font-semibold uppercase tracking-wider text-(--muted-foreground)">
								<DynamicIcon
									name={service.uiManifest?.icon ?? "box"}
									className="h-3.5 w-3.5"
								/>
								{service.uiManifest?.name}
								<HealthDot status={service.status} />
							</div>
							{service.uiManifest?.navigation.map((item) =>
								item.href ? (
									<a
										key={item.path}
										href={item.href}
										className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-accent) hover:text-(--sidebar-accent-foreground)"
									>
										<DynamicIcon name={item.icon} className="h-4 w-4" />
										{item.label}
									</a>
								) : (
									<NavLink
										key={item.path}
										to={`/${service.slug}${item.path}`}
										label={item.label}
										icon={item.icon}
									/>
								),
							)}
						</div>
					))}
			</nav>

			<div className="border-t border-(--border) p-3">
				<div className="flex items-center gap-3 rounded-md px-2 py-2">
					{session.user.image ? (
						<img
							src={session.user.image}
							alt=""
							className="h-8 w-8 rounded-full object-cover"
						/>
					) : (
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--primary) text-xs font-medium text-(--primary-foreground)">
							{initials}
						</div>
					)}
					<div className="flex-1 min-w-0">
						<p className="truncate text-sm font-medium">{session.user.name}</p>
						<p className="truncate text-xs text-(--muted-foreground)">
							{session.user.email}
						</p>
					</div>
				</div>
				<Link
					to="/logout"
					className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-sm text-(--muted-foreground) hover:bg-(--accent) hover:text-(--foreground)"
				>
					Sign out
				</Link>
			</div>
		</aside>
	);
}
