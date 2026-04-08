import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SessionData } from "~/lib/auth";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { DynamicIcon } from "./dynamic-icon";

interface Props {
	session: SessionData;
	services: ServiceCatalogEntry[];
}

interface TreeNode {
	title: string;
	slug: string;
	children: TreeNode[];
}

function HealthDot({ status }: { status: string }) {
	if (status === "active") {
		return (
			<span className="h-1.5 w-1.5 rounded-full bg-green-500" title="Online" />
		);
	}
	if (status === "degraded") {
		return (
			<span
				className="h-1.5 w-1.5 rounded-full bg-yellow-500"
				title="Degraded"
			/>
		);
	}
	if (status === "inactive") {
		return (
			<span className="h-1.5 w-1.5 rounded-full bg-red-500" title="Offline" />
		);
	}
	if (status === "maintenance") {
		return (
			<span
				className="h-1.5 w-1.5 rounded-full bg-blue-500"
				title="Maintenance"
			/>
		);
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

	// Auto-expand if current page is this node or a descendant
	const isInActiveBranch = isActive || currentPath.startsWith(`${pagePath}/`);
	const hasActiveDescendant =
		hasChildren && containsPath(node.children, serviceSlug, currentPath);

	const [expanded, setExpanded] = useState(
		isInActiveBranch || hasActiveDescendant,
	);

	// Re-expand when navigation changes to a descendant
	useEffect(() => {
		if (isInActiveBranch || hasActiveDescendant) {
			setExpanded(true);
		}
	}, [isInActiveBranch, hasActiveDescendant]);

	return (
		<div>
			<div
				className="flex items-center"
				style={{ paddingLeft: `${depth * 12}px` }}
			>
				{hasChildren ? (
					<button
						type="button"
						onClick={() => setExpanded((prev) => !prev)}
						className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-(--sidebar-accent)"
					>
						<ChevronRight
							className={`h-3.5 w-3.5 text-(--muted-foreground) transition-transform ${expanded ? "rotate-90" : ""}`}
						/>
					</button>
				) : (
					<span className="w-6 shrink-0" />
				)}
				<Link
					to={pagePath}
					className={`flex-1 truncate rounded-md px-1.5 py-1 text-sm hover:bg-(--sidebar-accent) hover:text-(--sidebar-accent-foreground) ${isActive ? "bg-(--sidebar-accent) font-medium text-(--sidebar-accent-foreground)" : "text-(--sidebar-foreground)"}`}
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
		if (currentPath === pagePath || currentPath.startsWith(`${pagePath}/`)) {
			return true;
		}
		if (
			node.children.length > 0 &&
			containsPath(node.children, serviceSlug, currentPath)
		) {
			return true;
		}
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
			if (response.ok) {
				setTree(await response.json());
			}
		} catch {
			// Tree is best-effort
		}
		setLoaded(true);
	}, [serviceSlug, endpoint]);

	useEffect(() => {
		fetchTree();
	}, [fetchTree]);

	if (!loaded || tree.length === 0) return null;

	return (
		<div className="space-y-0.5">
			<div className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-(--muted-foreground)">
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
		</div>
	);
}

export function DynamicSidebar({ session, services }: Props) {
	const location = useLocation();

	// Check if we're inside a service that has its own sidebar
	const activeServiceWithSidebar = services.find(
		(s) =>
			s.uiManifest?.sidebar &&
			(location.pathname.startsWith(`/${s.slug}/`) ||
				location.pathname === `/${s.slug}`),
	);

	const svcManifest = activeServiceWithSidebar?.uiManifest;
	const svcSidebar = svcManifest?.sidebar;

	// Fetch user's permissions for the active service
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

	if (activeServiceWithSidebar && svcManifest && svcSidebar) {
		const svc = activeServiceWithSidebar;
		return (
			<aside className="w-64 border-r border-(--border) bg-(--sidebar-background) flex flex-col">
				<div className="p-5">
					<Link
						to="/home"
						className="flex items-center gap-2 text-sm text-(--muted-foreground) hover:text-(--foreground) transition-colors"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to Dashboard
					</Link>
					<div className="mt-3 flex items-center gap-2">
						<DynamicIcon name={svcManifest.icon ?? "box"} className="h-5 w-5" />
						<span className="text-lg font-bold tracking-tight">
							{svcManifest.name}
						</span>
					</div>
				</div>

				<nav className="flex-1 px-3 space-y-1 overflow-y-auto">
					{/* Static items at top — filtered by permission */}
					{(svcSidebar.items ?? []).filter(canSee).map((item) => (
						<NavLink
							key={item.path}
							to={`/${svc.slug}${item.path === "/" ? "" : item.path}`}
							label={item.label}
							icon={item.icon}
						/>
					))}

					{/* Dynamic tree */}
					{svcSidebar.tree && (
						<SidebarTree
							serviceSlug={svc.slug}
							endpoint={svcSidebar.tree.endpoint}
						/>
					)}

					{/* Footer items at bottom of nav — filtered by permission */}
					{(svcSidebar.footerItems ?? []).filter(canSee).length > 0 && (
						<div className="pt-3 border-t border-(--border) mt-3">
							{(svcSidebar.footerItems ?? []).filter(canSee).map((item) => (
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
			</aside>
		);
	}

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
					activeOptions={{ exact: true }}
					className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-accent) hover:text-(--sidebar-accent-foreground) [&.active]:bg-(--sidebar-accent) [&.active]:font-medium [&.active]:text-(--sidebar-accent-foreground)"
				>
					<LayoutDashboard className="h-4 w-4" />
					Home
				</Link>

				{/* Inline services (like Departments) — rendered as simple nav links under Home */}
				{services
					.filter(
						(s) =>
							s.uiManifest &&
							s.status !== "inactive" &&
							s.slug === "departments",
					)
					.flatMap((service) =>
						(service.uiManifest?.navigation ?? []).map((item) => (
							<NavLink
								key={`${service.slug}${item.path}`}
								to={`/${service.slug}${item.path === "/" ? "" : item.path}`}
								label={item.label}
								icon={item.icon}
							/>
						)),
					)}

				{/* Dynamic service sections — user services first, then admin */}
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
							{(session.user.name || session.user.email || "?")
								.split(" ")
								.map((w) => w[0])
								.join("")
								.toUpperCase()
								.slice(0, 2)}
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
