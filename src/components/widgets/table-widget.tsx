import type { WidgetDefinition } from "~/lib/types/manifest";

interface TableData {
	columns: { key: string; label: string }[];
	rows: Record<string, unknown>[];
}

interface Props {
	widget: WidgetDefinition;
	data: TableData | null;
	loading: boolean;
}

export function TableWidget({ widget, data, loading }: Props) {
	if (loading || !data) {
		return (
			<div className="rounded-lg border border-(--border) bg-(--card) p-6 animate-pulse">
				<div className="h-4 w-32 rounded bg-(--muted)" />
				<div className="mt-4 space-y-2">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-8 rounded bg-(--muted)" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-(--border) bg-(--card) p-6">
			<p className="text-sm font-medium text-(--muted-foreground) mb-3">
				{widget.label}
			</p>
			<div className="overflow-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-(--border)">
							{data.columns.map((col) => (
								<th
									key={col.key}
									className="px-2 py-2 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider"
								>
									{col.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{data.rows.map((row, idx) => (
							<tr
								key={idx}
								className="border-b border-(--border) last:border-b-0"
							>
								{data.columns.map((col) => (
									<td key={col.key} className="px-2 py-2">
										{String(row[col.key] ?? "")}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
