import type { CalloutConfig, PageSection } from "@convstack/service-sdk/types";
import { DynamicIcon } from "~/components/layout/dynamic-icon";

interface Props {
	section?: PageSection;
	config?: CalloutConfig;
}

const DEFAULT_ICONS: Record<CalloutConfig["variant"], string> = {
	info: "info",
	success: "check-circle",
	warning: "alert-triangle",
	danger: "octagon-x",
	tip: "lightbulb",
};

const VARIANT_STYLES: Record<
	CalloutConfig["variant"],
	{ bg: string; border: string; iconColor: string }
> = {
	info: {
		bg: "bg-[var(--info-muted)]",
		border: "border-[var(--info)]/30",
		iconColor: "text-[var(--info)]",
	},
	success: {
		bg: "bg-[var(--success-muted)]",
		border: "border-[var(--success)]/30",
		iconColor: "text-[var(--success)]",
	},
	warning: {
		bg: "bg-[var(--warning-muted)]",
		border: "border-[var(--warning)]/30",
		iconColor: "text-[var(--warning)]",
	},
	danger: {
		bg: "bg-[var(--danger-muted)]",
		border: "border-[var(--danger)]/30",
		iconColor: "text-[var(--danger)]",
	},
	tip: {
		bg: "bg-[var(--accent-muted)]",
		border: "border-[var(--accent)]/30",
		iconColor: "text-[var(--accent)]",
	},
};

export function CalloutSection({ section, config }: Props) {
	const resolved = config ?? (section?.config as unknown as CalloutConfig);
	if (!resolved) return null;

	const variant = resolved.variant;
	const styles = VARIANT_STYLES[variant];
	const icon = resolved.icon ?? DEFAULT_ICONS[variant];

	return (
		<aside
			className={`flex gap-3 rounded-[var(--radius-lg)] border px-4 py-3 ${styles.bg} ${styles.border}`}
			role="note"
		>
			<div className={`shrink-0 pt-0.5 ${styles.iconColor}`}>
				<DynamicIcon name={icon} className="h-5 w-5" />
			</div>
			<div className="min-w-0 flex-1">
				{resolved.title && (
					<p className="text-sm font-semibold text-[var(--fg)]">
						{resolved.title}
					</p>
				)}
				<p className="text-sm text-[var(--fg)] whitespace-pre-wrap">
					{resolved.body}
				</p>
			</div>
		</aside>
	);
}
