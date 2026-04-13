import { useRouter } from "@tanstack/react-router";
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { expandRecurrences } from "~/lib/schedule/expand-recurrences";
import type {
	CalendarDayConfig,
	ScheduleData,
	ScheduleEvent,
} from "~/lib/schedule/types";
import { useDragToMove } from "~/lib/schedule/use-drag-to-move";
import { useScheduleWindow } from "~/lib/schedule/use-window";
import { EventEditModal } from "./event-edit-modal";
import { EventPopover } from "./event-popover";

interface Props {
	config: CalendarDayConfig;
	data: ScheduleData | null;
	sectionKey: string;
	serviceSlug: string;
}

export function CalendarDaySection(props: Props) {
	if (
		!props.data ||
		typeof props.data !== "object" ||
		!Array.isArray(props.data.events)
	) {
		return (
			<section className="rounded-lg border border-(--border) bg-(--surface-1) p-8 text-center">
				<h3 className="text-base font-medium text-(--fg)">
					{props.config.title ?? "Schedule"}
				</h3>
				<p className="mt-2 text-sm text-(--fg-muted)">
					Couldn't load schedule data. The schedule service may be unavailable.
				</p>
			</section>
		);
	}
	return <CalendarDay {...props} data={props.data} />;
}

interface InnerProps extends Omit<Props, "data"> {
	data: ScheduleData;
}

function CalendarDay({ config, data, sectionKey, serviceSlug }: InnerProps) {
	const initial = useMemo(
		() => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
		[],
	);
	const { window, setWindow } = useScheduleWindow(sectionKey, initial);
	const router = useRouter();

	const events = useMemo(
		() => expandRecurrences(data.events, window),
		[data, window],
	);

	const drag = useDragToMove(undefined, (err, ev) => {
		console.warn(`couldn't move ${ev.title}:`, err);
	});

	const [popoverEvent, setPopoverEvent] = useState<ScheduleEvent | null>(null);
	const [editEvent, setEditEvent] = useState<ScheduleEvent | null>(null);
	const [creating, setCreating] = useState(false);

	const [hourStart, hourEnd] = config.hourRange;
	const hourCount = hourEnd - hourStart;
	// Scale the hour height dynamically so the grid fits the viewport.
	// Uses a state + effect to avoid SSR hydration mismatches (server
	// doesn't know the viewport height).
	const [hourPx, setHourPx] = useState(32); // safe SSR default
	useEffect(() => {
		function calc() {
			const available = globalThis.innerHeight - 200; // subtract header + chrome
			setHourPx(Math.max(20, Math.min(48, Math.floor(available / hourCount))));
		}
		calc();
		globalThis.addEventListener("resize", calc);
		return () => globalThis.removeEventListener("resize", calc);
	}, [hourCount]);
	const HOUR_PX = hourPx;

	function navigate(delta: number) {
		const next = delta > 0 ? addDays(window.from, 1) : subDays(window.from, 1);
		setWindow({ from: startOfDay(next), to: endOfDay(next) });
	}

	const gridHeight = hourCount * HOUR_PX;

	// Clip a multi-day event to the portion that falls on the currently
	// viewed day, then compute pixel position within the hour grid.
	// Returns null if the event has zero overlap with the viewed day.
	const clipToDay = useCallback(
		(ev: ScheduleEvent): { startMin: number; endMin: number } | null => {
			const evStart = new Date(ev.start);
			const evEnd = new Date(ev.end);
			const dayStart = new Date(window.from);
			const dayEnd = new Date(window.to);

			// No overlap at all: event ends before the day starts, or starts
			// after the day ends.
			if (evEnd <= dayStart || evStart >= dayEnd) return null;

			const visibleStart = evStart < dayStart ? dayStart : evStart;
			const visibleEnd = evEnd > dayEnd ? dayEnd : evEnd;

			// Convert to minutes-into-day. For events clipped to dayStart
			// (midnight), this gives 0. For events clipped to dayEnd (23:59),
			// this gives ~1439. If the event ends exactly at midnight of the
			// next day (common for full-day events), treat endMin as 24*60.
			const startMin = visibleStart.getHours() * 60 + visibleStart.getMinutes();
			const endMin =
				visibleEnd.toDateString() !== dayStart.toDateString()
					? 24 * 60 // ends on a later day → runs to midnight of viewed day
					: visibleEnd.getHours() * 60 + visibleEnd.getMinutes();

			if (endMin <= startMin) return null; // zero-duration after clipping

			return { startMin, endMin };
		},
		[window.from, window.to],
	);

	function eventTop(ev: ScheduleEvent): number {
		const clip = clipToDay(ev);
		if (!clip) return 0;
		return Math.max(0, ((clip.startMin - hourStart * 60) / 60) * HOUR_PX);
	}

	function eventHeight(ev: ScheduleEvent): number {
		const clip = clipToDay(ev);
		if (!clip) return 0;
		const durationMin = clip.endMin - clip.startMin;
		const rawTop = ((clip.startMin - hourStart * 60) / 60) * HOUR_PX;
		const rawHeight = (durationMin / 60) * HOUR_PX;
		const clampedTop = Math.max(0, rawTop);
		const topDelta = clampedTop - rawTop;
		return Math.max(
			HOUR_PX / 2,
			Math.min(rawHeight - topDelta, gridHeight - clampedTop),
		);
	}

	const visibleEvents = useMemo(
		() => events.filter((ev) => clipToDay(ev) !== null),
		[events, clipToDay],
	);

	const canCreate = !!data._links?.create && !!data._links?.createForm;

	// Lay out overlapping events side-by-side: sort by start, greedily assign
	// each event to the first column where it fits, track max columns per
	// overlap group so widths can be computed from totalCols.
	const columnLayout = useMemo(() => {
		const layout = new Map<string, { col: number; totalCols: number }>();
		if (visibleEvents.length === 0) return layout;

		const intervals = visibleEvents
			.map((ev) => {
				const clip = clipToDay(ev)!;
				return { id: ev.id, startMin: clip.startMin, endMin: clip.endMin };
			})
			.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

		const groups: (typeof intervals)[] = [];
		let currentGroup: typeof intervals = [];
		let groupEnd = -1;

		for (const iv of intervals) {
			if (currentGroup.length === 0 || iv.startMin < groupEnd) {
				currentGroup.push(iv);
				groupEnd = Math.max(groupEnd, iv.endMin);
			} else {
				groups.push(currentGroup);
				currentGroup = [iv];
				groupEnd = iv.endMin;
			}
		}
		if (currentGroup.length > 0) groups.push(currentGroup);

		for (const group of groups) {
			const columns: number[] = [];
			for (const iv of group) {
				let col = columns.findIndex((colEnd) => colEnd <= iv.startMin);
				if (col === -1) {
					col = columns.length;
					columns.push(iv.endMin);
				} else {
					columns[col] = iv.endMin;
				}
				layout.set(iv.id, { col, totalCols: 0 });
			}
			const totalCols = columns.length;
			for (const iv of group) {
				const entry = layout.get(iv.id)!;
				entry.totalCols = totalCols;
			}
		}

		return layout;
	}, [visibleEvents, clipToDay]);

	return (
		<section className="rounded-lg border border-(--border) bg-(--surface-1)">
			<header className="flex items-center justify-between border-b border-(--border) px-5 py-4">
				<h2 className="text-base font-semibold text-(--fg)">
					{config.title ?? format(window.from, "EEEE, MMMM d")}
				</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setWindow(initial)}
						className="rounded-(--radius) border border-(--border) px-2 py-1 text-xs text-(--fg) hover:bg-(--surface-2)"
					>
						Today
					</button>
					<button
						type="button"
						aria-label="Previous day"
						onClick={() => navigate(-1)}
						className="rounded-(--radius) border border-(--border) px-2 py-1 text-xs text-(--fg) hover:bg-(--surface-2)"
					>
						‹
					</button>
					<button
						type="button"
						aria-label="Next day"
						onClick={() => navigate(1)}
						className="rounded-(--radius) border border-(--border) px-2 py-1 text-xs text-(--fg) hover:bg-(--surface-2)"
					>
						›
					</button>
					{canCreate && (
						<button
							type="button"
							onClick={() => setCreating(true)}
							className="rounded-(--radius) bg-(--accent) px-3 py-1 text-xs font-medium text-(--accent-fg) hover:bg-(--accent-hover)"
						>
							+ New
						</button>
					)}
				</div>
			</header>

			<div className="grid grid-cols-[60px_1fr] overflow-hidden p-5">
				<div>
					{Array.from({ length: hourCount }, (_, i) => (
						<div
							key={i}
							style={{ height: HOUR_PX }}
							className="border-t border-(--border) pr-2 text-right text-[10px] text-(--fg-subtle)"
						>
							{format(new Date().setHours(hourStart + i, 0, 0, 0), "h a")}
						</div>
					))}
				</div>
				<div className="relative">
					{Array.from({ length: hourCount }, (_, i) => (
						<div
							key={i}
							style={{ height: HOUR_PX }}
							className="border-t border-(--border)"
						/>
					))}
					{visibleEvents.map((ev) => {
						const draft = drag.getDraft(ev.id);
						const display = draft ?? ev;
						const color =
							config.categoryColors?.[display.category ?? ""] ??
							"var(--accent)";
						const layout = columnLayout.get(ev.id) ?? { col: 0, totalCols: 1 };
						const widthPct = 100 / layout.totalCols;
						const leftPct = layout.col * widthPct;
						return (
							<button
								key={ev.id}
								type="button"
								draggable={!!ev._links?.update}
								onDragStart={() => drag.beginDrag(ev)}
								onDragEnd={() => drag.commit(ev.id)}
								onClick={() => setPopoverEvent(ev)}
								className="absolute rounded text-left text-[11px]"
								style={{
									top: eventTop(display),
									height: eventHeight(display),
									left: `calc(${leftPct}% + 2px)`,
									width: `calc(${widthPct}% - 4px)`,
									background: "var(--surface-2)",
									borderLeft: `3px solid ${color}`,
									padding: "4px 6px",
									opacity: draft ? 0.6 : 1,
								}}
							>
								<div className="truncate font-medium text-(--fg)">
									{display.title}
								</div>
								<div className="truncate text-[10px] text-(--fg-muted)">
									{(() => {
										const s = new Date(display.start);
										const e = new Date(display.end);
										const viewedDay = window.from.toDateString();
										// Show time-only for the portion on the viewed day,
										// date + time for the portion on a different day.
										const startStr =
											s.toDateString() === viewedDay
												? format(s, "h:mm a")
												: format(s, "MMM d, h:mm a");
										const endStr =
											e.toDateString() === viewedDay
												? format(e, "h:mm a")
												: format(e, "MMM d, h:mm a");
										return `${startStr} – ${endStr}`;
									})()}
								</div>
							</button>
						);
					})}
				</div>
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
