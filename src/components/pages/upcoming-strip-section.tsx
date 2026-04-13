import { useMemo } from "react";
import { expandRecurrences } from "~/lib/schedule/expand-recurrences";
import { formatRelativeWhen } from "~/lib/schedule/format-time";
import type { ScheduleData, UpcomingStripConfig } from "~/lib/schedule/types";

interface Props {
	config: UpcomingStripConfig;
	data: ScheduleData | null;
}

export function UpcomingStripSection({ config, data }: Props) {
	const events = useMemo(() => {
		const from = new Date();
		const to = new Date();
		to.setDate(to.getDate() + 90);
		const expanded = expandRecurrences(data?.events ?? [], { from, to });
		const now = Date.now();
		return expanded
			.filter((e) => new Date(e.start).getTime() >= now)
			.sort((a, b) => a.start.localeCompare(b.start))
			.slice(0, config.maxItems);
	}, [data, config.maxItems]);

	if (!data || typeof data !== "object" || !Array.isArray(data.events)) {
		return (
			<section className="rounded-lg border border-(--border) bg-(--surface-1) p-8 text-center">
				<h3 className="text-base font-medium text-(--fg)">
					{config.title ?? "Schedule"}
				</h3>
				<p className="mt-2 text-sm text-(--fg-muted)">
					Couldn't load schedule data. The schedule service may be unavailable.
				</p>
			</section>
		);
	}

	if (events.length === 0) {
		return (
			<section className="rounded-lg border border-(--border) bg-(--surface-1) p-6 text-center text-sm text-(--fg-muted)">
				{data.emptyState?.title ?? "Nothing scheduled."}
			</section>
		);
	}

	return (
		<section className="rounded-lg border border-(--border) bg-(--surface-1)">
			<header className="flex items-center justify-between border-b border-(--border) px-5 py-4">
				<h2 className="text-base font-semibold text-(--fg)">
					{config.title ?? "What's next"}
				</h2>
			</header>
			<div className="flex gap-3 overflow-x-auto p-5">
				{events.map((ev) => {
					const color =
						config.categoryColors?.[ev.category ?? ""] ?? "var(--accent)";
					return (
						<a
							key={ev.id}
							href={ev.link ?? "#"}
							className="block w-50 shrink-0 rounded-(--radius) border border-(--border) bg-(--surface-2) p-4 hover:border-(--border-strong)"
						>
							<div
								className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
								style={{ color }}
							>
								{formatRelativeWhen(ev.start, ev.timezone)}
							</div>
							<div className="mb-1 text-sm font-medium leading-tight text-(--fg)">
								{ev.title}
							</div>
							{ev.location && (
								<div className="text-xs text-(--fg-muted)">{ev.location}</div>
							)}
						</a>
					);
				})}
			</div>
		</section>
	);
}
