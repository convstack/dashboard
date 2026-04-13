// dashboard/src/lib/schedule/format-time.ts
import { format as formatBase } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export type TzMode = "event" | "viewer" | "both";

/** Browser TZ via Intl, with a safe fallback. */
export function getViewerTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}

/**
 * Format an ISO timestamp for display. Honors the user's TZ preference.
 *
 * - mode "event": render in eventTimeZone, with abbreviation
 * - mode "viewer": render in viewer's TZ
 * - mode "both": render event TZ followed by viewer TZ in parens
 */
export function formatEventTime(
	iso: string,
	eventTimeZone: string,
	mode: TzMode,
	formatStr = "h:mm a",
): string {
	const viewerTz = getViewerTimeZone();
	const inEvent = formatInTimeZone(iso, eventTimeZone, formatStr);
	if (mode === "event") return inEvent;
	const inViewer = formatInTimeZone(iso, viewerTz, formatStr);
	if (mode === "viewer") return inViewer;
	// Both: skip the parens if the two TZs happen to be the same.
	if (inEvent === inViewer) return inEvent;
	return `${inEvent} (${inViewer} your time)`;
}

/** Format a date as a day header — "Today", "Tomorrow", or absolute. */
export function formatDayHeader(
	iso: string,
	viewerTz: string = getViewerTimeZone(),
): string {
	const event = toZonedTime(iso, viewerTz);
	const today = toZonedTime(new Date().toISOString(), viewerTz);
	const startOfEvent = new Date(
		event.getFullYear(),
		event.getMonth(),
		event.getDate(),
	);
	const startOfToday = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
	);
	const diffDays = Math.round(
		(startOfEvent.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
	);
	if (diffDays === 0) return `Today · ${formatBase(event, "EEE, MMM d")}`;
	if (diffDays === 1) return `Tomorrow · ${formatBase(event, "EEE, MMM d")}`;
	if (diffDays === -1) return `Yesterday · ${formatBase(event, "EEE, MMM d")}`;
	return formatBase(event, "EEEE, MMMM d");
}

/** "in 2 hours", "in 30 min", "tomorrow at 9 AM" — for upcoming-strip. */
export function formatRelativeWhen(iso: string, eventTimeZone: string): string {
	const now = Date.now();
	const eventMs = new Date(iso).getTime();
	const diffMin = Math.round((eventMs - now) / 60000);
	if (diffMin < 0) return "Started";
	if (diffMin < 60) return `In ${diffMin} min`;
	const diffHours = Math.round(diffMin / 60);
	if (diffHours < 24)
		return `In ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
	const diffDays = Math.round(diffHours / 24);
	if (diffDays === 1) {
		return `Tomorrow, ${formatInTimeZone(iso, eventTimeZone, "h:mm a")}`;
	}
	return formatInTimeZone(iso, eventTimeZone, "EEE, MMM d 'at' h:mm a");
}
