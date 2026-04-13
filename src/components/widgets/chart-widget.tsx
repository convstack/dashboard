import type { WidgetDefinition } from "@convstack/service-sdk/types";

interface ChartData {
	labels: string[];
	datasets: { label: string; data: number[] }[];
}

interface Props {
	widget: WidgetDefinition;
	data: ChartData | null;
	loading: boolean;
}

export function ChartWidget({ widget, data, loading }: Props) {
	if (loading || !data) {
		return (
			<div className="rounded-lg border border-(--border) bg-(--card) p-6 animate-pulse">
				<div className="h-4 w-32 rounded bg-(--muted)" />
				<div className="mt-4 h-32 rounded bg-(--muted)" />
			</div>
		);
	}

	// Simple CSS-only bar chart
	const maxValue = Math.max(...data.datasets.flatMap((ds) => ds.data), 1);

	return (
		<div className="rounded-lg border border-(--border) bg-(--card) p-6">
			<p className="text-sm font-medium text-(--muted-foreground) mb-4">
				{widget.label}
			</p>
			{data.datasets.map((dataset) => (
				<div key={dataset.label}>
					{data.datasets.length > 1 && (
						<p className="text-xs text-(--muted-foreground) mb-2">
							{dataset.label}
						</p>
					)}
					<div className="flex items-end gap-1 h-32">
						{dataset.data.map((value, idx) => (
							<div
								key={idx}
								className="flex-1 flex flex-col items-center gap-1"
							>
								<div
									className="w-full bg-(--primary) rounded-t opacity-80 hover:opacity-100 transition-opacity min-h-[2px]"
									style={{
										height: `${(value / maxValue) * 100}%`,
									}}
									title={`${data.labels[idx]}: ${value}`}
								/>
								<span className="text-[10px] text-(--muted-foreground) truncate max-w-full">
									{data.labels[idx]}
								</span>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
