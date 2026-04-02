import { useEffect, useState } from "react";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import type { WidgetDefinition } from "~/lib/types/manifest";
import { ChartWidget } from "./chart-widget";
import { ListWidget } from "./list-widget";
import { ProgressWidget } from "./progress-widget";
import { StatWidget } from "./stat-widget";
import { TableWidget } from "./table-widget";

interface Props {
	widget: WidgetDefinition;
	service: ServiceCatalogEntry;
}

export function WidgetRenderer({ widget, service }: Props) {
	const [data, setData] = useState<unknown>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetchData() {
			try {
				const response = await fetch(
					`/api/proxy/${service.slug}${widget.endpoint}`,
				);
				if (!response.ok) {
					setError(`Failed to load (${response.status})`);
					setLoading(false);
					return;
				}
				const json = await response.json();
				if (!cancelled) {
					setData(json);
					setLoading(false);
				}
			} catch {
				if (!cancelled) {
					setError("Failed to load");
					setLoading(false);
				}
			}
		}

		fetchData();

		// Auto-refresh if configured
		let interval: ReturnType<typeof setInterval> | undefined;
		if (widget.refreshInterval && widget.refreshInterval > 0) {
			interval = setInterval(fetchData, widget.refreshInterval * 1000);
		}

		return () => {
			cancelled = true;
			if (interval) clearInterval(interval);
		};
	}, [service.slug, widget.endpoint, widget.refreshInterval]);

	if (error) {
		return (
			<div className="rounded-lg border border-(--border) bg-(--card) p-6">
				<p className="text-sm text-(--muted-foreground)">{widget.label}</p>
				<p className="mt-2 text-xs text-(--destructive)">{error}</p>
			</div>
		);
	}

	switch (widget.type) {
		case "stat":
			return (
				<StatWidget
					widget={widget}
					data={data as Parameters<typeof StatWidget>[0]["data"]}
					loading={loading}
				/>
			);
		case "chart":
			return (
				<ChartWidget
					widget={widget}
					data={data as Parameters<typeof ChartWidget>[0]["data"]}
					loading={loading}
				/>
			);
		case "table":
			return (
				<TableWidget
					widget={widget}
					data={data as Parameters<typeof TableWidget>[0]["data"]}
					loading={loading}
				/>
			);
		case "list":
			return (
				<ListWidget
					widget={widget}
					data={data as Parameters<typeof ListWidget>[0]["data"]}
					loading={loading}
				/>
			);
		case "progress":
			return (
				<ProgressWidget
					widget={widget}
					data={data as Parameters<typeof ProgressWidget>[0]["data"]}
					loading={loading}
				/>
			);
		default:
			return (
				<div className="rounded-lg border border-(--border) bg-(--card) p-6">
					<p className="text-sm text-(--muted-foreground)">
						Unknown widget type: {widget.type}
					</p>
				</div>
			);
	}
}
