import type { PageSection, StatsRowConfig } from "@convstack/service-sdk/types";
import { ArrowDown, ArrowUp } from "lucide-react";
import { DynamicIcon } from "~/components/layout/dynamic-icon";
import { Sparkline } from "~/components/ui/sparkline";

interface StatItem {
	key: string;
	label: string;
	value: string | number;
	delta?: { value: number; positive?: boolean };
	sparkline?: number[];
	variant?: "default" | "success" | "warning" | "danger";
	icon?: string;
}

interface StatsRowData {
	stats: StatItem[];
}

interface Props {
	section: PageSection;
	data: StatsRowData | null;
}

const VARIANT_ACCENT: Record<NonNullable<StatItem["variant"]>, string> = {
	default: "var(--accent)",
	success: "var(--success)",
	warning: "var(--warning)",
	danger: "var(--danger)",
};

function formatValue(value: string | number): string {
	if (typeof value === "number") {
		return new Intl.NumberFormat().format(value);
	}
	return value;
}

export function StatsRowSection({ section, data }: Props) {
	const config = section.config as unknown as StatsRowConfig;

	if (!data) {
		return (
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-24 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)]"
					/>
				))}
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{config.title && (
				<h2 className="text-sm font-semibold text-[var(--fg)]">
					{config.title}
				</h2>
			)}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{data.stats.map((stat) => {
					const variant = stat.variant ?? "default";
					const accentColor = VARIANT_ACCENT[variant];
					return (
						<div
							key={stat.key}
							className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-4"
						>
							<div className="flex items-center gap-2">
								{stat.icon && (
									<DynamicIcon
										name={stat.icon}
										className="h-4 w-4 text-[var(--fg-subtle)]"
									/>
								)}
								<p className="text-xs font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
									{stat.label}
								</p>
							</div>
							<div className="mt-2 flex items-end justify-between gap-3">
								<div className="min-w-0 flex-1">
									<p className="truncate text-2xl font-bold text-[var(--fg)]">
										{formatValue(stat.value)}
									</p>
									{stat.delta && (
										<p
											className={`mt-1 flex items-center gap-0.5 text-xs font-medium ${
												stat.delta.positive
													? "text-[var(--success)]"
													: "text-[var(--danger)]"
											}`}
										>
											{stat.delta.positive ? (
												<ArrowUp className="h-3 w-3" />
											) : (
												<ArrowDown className="h-3 w-3" />
											)}
											{Math.abs(stat.delta.value)}%
										</p>
									)}
								</div>
								{stat.sparkline && stat.sparkline.length >= 2 && (
									<Sparkline data={stat.sparkline} color={accentColor} />
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
