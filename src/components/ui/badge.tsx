import type { BadgeValue } from "@convstack/service-sdk/types";

interface Props {
	value: BadgeValue;
	size?: "sm" | "md";
}

const VARIANT_STYLES: Record<NonNullable<BadgeValue["variant"]>, string> = {
	default:
		"bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]",
	success:
		"bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/30",
	warning:
		"bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/30",
	danger:
		"bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/30",
	info: "bg-[var(--info-muted)] text-[var(--info)] border-[var(--info)]/30",
};

export function Badge({ value, size = "md" }: Props) {
	const variant = value.variant ?? "default";
	const style = VARIANT_STYLES[variant];
	const sizeClass =
		size === "sm" ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

	return (
		<span
			className={`inline-flex items-center rounded-[var(--radius-sm)] border font-medium ${sizeClass} ${style}`}
		>
			{value.label}
		</span>
	);
}
