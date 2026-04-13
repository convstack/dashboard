import type {
	EmptyStateConfig,
	PageSection,
} from "@convstack/service-sdk/types";
import { Link, useRouter } from "@tanstack/react-router";
import { DynamicIcon } from "~/components/layout/dynamic-icon";

interface Props {
	section?: PageSection;
	config?: EmptyStateConfig;
	serviceSlug?: string;
}

/**
 * Resolve the effective config. If called as a top-level section, `section`
 * is provided and we read from `section.config`. If called as a fallback from
 * another section type, `config` is provided directly.
 */
function resolveConfig(
	section?: PageSection,
	config?: EmptyStateConfig,
): EmptyStateConfig {
	if (config) return config;
	if (section) return section.config as unknown as EmptyStateConfig;
	return {};
}

export function EmptyStateSection({ section, config, serviceSlug }: Props) {
	const router = useRouter();
	const resolved = resolveConfig(section, config);

	const icon = resolved.icon ?? "inbox";
	const title = resolved.title ?? "No items yet";
	const description = resolved.description;
	const action = resolved.action;

	const handleAction = async () => {
		if (!action) return;
		if (action.link && serviceSlug) {
			const path = action.link.replace(/^\//, "");
			router.navigate({
				to: "/$service/$",
				params: { service: serviceSlug, _splat: path },
			});
			return;
		}
		if (action.endpoint && serviceSlug) {
			await fetch(`/api/proxy/${serviceSlug}${action.endpoint}`, {
				method: action.method ?? "POST",
			});
			router.invalidate();
		}
	};

	return (
		<div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] px-6 py-12 text-center">
			<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--fg-muted)]">
				<DynamicIcon name={icon} className="h-6 w-6" />
			</div>
			<h3 className="text-lg font-semibold text-[var(--fg)]">{title}</h3>
			{description && (
				<p className="max-w-sm text-sm text-[var(--fg-muted)]">{description}</p>
			)}
			{action &&
				serviceSlug &&
				(action.link ? (
					<Link
						to="/$service/$"
						params={{
							service: serviceSlug,
							_splat: action.link.replace(/^\//, ""),
						}}
						className="mt-2 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
					>
						{action.label}
					</Link>
				) : (
					<button
						type="button"
						onClick={handleAction}
						className="mt-2 rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
					>
						{action.label}
					</button>
				))}
		</div>
	);
}
