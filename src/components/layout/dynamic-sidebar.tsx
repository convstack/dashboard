import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SessionData } from "~/lib/auth";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { DynamicIcon } from "./dynamic-icon";

interface Props {
	session: SessionData;
	services: ServiceCatalogEntry[];
	mode?: "static" | "drawer";
}

interface TreeNode {
	title: string;
	slug: string;
	children: TreeNode[];
}

function HealthDot({ status }: { status: string }) {
	const map: Record<string, { color: string; label: string }> = {
		active: { color: "bg-[var(--success)]", label: "Online" },
		degraded: { color: "bg-[var(--warning)]", label: "Degraded" },
		inactive: { color: "bg-[var(--danger)]", label: "Offline" },
		maintenance: { color: "bg-[var(--info)]", label: "Maintenance" },
	};
	const entry = map[status];
	if (!entry) return null;
	return (
		<span
			className={`h-1.5 w-1.5 rounded-full ${entry.color}`}
			title={entry.label}
		/>
	);
}

function PrimaryActionButton({
	serviceSlug,
	label,
	icon,
	link,
}: {
	serviceSlug: string;
	label: string;
	icon?: string;
	link: string;
}) {
	return (
		<Link
			to="/$service/$"
			params={{ service: serviceSlug, _splat: link.replace(/^\//, "") }}
			className="mx-4 mb-3 flex items-center justify-center gap-2 rounded-(--radius) bg-(--accent) px-3 py-2 text-sm font-semibold text-(--accent-fg) shadow-(--shadow-1) transition-colors hover:bg-(--accent-hover)"
		>
			{icon && <DynamicIcon name={icon} className="h-4 w-4" />}
			{label}
		</Link>
	);
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
			className="flex items-center gap-2 rounded-(--radius) px-2.5 py-2.5 text-sm text-(--fg-muted) transition-colors hover:bg-(--surface-2) hover:text-(--fg) lg:py-1.5 [&.active]:bg-(--accent-muted) [&.active]:font-medium [&.active]:text-(--fg)"
		>
			{icon && <DynamicIcon name={icon} className="h-4 w-4" />}
			{label}
		</Link>
	);
}

function SidebarTreeNode({
	node,
	serviceSlug,
	currentPath,
	depth,
}: {
	node: TreeNode;
	serviceSlug: string;
	currentPath: string;
	depth: number;
}) {
	const pagePath = `/${serviceSlug}/pages/${node.slug}`;
	const isActive = currentPath === pagePath;
	const hasChildren = node.children.length > 0;

	const isInActiveBranch = isActive || currentPath.startsWith(`${pagePath}/`);
	const hasActiveDescendant =
		hasChildren && containsPath(node.children, serviceSlug, currentPath);

	const [expanded, setExpanded] = useState(
		isInActiveBranch || hasActiveDescendant,
	);

	useEffect(() => {
		if (isInActiveBranch || hasActiveDescendant) {
			setExpanded(true);
		}
	}, [isInActiveBranch, hasActiveDescendant]);

	return (
		<div>
			{/* Tree indent: depth × 12px (3 spacing units) */}
			<div
				className="flex items-center ps-[calc(var(--tree-depth)*12px)]"
				style={{ "--tree-depth": depth } as React.CSSProperties}
			>
				{hasChildren ? (
					<button
						type="button"
						onClick={() => setExpanded((p) => !p)}
						aria-label={
							expanded ? `Collapse ${node.title}` : `Expand ${node.title}`
						}
						aria-expanded={expanded}
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-(--surface-2) lg:h-6 lg:w-6"
					>
						<ChevronRight
							className={`h-3.5 w-3.5 text-(--fg-subtle) transition-transform ${expanded ? "rotate-90" : ""}`}
						/>
					</button>
				) : (
					<span className="w-6 shrink-0" />
				)}
				<Link
					to={pagePath}
					className={`flex-1 truncate rounded-sm px-1.5 py-2.5 text-sm transition-colors hover:bg-(--surface-2) hover:text-(--fg) lg:py-1 ${
						isActive
							? "bg-(--accent-muted) font-medium text-(--fg)"
							: "text-(--fg-muted)"
					}`}
				>
					{node.title}
				</Link>
			</div>
			{hasChildren && expanded && (
				<div>
					{node.children.map((child) => (
						<SidebarTreeNode
							key={child.slug}
							node={child}
							serviceSlug={serviceSlug}
							currentPath={currentPath}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function containsPath(
	nodes: TreeNode[],
	serviceSlug: string,
	currentPath: string,
): boolean {
	for (const node of nodes) {
		const pagePath = `/${serviceSlug}/pages/${node.slug}`;
		if (currentPath === pagePath || currentPath.startsWith(`${pagePath}/`))
			return true;
		if (
			node.children.length > 0 &&
			containsPath(node.children, serviceSlug, currentPath)
		)
			return true;
	}
	return false;
}

function SidebarTree({
	serviceSlug,
	endpoint,
}: {
	serviceSlug: string;
	endpoint: string;
}) {
	const location = useLocation();
	const [tree, setTree] = useState<TreeNode[]>([]);
	const [loaded, setLoaded] = useState(false);

	const fetchTree = useCallback(async () => {
		try {
			const response = await fetch(`/api/proxy/${serviceSlug}${endpoint}`);
			if (response.ok) setTree(await response.json());
		} catch {
			// best effort
		}
		setLoaded(true);
	}, [serviceSlug, endpoint]);

	useEffect(() => {
		fetchTree();
	}, [fetchTree]);

	if (!loaded || tree.length === 0) return null;

	return (
		<div className="space-y-0.5">
			<div className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-(--fg-subtle)">
				Pages
			</div>
			{tree.map((node) => (
				<SidebarTreeNode
					key={node.slug}
					node={node}
					serviceSlug={serviceSlug}
					currentPath={location.pathname}
					depth={0}
				/>
			))}
		</div>
	);
}

function UserInfo({ session }: { session: SessionData }) {
	const initials = (session.user.name || session.user.email || "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<div className="border-t border-(--border) p-4">
			<div className="flex items-center gap-3 rounded-(--radius) px-2 py-2">
				{session.user.image ? (
					<img
						src={session.user.image}
						alt=""
						className="h-8 w-8 rounded-full object-cover"
					/>
				) : (
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--accent) text-xs font-medium text-(--accent-fg)">
						{initials}
					</div>
				)}
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium text-(--fg)">
						{session.user.name}
					</p>
					<p className="truncate text-xs text-(--fg-muted)">
						{session.user.email}
					</p>
				</div>
			</div>
			<Link
				to="/logout"
				className="mt-1 flex w-full items-center gap-2 rounded-(--radius) px-2 py-2.5 text-left text-sm text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) lg:py-1.5"
			>
				<LogOut className="h-4 w-4" />
				Sign out
			</Link>
		</div>
	);
}

function SidebarContent({ session, services }: Omit<Props, "mode">) {
	const location = useLocation();

	const activeServiceWithSidebar = services.find(
		(s) =>
			s.uiManifest?.sidebar &&
			(location.pathname.startsWith(`/${s.slug}/`) ||
				location.pathname === `/${s.slug}`),
	);

	const svcManifest = activeServiceWithSidebar?.uiManifest;
	const svcSidebar = svcManifest?.sidebar;

	const [userPermissions, setUserPermissions] = useState<string[]>([]);
	const activeSlug = activeServiceWithSidebar?.slug;
	useEffect(() => {
		if (!activeSlug) return;
		fetch(`/api/permissions/${activeSlug}`)
			.then((res) => (res.ok ? res.json() : { permissions: [] }))
			.then((data) => setUserPermissions(data.permissions ?? []))
			.catch(() => setUserPermissions([]));
	}, [activeSlug]);

	const canSee = (item: { requiredPermission?: string }) => {
		if (!item.requiredPermission) return true;
		return userPermissions.includes(item.requiredPermission);
	};

	// Role-based visibility: coordinator = any admin/owner org role; convention-admin = global admin.
	const isCoordinator =
		session.user.orgRoles?.some(
			(r) => r.role === "admin" || r.role === "owner",
		) ?? false;
	const isConventionAdmin = session.user.role === "admin";

	const itemVisible = (item: {
		showWhen?: "coordinator" | "convention-admin";
	}): boolean => {
		if (!item.showWhen) return true;
		if (item.showWhen === "coordinator") return isCoordinator;
		if (item.showWhen === "convention-admin") return isConventionAdmin;
		return true;
	};

	if (activeServiceWithSidebar && svcManifest && svcSidebar) {
		const svc = activeServiceWithSidebar;
		return (
			<div className="flex h-full flex-col">
				{/* Service-name header lives in the global TopBar — sidebar leads
				    directly with the primary action so it stays distraction-free. */}
				<div className="pt-4" />

				{svcSidebar.primaryAction && (
					<PrimaryActionButton
						serviceSlug={svc.slug}
						label={svcSidebar.primaryAction.label}
						icon={svcSidebar.primaryAction.icon}
						link={svcSidebar.primaryAction.link}
					/>
				)}

				<nav className="flex-1 space-y-0.5 overflow-y-auto px-4">
					{(svcSidebar.items ?? [])
						.filter(itemVisible)
						.filter(canSee)
						.map((item) => (
							<NavLink
								key={item.path}
								to={`/${svc.slug}${item.path === "/" ? "" : item.path}`}
								label={item.label}
								icon={item.icon}
							/>
						))}

					{svcSidebar.tree && (
						<SidebarTree
							serviceSlug={svc.slug}
							endpoint={svcSidebar.tree.endpoint}
						/>
					)}

					{(svcSidebar.footerItems ?? []).filter(itemVisible).filter(canSee)
						.length > 0 && (
						<div className="mt-3 border-t border-(--border) pt-3">
							{(svcSidebar.footerItems ?? [])
								.filter(itemVisible)
								.filter(canSee)
								.map((item) => (
									<NavLink
										key={item.path}
										to={`/${svc.slug}${item.path === "/" ? "" : item.path}`}
										label={item.label}
										icon={item.icon}
									/>
								))}
						</div>
					)}
				</nav>

				<UserInfo session={session} />
			</div>
		);
	}

	// Global (non-service) sidebar mode
	return (
		<div className="flex h-full flex-col">
			<div className="px-4 pt-5 pb-3">
				<Link
					to="/home"
					className="text-base font-semibold tracking-tight text-(--fg)"
				>
					Dashboard
				</Link>
			</div>

			<nav className="flex-1 space-y-0.5 overflow-y-auto px-4">
				<Link
					to="/home"
					activeOptions={{ exact: true }}
					className="flex items-center gap-2 rounded-(--radius) px-2.5 py-2.5 text-sm text-(--fg-muted) transition-colors hover:bg-(--surface-2) hover:text-(--fg) lg:py-1.5 [&.active]:bg-(--accent-muted) [&.active]:font-medium [&.active]:text-(--fg)"
				>
					<LayoutDashboard className="h-4 w-4" />
					Home
				</Link>

				{/* Inline services (like Departments) */}
				{services
					.filter(
						(s) =>
							s.uiManifest &&
							s.status !== "inactive" &&
							s.slug === "departments",
					)
					.flatMap((service) =>
						(service.uiManifest?.navigation ?? [])
							.filter(itemVisible)
							.map((item) => (
								<NavLink
									key={`${service.slug}${item.path}`}
									to={`/${service.slug}${item.path === "/" ? "" : item.path}`}
									label={item.label}
									icon={item.icon}
								/>
							)),
					)}

				{/* Dynamic service sections */}
				{services
					.filter(
						(s) =>
							s.uiManifest &&
							s.status !== "inactive" &&
							s.slug !== "departments",
					)
					.sort((a, b) => {
						if (a.type === "user" && b.type !== "user") return -1;
						if (a.type !== "user" && b.type === "user") return 1;
						return 0;
					})
					.map((service) => (
						<div key={service.id}>
							<div className="flex items-center gap-1.5 px-2 pt-4 pb-1.5 text-xs font-semibold uppercase tracking-wider text-(--fg-subtle)">
								<DynamicIcon
									name={service.uiManifest?.icon ?? "box"}
									className="h-3.5 w-3.5"
								/>
								{service.uiManifest?.name}
								<HealthDot status={service.status} />
							</div>
							{service.uiManifest?.navigation.filter(itemVisible).map((item) =>
								item.href ? (
									<a
										key={item.path}
										href={item.href}
										className="flex items-center gap-2 rounded-(--radius) px-2.5 py-2.5 text-sm text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) lg:py-1.5"
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

			<UserInfo session={session} />
		</div>
	);
}

export function DynamicSidebar({ session, services, mode = "static" }: Props) {
	if (mode === "drawer") {
		// Drawer wraps this content in its own <aside>; return the raw content.
		return <SidebarContent session={session} services={services} />;
	}

	return (
		<aside className="flex w-[260px] flex-col border-r border-[var(--border)] bg-[var(--surface-1)]">
			<SidebarContent session={session} services={services} />
		</aside>
	);
}
