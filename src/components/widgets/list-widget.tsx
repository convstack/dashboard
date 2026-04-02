import type { WidgetDefinition } from "~/lib/types/manifest";

interface ListData {
	items: { title: string; subtitle?: string; href?: string }[];
}

interface Props {
	widget: WidgetDefinition;
	data: ListData | null;
	loading: boolean;
}

export function ListWidget({ widget, data, loading }: Props) {
	if (loading || !data) {
		return (
			<div className="rounded-lg border border-(--border) bg-(--card) p-6 animate-pulse">
				<div className="h-4 w-32 rounded bg-(--muted)" />
				<div className="mt-4 space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-6 rounded bg-(--muted)" />
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
			<ul className="space-y-2">
				{data.items.map((item, idx) => (
					<li
						key={idx}
						className="flex items-center justify-between py-1 border-b border-(--border) last:border-b-0"
					>
						<div>
							<p className="text-sm font-medium">{item.title}</p>
							{item.subtitle && (
								<p className="text-xs text-(--muted-foreground)">
									{item.subtitle}
								</p>
							)}
						</div>
					</li>
				))}
				{data.items.length === 0 && (
					<li className="text-sm text-(--muted-foreground)">No items</li>
				)}
			</ul>
		</div>
	);
}
