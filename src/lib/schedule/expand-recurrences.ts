// dashboard/src/lib/schedule/expand-recurrences.ts
import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { RRule as RRuleType } from "rrule";
// rrule v2.8.1 ships BOTH a CJS build (`dist/es5/rrule.js` via `main`) and an
// ESM build with proper named exports (`dist/esm/index.js` via `module`). Vite
// sometimes picks the CJS entry which causes "Named export 'rrulestr' not
// found" at runtime. Importing from the explicit ESM subpath bypasses Vite's
// package-field heuristics and always gives us the ESM build with named
// exports.
import { rrulestr } from "rrule/dist/esm/index.js";
import type { ScheduleEvent } from "./types";

interface Window {
	from: Date;
	to: Date;
}

/**
 * Given an array of events (some with rrule, some without) and a visible
 * window, return a flat array of concrete occurrences whose [start, end]
 * intersects the window. Non-recurring events that fall outside the window
 * are filtered out so callers don't have to.
 */
export function expandRecurrences(
	events: ScheduleEvent[],
	window: Window,
): ScheduleEvent[] {
	const out: ScheduleEvent[] = [];
	for (const ev of events) {
		if (!ev.rrule) {
			if (eventOverlapsWindow(ev, window)) out.push(ev);
			continue;
		}
		out.push(...expandOne(ev, window));
	}
	return out;
}

function eventOverlapsWindow(ev: ScheduleEvent, window: Window): boolean {
	const start = new Date(ev.start).getTime();
	const end = new Date(ev.end).getTime();
	return end >= window.from.getTime() && start <= window.to.getTime();
}

function expandOne(ev: ScheduleEvent, window: Window): ScheduleEvent[] {
	const startUtc = fromZonedTime(ev.start, ev.timezone);
	const endUtc = fromZonedTime(ev.end, ev.timezone);
	const durationMs = endUtc.getTime() - startUtc.getTime();
	const exdates = (ev.exdates ?? []).map((iso) =>
		fromZonedTime(iso, ev.timezone).getTime(),
	);

	// rrule.js parses RRULE strings; we set DTSTART explicitly via the
	// `dtstart` option since the input string may not include it.
	let rule: RRuleType;
	try {
		rule = rrulestr(ev.rrule!, {
			dtstart: startUtc,
			forceset: false,
		}) as RRuleType;
	} catch (err) {
		console.warn(`[schedule] failed to parse rrule for event ${ev.id}:`, err);
		return eventOverlapsWindow(ev, window) ? [ev] : [];
	}

	// Expand a slightly wider window so events that start before window.from
	// but end inside the window are still picked up.
	const expandFrom = addDays(window.from, -7);
	const occurrences = rule.between(expandFrom, window.to, true);

	return occurrences
		.filter((occ) => !exdates.includes(occ.getTime()))
		.map((occ) => {
			const occStartUtc = occ;
			const occEndUtc = new Date(occ.getTime() + durationMs);
			const occStartLocal = toZonedTime(occStartUtc, ev.timezone);
			const occEndLocal = toZonedTime(occEndUtc, ev.timezone);
			return {
				...ev,
				// Stable per-occurrence id so React keys and edit links don't collide.
				id: `${ev.id}__${occStartUtc.getTime()}`,
				start: occStartLocal.toISOString(),
				end: occEndLocal.toISOString(),
				// Preserve the rrule on the original parent so update flows can
				// distinguish "edit this instance" from "edit the series".
				// The renderer treats expanded children as concrete events.
				rrule: undefined,
			};
		})
		.filter((occ) => eventOverlapsWindow(occ, window));
}
