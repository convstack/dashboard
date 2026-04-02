import type { WidgetDefinition } from "~/lib/types/manifest";

interface ProgressData {
	current: number;
	total: number;
	label?: string;
}

interface Props {
	widget: WidgetDefinition;
	data: ProgressData | null;
	loading: boolean;
}

export function ProgressWidget({ widget, data, loading }: Props) {
	if (loading || !data) {
		return (
			<div className="rounded-lg border border-(--border) bg-(--card) p-6 animate-pulse">
				<div className="h-4 w-32 rounded bg-(--muted)" />
				<div className="mt-3 h-3 rounded-full bg-(--muted)" />
			</div>
		);
	}

	const percentage =
		data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;

	return (
		<div className="rounded-lg border border-(--border) bg-(--card) p-6">
			<div className="flex items-center justify-between">
				<p className="text-sm text-(--muted-foreground)">{widget.label}</p>
				<p className="text-sm font-medium">{percentage}%</p>
			</div>
			<div className="mt-3 h-2.5 rounded-full bg-(--muted)">
				<div
					className="h-full rounded-full bg-(--primary) transition-all duration-300"
					style={{ width: `${Math.min(percentage, 100)}%` }}
				/>
			</div>
			<p className="mt-1.5 text-xs text-(--muted-foreground)">
				{data.label || `${data.current} of ${data.total}`}
			</p>
		</div>
	);
}
