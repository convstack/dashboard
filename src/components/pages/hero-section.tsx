import type { HeroConfig, PageSection } from "@convstack/service-sdk/types";
import { Link } from "@tanstack/react-router";
import { DynamicIcon } from "~/components/layout/dynamic-icon";
import { Badge } from "~/components/ui/badge";

interface Props {
	section: PageSection;
	serviceSlug: string;
}

export function HeroSection({ section, serviceSlug }: Props) {
	const config = section.config as unknown as HeroConfig;

	return (
		<header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start sm:gap-6">
			{/* Avatar or icon */}
			{config.avatar && (
				<img
					src={config.avatar}
					alt=""
					className="h-16 w-16 shrink-0 rounded-full object-cover sm:h-24 sm:w-24"
				/>
			)}
			{!config.avatar && config.icon && (
				<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--accent)] sm:h-24 sm:w-24">
					<DynamicIcon name={config.icon} className="h-8 w-8 sm:h-12 sm:w-12" />
				</div>
			)}

			{/* Content */}
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<h1 className="text-2xl font-bold text-[var(--fg)] sm:text-3xl">
						{config.title}
					</h1>
					{config.badges?.map((badge) => (
						<Badge key={badge.label} value={badge} />
					))}
				</div>
				{config.subtitle && (
					<p className="mt-1 text-base text-[var(--fg-muted)]">
						{config.subtitle}
					</p>
				)}
				{config.metadata && config.metadata.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--fg-muted)]">
						{config.metadata.map((item, idx) => (
							<div key={item.label}>
								{idx > 0 && (
									<span className="mr-4 text-[var(--fg-subtle)]">·</span>
								)}
								<span className="text-[var(--fg-subtle)]">{item.label}:</span>{" "}
								<span className="text-[var(--fg)]">{item.value}</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Actions */}
			{config.actions && config.actions.length > 0 && (
				<div className="flex shrink-0 items-center gap-2">
					{config.actions
						.filter((action) => action.link)
						.map((action) => {
							const base =
								"rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors";
							const variant =
								action.variant === "primary"
									? "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
									: action.variant === "danger"
										? "border border-[var(--border)] text-[var(--danger)] hover:bg-[var(--danger-muted)]"
										: "border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--surface-2)]";
							return (
								<Link
									key={action.label}
									to="/$service/$"
									params={{
										service: serviceSlug,
										_splat: (action.link as string).replace(/^\//, ""),
									}}
									className={`${base} ${variant}`}
								>
									{action.label}
								</Link>
							);
						})}
				</div>
			)}
		</header>
	);
}
