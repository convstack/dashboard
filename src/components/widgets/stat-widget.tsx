import type { WidgetDefinition } from "@convstack/service-sdk/types";

interface StatData {
	value: string | number;
	change?: number;
	changeLabel?: string;
}

interface Props {
	widget: WidgetDefinition;
	data: StatData | null;
	loading: boolean;
}

export function StatWidget({ widget, data, loading }: Props) {
	if (loading) {
		return (
			<div className="rounded-lg border border-(--border) bg-(--card) p-6 animate-pulse">
				<div className="h-4 w-24 rounded bg-(--muted)" />
				<div className="mt-3 h-8 w-20 rounded bg-(--muted)" />
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-(--border) bg-(--card) p-6">
			<p className="text-sm text-(--muted-foreground)">{widget.label}</p>
			<p className="mt-2 text-3xl font-bold">{data?.value ?? "—"}</p>
			{data?.change !== undefined && (
				<p
					className={`mt-1 text-xs ${data.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
				>
					{data.change >= 0 ? "+" : ""}
					{data.change}%{data.changeLabel ? ` ${data.changeLabel}` : ""}
				</p>
			)}
		</div>
	);
}
