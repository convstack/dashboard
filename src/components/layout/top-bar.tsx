import type { TopBarContribution } from "@convstack/service-sdk/types";
import { Link, useRouter } from "@tanstack/react-router";
import {
	ChevronRight,
	LayoutDashboard,
	Menu,
	MoreHorizontal,
	Share2,
	Star,
} from "lucide-react";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { useTopBarContext } from "~/lib/use-topbar-context";
import { DynamicIcon } from "./dynamic-icon";

interface Props {
	activeService: ServiceCatalogEntry | null;
	onHamburgerClick: () => void;
}

interface PendingAction {
	action: NonNullable<TopBarContribution["actions"]>[number];
}

export function TopBar({ activeService, onHamburgerClick }: Props) {
	const router = useRouter();
	const { envelope } = useTopBarContext();
	const [pending, setPending] = useState<PendingAction | null>(null);

	const breadcrumbs = envelope?.breadcrumbs ?? [];
	const actions = envelope?.actions ?? [];
	const universal = envelope?.universal ?? [];

	const executeAction = useCallback(
		async (action: NonNullable<TopBarContribution["actions"]>[number]) => {
			if (action.link) {
				const path = action.link.replace(/^\//, "");
				if (activeService) {
					router.navigate({
						to: "/$service/$",
						params: { service: activeService.slug, _splat: path },
					});
				}
				return;
			}
			if (action.endpoint && activeService) {
				await fetch(`/api/proxy/${activeService.slug}${action.endpoint}`, {
					method: action.method ?? "POST",
				});
				router.invalidate();
			}
		},
		[activeService, router],
	);

	return (
		<header className="sticky top-0 z-30 flex h-13 items-center gap-3 border-b border-(--border) bg-(--surface-1)/95 px-4 backdrop-blur">
			{/* Hamburger — mobile only */}
			<button
				type="button"
				onClick={onHamburgerClick}
				aria-label="Open navigation"
				className="flex h-11 w-11 items-center justify-center rounded-(--radius) text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) lg:hidden lg:h-9 lg:w-9"
			>
				<Menu className="h-5 w-5" />
			</button>

			{/* Back to Dashboard — visible only when inside a service */}
			{activeService && (
				<Link
					to="/home"
					aria-label="Back to Dashboard"
					title="Back to Dashboard"
					className="flex h-11 w-11 items-center justify-center rounded-(--radius) text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) lg:h-9 lg:w-9"
				>
					<LayoutDashboard className="h-4 w-4" />
				</Link>
			)}

			{/* Service header — hidden on mobile (avoids duplication with breadcrumbs) */}
			{activeService?.uiManifest && (
				<Link
					to="/$service/$"
					params={{ service: activeService.slug, _splat: "" }}
					className="hidden items-center gap-2 rounded-sm px-1.5 py-0.5 text-sm font-semibold text-(--fg) hover:bg-(--surface-2) lg:flex"
				>
					<DynamicIcon
						name={activeService.uiManifest.icon}
						className="h-4 w-4"
					/>
					<span>{activeService.uiManifest.name}</span>
				</Link>
			)}

			{/* Breadcrumbs */}
			{breadcrumbs.length > 0 && (
				<nav
					aria-label="Breadcrumb"
					className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm"
				>
					{breadcrumbs.map((crumb, idx) => {
						const isLast = idx === breadcrumbs.length - 1;
						const key = `${crumb.label}-${idx}`;
						return (
							<div key={key} className="flex shrink-0 items-center gap-1">
								{idx > 0 && (
									<ChevronRight className="h-3.5 w-3.5 text-(--fg-subtle)" />
								)}
								{crumb.href && !isLast && activeService ? (
									<Link
										to="/$service/$"
										params={{
											service: activeService.slug,
											_splat: crumb.href.replace(/^\//, ""),
										}}
										className="rounded-sm px-1.5 py-0.5 text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg)"
									>
										{crumb.label}
									</Link>
								) : (
									<span
										className={`px-1.5 py-0.5 ${isLast ? "font-medium text-(--fg)" : "text-(--fg-muted)"}`}
									>
										{crumb.label}
									</span>
								)}
							</div>
						);
					})}
				</nav>
			)}
			{breadcrumbs.length === 0 && <div className="flex-1" />}

			{/* Universal affordances */}
			<div className="flex items-center gap-1">
				{universal.includes("star") && (
					<button
						type="button"
						aria-label="Star"
						className="flex h-11 w-11 items-center justify-center rounded-(--radius) text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) lg:h-9 lg:w-9"
					>
						<Star className="h-4 w-4" />
					</button>
				)}
				{universal.includes("share") && (
					<button
						type="button"
						aria-label="Share"
						className="flex h-11 w-11 items-center justify-center rounded-(--radius) text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) lg:h-9 lg:w-9"
					>
						<Share2 className="h-4 w-4" />
					</button>
				)}
				{universal.includes("more") && (
					<button
						type="button"
						aria-label="More"
						className="flex h-11 w-11 items-center justify-center rounded-(--radius) text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) lg:h-9 lg:w-9"
					>
						<MoreHorizontal className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* Contextual actions */}
			{actions.length > 0 && (
				<div className="flex items-center gap-2 border-l border-(--border) pl-3">
					{actions.map((action) => {
						const base =
							"flex h-9 items-center gap-1.5 rounded-[var(--radius)] px-3 text-sm font-medium transition-colors";
						const variant =
							action.variant === "primary"
								? "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
								: action.variant === "danger"
									? "text-[var(--danger)] hover:bg-[var(--danger-muted)]"
									: "text-[var(--fg)] hover:bg-[var(--surface-2)]";
						return (
							<button
								key={action.id}
								type="button"
								onClick={() => {
									if (action.confirm) {
										setPending({ action });
									} else {
										executeAction(action);
									}
								}}
								className={`${base} ${variant}`}
							>
								{action.icon && (
									<DynamicIcon name={action.icon} className="h-4 w-4" />
								)}
								<span className="hidden sm:inline">{action.label}</span>
							</button>
						);
					})}
				</div>
			)}

			{pending && (
				<ConfirmDialog
					open={true}
					title="Confirm"
					message={pending.action.confirm ?? "Are you sure?"}
					variant={pending.action.variant === "danger" ? "danger" : "default"}
					onConfirm={() => {
						const { action } = pending;
						setPending(null);
						executeAction(action);
					}}
					onCancel={() => setPending(null)}
				/>
			)}
		</header>
	);
}
