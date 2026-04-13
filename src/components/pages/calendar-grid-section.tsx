import { useRouter } from "@tanstack/react-router";
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { expandRecurrences } from "~/lib/schedule/expand-recurrences";
import type {
	CalendarGridConfig,
	ScheduleData,
	ScheduleEvent,
	ScheduleTrack,
} from "~/lib/schedule/types";
import { useDragToMove } from "~/lib/schedule/use-drag-to-move";
import { useScheduleWindow } from "~/lib/schedule/use-window";
import { EventEditModal } from "./event-edit-modal";
import { EventPopover } from "./event-popover";

interface Props {
	config: CalendarGridConfig;
	data: ScheduleData | null;
	/** Section index — used as URL key prefix; passed by SectionRenderer. */
	sectionKey: string;
	/** Service slug — forwarded to EventEditModal for proxy URL construction. */
	serviceSlug: string;
}

const MOBILE_BREAKPOINT = 768;
const HOUR_PX = 44;

/** Local viewport-width hook — kept inline per task instructions. */
function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const handler = () => setIsMobile(mq.matches);
		handler();
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return isMobile;
}

export function CalendarGridSection({
	config,
	data,
	sectionKey,
	serviceSlug,
}: Props) {
	const initial = useMemo(
		() => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
		[],
	);
	const { window, setWindow } = useScheduleWindow(sectionKey, initial);
	const router = useRouter();

	// If the service doesn't provide tracks, synthesize a single "All" column
	// so events still render instead of disappearing into an invisible bucket.
	const rawTracks = data?.tracks ?? [];
	const tracks =
		rawTracks.length > 0
			? rawTracks
			: [{ id: "_all", label: "All", accentColor: undefined }];
	const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(new Set());
	const visibleTracks = tracks.filter((t) => !hiddenTracks.has(t.id));
	const isMobile = useIsMobile();

	const events = useMemo(
		() =>
			expandRecurrences(data?.events ?? [], window).filter(
				(e) => !e.trackId || !hiddenTracks.has(e.trackId),
			),
		[data, window, hiddenTracks],
	);

	const drag = useDragToMove(undefined, (err, ev) => {
		console.warn(`couldn't move ${ev.title}:`, err);
	});

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

	const [hourStart, hourEnd] = config.hourRange;
	const hourCount = hourEnd - hourStart;

	const canCreate = !!data._links?.create && !!data._links?.createForm;

	function navigate(delta: number) {
		const next = delta > 0 ? addDays(window.from, 1) : subDays(window.from, 1);
		setWindow({ from: startOfDay(next), to: endOfDay(next) });
	}

	function toggleTrack(id: string) {
		setHiddenTracks((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function eventTop(ev: ScheduleEvent): number {
		const start = new Date(ev.start);
		const minutesIntoDay = start.getHours() * 60 + start.getMinutes();
		return ((minutesIntoDay - hourStart * 60) / 60) * HOUR_PX;
	}

	function eventHeight(ev: ScheduleEvent): number {
		const ms = new Date(ev.end).getTime() - new Date(ev.start).getTime();
		return (ms / (1000 * 60 * 60)) * HOUR_PX;
	}

	return (
		<section className="rounded-lg border border-(--border) bg-(--surface-1)">
			<header className="flex items-center justify-between border-b border-(--border) px-5 py-4">
				<h2 className="text-base font-semibold text-(--fg)">
					{config.title ?? format(window.from, "EEEE, MMMM d")}
				</h2>
				<div className="flex items-center gap-2">
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

			{tracks.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 border-b border-(--border) px-5 py-3">
					{tracks.map((t) => {
						const hidden = hiddenTracks.has(t.id);
						const color = t.accentColor ?? "var(--accent)";
						return (
							<button
								key={t.id}
								type="button"
								onClick={() => toggleTrack(t.id)}
								className="rounded-full border px-3 py-1 text-xs"
								style={{
									borderColor: hidden ? "var(--border)" : color,
									color: hidden ? "var(--fg-subtle)" : color,
									background: hidden
										? "transparent"
										: `color-mix(in oklch, ${color} 12%, transparent)`,
								}}
							>
								{t.label}
							</button>
						);
					})}
				</div>
			)}

			{isMobile ? (
				<MobileFallback
					tracks={visibleTracks}
					events={events}
					config={config}
					onSelect={setPopoverEvent}
				/>
			) : (
				<DesktopGrid
					tracks={visibleTracks}
					events={events}
					config={config}
					hourStart={hourStart}
					hourCount={hourCount}
					getDraft={drag.getDraft}
					beginDrag={drag.beginDrag}
					commit={drag.commit}
					onSelect={setPopoverEvent}
					eventTop={eventTop}
					eventHeight={eventHeight}
				/>
			)}

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

// ---------------------------------------------------------------------------
// DesktopGrid — hours down, tracks across, sticky hour ruler on horizontal scroll
// ---------------------------------------------------------------------------

interface DesktopProps {
	tracks: ScheduleTrack[];
	events: ScheduleEvent[];
	config: CalendarGridConfig;
	hourStart: number;
	hourCount: number;
	getDraft: (id: string) => ScheduleEvent | undefined;
	beginDrag: (ev: ScheduleEvent) => void;
	commit: (id: string) => Promise<void>;
	onSelect: (ev: ScheduleEvent) => void;
	eventTop: (ev: ScheduleEvent) => number;
	eventHeight: (ev: ScheduleEvent) => number;
}

function DesktopGrid({
	tracks,
	events,
	config,
	hourStart,
	hourCount,
	getDraft,
	beginDrag,
	commit,
	onSelect,
	eventTop,
	eventHeight,
}: DesktopProps) {
	const fallbackTrackId = tracks[0]?.id;
	const eventsByTrack = useMemo(() => {
		const map = new Map<string, ScheduleEvent[]>();
		for (const ev of events) {
			// If trackId is missing, bucket into the first track (which is the
			// synthetic "_all" column when the service didn't provide tracks).
			const key = ev.trackId ?? fallbackTrackId ?? "_untracked";
			const list = map.get(key) ?? [];
			list.push(ev);
			map.set(key, list);
		}
		return map;
	}, [events, fallbackTrackId]);

	// overflow-x: auto lets the grid scroll when tracks * minColWidth exceeds
	// the available width. The hour ruler column uses sticky left-0 so it
	// remains visible during horizontal scroll.
	return (
		<div className="overflow-x-auto p-5">
			<div
				className="grid"
				style={{
					gridTemplateColumns: `60px repeat(${tracks.length}, minmax(140px, 1fr))`,
					gap: 1,
					background: "var(--border)",
				}}
			>
				<div className="sticky left-0 z-10 bg-(--surface-1)" />
				{tracks.map((t) => (
					<div
						key={t.id}
						className="bg-(--surface-2) px-2 py-2 text-center text-xs font-semibold"
						style={{ color: t.accentColor ?? "var(--fg)" }}
					>
						{t.label}
					</div>
				))}

				<div className="sticky left-0 z-10 bg-(--surface-1)">
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

				{tracks.map((t) => {
					const trackEvents = eventsByTrack.get(t.id) ?? [];
					return (
						<div
							key={t.id}
							className="relative bg-(--surface-1)"
							style={{ height: hourCount * HOUR_PX }}
						>
							{Array.from({ length: hourCount }, (_, i) => (
								<div
									key={i}
									style={{ height: HOUR_PX }}
									className="border-t border-(--border)"
								/>
							))}
							{trackEvents.map((ev) => {
								const draft = getDraft(ev.id);
								const display = draft ?? ev;
								const color =
									config.categoryColors?.[display.category ?? ""] ??
									"var(--accent)";
								return (
									<button
										key={ev.id}
										type="button"
										draggable={!!ev._links?.update}
										onDragStart={() => beginDrag(ev)}
										onDragEnd={() => commit(ev.id)}
										onClick={() => onSelect(ev)}
										className="absolute left-1 right-1 rounded text-left text-[11px]"
										style={{
											top: eventTop(display),
											height: eventHeight(display),
											background: "var(--surface-2)",
											borderLeft: `3px solid ${color}`,
											padding: "3px 5px",
											opacity: draft ? 0.6 : 1,
										}}
									>
										<div className="truncate font-medium text-(--fg)">
											{display.title}
										</div>
										{display.category && (
											<div className="truncate text-[10px] text-(--fg-muted)">
												{display.category}
											</div>
										)}
									</button>
								);
							})}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// MobileFallback — track-grouped agenda list for viewports < 768 px
// ---------------------------------------------------------------------------

interface MobileFallbackProps {
	tracks: ScheduleTrack[];
	events: ScheduleEvent[];
	config: CalendarGridConfig;
	onSelect: (ev: ScheduleEvent) => void;
}

function MobileFallback({
	tracks,
	events,
	config,
	onSelect,
}: MobileFallbackProps) {
	const fallbackTrackId = tracks[0]?.id;
	const grouped = useMemo(() => {
		const map = new Map<string, ScheduleEvent[]>();
		for (const ev of events) {
			// If trackId is missing, bucket into the first track (which is the
			// synthetic "_all" column when the service didn't provide tracks).
			const key = ev.trackId ?? fallbackTrackId ?? "_untracked";
			const list = map.get(key) ?? [];
			list.push(ev);
			map.set(key, list);
		}
		for (const list of map.values()) {
			list.sort((a, b) => a.start.localeCompare(b.start));
		}
		return map;
	}, [events, fallbackTrackId]);

	return (
		<div className="space-y-4 p-5">
			{tracks.map((t) => {
				const trackEvents = grouped.get(t.id) ?? [];
				if (trackEvents.length === 0) return null;
				return (
					<div key={t.id}>
						<div
							className="mb-2 text-xs font-semibold uppercase tracking-wide"
							style={{ color: t.accentColor ?? "var(--fg-muted)" }}
						>
							{t.label}
						</div>
						<ul className="divide-y divide-(--border)">
							{trackEvents.map((ev) => {
								const color =
									config.categoryColors?.[ev.category ?? ""] ?? "var(--accent)";
								return (
									<li key={ev.id}>
										<button
											type="button"
											onClick={() => onSelect(ev)}
											className="grid w-full grid-cols-[80px_4px_1fr] items-center gap-3 py-2 text-left hover:bg-[var(--surface-2)]"
										>
											<time
												dateTime={ev.start}
												className="text-sm tabular-nums text-(--fg-muted)"
											>
												{format(new Date(ev.start), "h:mm a")}
											</time>
											<span
												aria-hidden="true"
												className="h-7 w-0.75 rounded-sm"
												style={{ background: color }}
											/>
											<div>
												<div className="text-sm text-(--fg)">{ev.title}</div>
												{ev.category && (
													<div className="text-xs text-(--fg-subtle)">
														{ev.category}
													</div>
												)}
											</div>
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				);
			})}
		</div>
	);
}
