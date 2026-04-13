import { useRouter } from "@tanstack/react-router";
import { format as formatDate } from "date-fns";
import { useMemo, useState } from "react";
import { expandRecurrences } from "~/lib/schedule/expand-recurrences";
import {
	formatDayHeader,
	formatEventTime,
	getViewerTimeZone,
} from "~/lib/schedule/format-time";
import type {
	AgendaConfig,
	ScheduleData,
	ScheduleEvent,
} from "~/lib/schedule/types";
import { useTzPreference } from "~/lib/schedule/use-tz-preference";
import { EventEditModal } from "./event-edit-modal";
import { EventPopover } from "./event-popover";

interface Props {
	config: AgendaConfig;
	data: ScheduleData | null;
	sectionKey: string;
	serviceSlug: string;
}

export function AgendaSection({ config, data, serviceSlug }: Props) {
	const { mode } = useTzPreference();
	const router = useRouter();
	const [popoverEvent, setPopoverEvent] = useState<ScheduleEvent | null>(null);
	const [editEvent, setEditEvent] = useState<ScheduleEvent | null>(null);
	const [creating, setCreating] = useState(false);

	// Visible window: today → today + 30d (rolling). Agenda doesn't navigate
	// months/days the way grid/month do, so we don't use use-window here.
	const window = useMemo(() => {
		const from = new Date();
		from.setHours(0, 0, 0, 0);
		const to = new Date(from);
		to.setDate(to.getDate() + 30);
		return { from, to };
	}, []);

	const expanded = useMemo(
		() => expandRecurrences(data?.events ?? [], window),
		[data, window],
	);

	const filtered = useMemo(() => {
		if (config.showPastEvents) return expanded;
		const now = Date.now();
		return expanded.filter((e) => new Date(e.end).getTime() >= now);
	}, [expanded, config.showPastEvents]);

	const sorted = useMemo(
		() => [...filtered].sort((a, b) => a.start.localeCompare(b.start)),
		[filtered],
	);

	// Group by day in viewer TZ (so cross-TZ users see the same day buckets).
	const groups = useMemo(() => {
		const viewerTz = getViewerTimeZone();
		const out = new Map<string, ScheduleEvent[]>();
		for (const ev of sorted) {
			const dayKey = new Date(ev.start).toLocaleDateString("en-CA", {
				timeZone: viewerTz,
			});
			const list = out.get(dayKey) ?? [];
			list.push(ev);
			out.set(dayKey, list);
		}
		return out;
	}, [sorted]);

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

	if (sorted.length === 0 && data.emptyState) {
		// Empty state — falls back to a plain message if EmptyStateSection isn't used here.
		return (
			<section className="rounded-lg border border-(--border) bg-(--surface-1) p-8 text-center">
				<h3 className="text-base font-medium text-(--fg)">
					{data.emptyState.title}
				</h3>
				{data.emptyState.description && (
					<p className="mt-1 text-sm text-(--fg-muted)">
						{data.emptyState.description}
					</p>
				)}
			</section>
		);
	}

	const canCreate = !!data._links?.create && !!data._links?.createForm;

	return (
		<section className="rounded-lg border border-(--border) bg-(--surface-1)">
			<header className="flex items-center justify-between border-b border-(--border) px-5 py-4">
				<h2 className="text-base font-semibold text-(--fg)">
					{config.title ?? "Agenda"}
				</h2>
				{canCreate && (
					<button
						type="button"
						onClick={() => setCreating(true)}
						className="rounded-(--radius) bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--accent-fg) hover:bg-(--accent-hover)"
					>
						+ New event
					</button>
				)}
			</header>

			<div className="space-y-4 p-5">
				{[...groups.entries()].map(([dayKey, events]) => {
					const firstStart = events[0]?.start;
					return (
						<div key={dayKey}>
							<div className="mb-2 text-xs uppercase tracking-wide text-(--fg-muted)">
								{formatDayHeader(firstStart)}
							</div>
							<ul className="divide-y divide-(--border)">
								{events.map((ev) => {
									const color =
										config.categoryColors?.[ev.category ?? ""] ??
										"var(--accent)";
									return (
										<li key={ev.id}>
											<button
												type="button"
												onClick={() => setPopoverEvent(ev)}
												className="grid w-full grid-cols-[minmax(80px,auto)_4px_1fr_auto] items-center gap-3 py-2 text-left hover:bg-(--surface-2)"
											>
												<time
													dateTime={ev.start}
													className="text-xs tabular-nums text-(--fg-muted)"
												>
													{(() => {
														const s = new Date(ev.start);
														const e = new Date(ev.end);
														const sameDay =
															s.toDateString() === e.toDateString();
														const startTime = formatEventTime(
															ev.start,
															ev.timezone,
															mode,
														);
														const endTime = formatEventTime(
															ev.end,
															ev.timezone,
															mode,
														);
														if (sameDay) return `${startTime} – ${endTime}`;
														// Multi-day: show date + time, shortest first
														// (current group's date is implicit from the header)
														return `${formatDate(s, "MMM d")}, ${startTime} – ${formatDate(e, "MMM d")}, ${endTime}`;
													})()}
												</time>
												<span
													aria-hidden="true"
													className="h-7 w-0.75 rounded-sm"
													style={{ background: color }}
												/>
												<div>
													<div className="text-sm text-(--fg)">{ev.title}</div>
													{(ev.location || ev.category) && (
														<div className="text-xs text-(--fg-subtle)">
															{[ev.location, ev.category]
																.filter(Boolean)
																.join(" · ")}
														</div>
													)}
												</div>
												<span className="flex items-center gap-1.5">
													{ev.id.includes("__") && (
														<span className="text-xs text-(--fg-subtle)">
															Recurring
														</span>
													)}
													{(() => {
														const status = (
															ev as ScheduleEvent & {
																_meta?: { assignmentStatus?: string };
															}
														)._meta?.assignmentStatus;
														if (status === "requested") {
															return (
																<span className="rounded bg-(--surface-3) px-2 py-0.5 text-[10px] font-medium text-(--fg-muted)">
																	Pending
																</span>
															);
														}
														if (status === "approved") {
															return (
																<span className="rounded bg-(--accent-muted) px-2 py-0.5 text-[10px] font-medium text-(--accent)">
																	Confirmed
																</span>
															);
														}
														return null;
													})()}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						</div>
					);
				})}
			</div>

			{popoverEvent && (
				<EventPopover
					event={popoverEvent}
					serviceSlug={serviceSlug}
					onClose={() => setPopoverEvent(null)}
					onEdit={(e) => {
						setPopoverEvent(null);
						setEditEvent(e);
					}}
					onDelete={async (e) => {
						if (!e._links?.delete) return;
						await fetch(e._links.delete, {
							method: "DELETE",
							credentials: "include",
						});
						setPopoverEvent(null);
						router.invalidate();
					}}
				/>
			)}

			{editEvent && data._links?.editForm && (
				<EventEditModal
					formConfig={data._links.editForm}
					event={editEvent}
					serviceSlug={serviceSlug}
					onClose={() => setEditEvent(null)}
					onSaved={() => {
						setEditEvent(null);
						router.invalidate();
					}}
				/>
			)}

			{creating && data._links?.createForm && data._links?.create && (
				<EventEditModal
					formConfig={data._links.createForm}
					createUrl={data._links.create}
					serviceSlug={serviceSlug}
					onClose={() => setCreating(false)}
					onSaved={() => {
						setCreating(false);
						router.invalidate();
					}}
				/>
			)}
		</section>
	);
}
