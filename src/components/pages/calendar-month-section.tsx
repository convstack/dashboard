import { useRouter } from "@tanstack/react-router";
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	startOfMonth,
	startOfWeek,
	subMonths,
} from "date-fns";
import { useMemo, useState } from "react";
import { expandRecurrences } from "~/lib/schedule/expand-recurrences";
import type {
	CalendarMonthConfig,
	ScheduleData,
	ScheduleEvent,
} from "~/lib/schedule/types";
import { useScheduleWindow } from "~/lib/schedule/use-window";
import { EventEditModal } from "./event-edit-modal";
import { EventPopover } from "./event-popover";

interface Props {
	config: CalendarMonthConfig;
	data: ScheduleData | null;
	sectionKey: string;
	/** Service slug — forwarded to EventEditModal for proxy URL construction. */
	serviceSlug: string;
}

export function CalendarMonthSection({
	config,
	data,
	sectionKey,
	serviceSlug,
}: Props) {
	const router = useRouter();
	const initial = useMemo(() => {
		const from = startOfMonth(new Date());
		const to = endOfMonth(new Date());
		return { from, to };
	}, []);
	const { window, setWindow } = useScheduleWindow(sectionKey, initial);

	const days = useMemo(() => {
		const weekStartsOn = config.weekStartsOn === "sun" ? 0 : 1;
		const gridStart = startOfWeek(window.from, { weekStartsOn });
		const gridEnd = endOfWeek(window.to, { weekStartsOn });
		return eachDayOfInterval({ start: gridStart, end: gridEnd });
	}, [window, config.weekStartsOn]);

	const events = useMemo(
		() => expandRecurrences(data?.events ?? [], window),
		[data, window],
	);

	const eventsByDay = useMemo(() => {
		const map = new Map<string, ScheduleEvent[]>();
		for (const ev of events) {
			const key = format(new Date(ev.start), "yyyy-MM-dd");
			const list = map.get(key) ?? [];
			list.push(ev);
			map.set(key, list);
		}
		return map;
	}, [events]);

	const [popoverEvent, setPopoverEvent] = useState<ScheduleEvent | null>(null);
	const [editEvent, setEditEvent] = useState<ScheduleEvent | null>(null);
	const [creating, setCreating] = useState(false);

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

	function navigate(delta: number) {
		const next =
			delta > 0 ? addMonths(window.from, 1) : subMonths(window.from, 1);
		setWindow({ from: startOfMonth(next), to: endOfMonth(next) });
	}

	const dowLabels =
		config.weekStartsOn === "sun"
			? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
			: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

	const canCreate = !!data._links?.create && !!data._links?.createForm;

	return (
		<section className="rounded-lg border border-(--border) bg-(--surface-1)">
			<header className="flex items-center justify-between border-b border-(--border) px-5 py-4">
				<h2 className="text-base font-semibold text-(--fg)">
					{config.title ?? format(window.from, "MMMM yyyy")}
				</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() =>
							setWindow({
								from: startOfMonth(new Date()),
								to: endOfMonth(new Date()),
							})
						}
						className="rounded-(--radius) border border-(--border) px-2 py-1 text-xs text-(--fg) hover:bg-(--surface-2)"
					>
						Today
					</button>
					<button
						type="button"
						aria-label="Previous month"
						onClick={() => navigate(-1)}
						className="rounded-(--radius) border border-(--border) px-2 py-1 text-xs text-(--fg) hover:bg-(--surface-2)"
					>
						‹
					</button>
					<button
						type="button"
						aria-label="Next month"
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

			<div className="grid grid-cols-7 gap-px bg-(--border)">
				{dowLabels.map((d) => (
					<div
						key={d}
						className="bg-(--bg) py-2 text-center text-[10px] uppercase text-(--fg-muted)"
					>
						{d}
					</div>
				))}
				{days.map((day) => {
					const key = format(day, "yyyy-MM-dd");
					const dayEvents = eventsByDay.get(key) ?? [];
					const inMonth = isSameMonth(day, window.from);
					const isToday = isSameDay(day, new Date());
					return (
						<div
							key={key}
							className={`min-h-20 bg-(--surface-1) p-1 text-xs ${inMonth ? "" : "opacity-50"}`}
						>
							<div className="mb-1">
								{isToday ? (
									<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-(--accent) text-[10px] text-(--accent-fg)">
										{day.getDate()}
									</span>
								) : (
									<span className="text-(--fg-muted)">{day.getDate()}</span>
								)}
							</div>
							{dayEvents.slice(0, 3).map((ev) => {
								const color =
									config.categoryColors?.[ev.category ?? ""] ?? "var(--accent)";
								return (
									<button
										key={ev.id}
										type="button"
										onClick={() => setPopoverEvent(ev)}
										title={ev.title}
										className="block w-full truncate rounded px-1 text-left text-[10px] hover:underline"
										style={{ color }}
									>
										{ev.title}
									</button>
								);
							})}
							{dayEvents.length > 3 && (
								<div className="px-1 text-[10px] text-(--fg-muted)">
									+{dayEvents.length - 3} more
								</div>
							)}
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
