// dashboard/src/lib/schedule/use-window.ts
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

export interface ScheduleWindow {
	from: Date;
	to: Date;
}

/**
 * Returns the current visible window for a calendar section, plus a setter
 * that updates URL state. The `sectionKey` is typically `cal0`/`cal1`/... —
 * the calling section component derives it from its index in the page.
 *
 * If the URL has no entry for this key, falls back to the supplied initial.
 */
export function useScheduleWindow(
	sectionKey: string,
	initial: ScheduleWindow,
): {
	window: ScheduleWindow;
	setWindow: (next: ScheduleWindow) => void;
} {
	const search = useSearch({ strict: false }) as Record<
		string,
		string | undefined
	>;
	const navigate = useNavigate();

	// biome-ignore lint/correctness/useExhaustiveDependencies: initial is a fresh object every render; depending on it would loop.
	const window = useMemo<ScheduleWindow>(() => {
		const fromKey = `${sectionKey}_from`;
		const toKey = `${sectionKey}_to`;
		const fromRaw = search[fromKey];
		const toRaw = search[toKey];
		if (fromRaw && toRaw) {
			const from = new Date(fromRaw);
			const to = new Date(toRaw);
			if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
				return { from, to };
			}
		}
		return initial;
	}, [search, sectionKey]);

	const setWindow = useCallback(
		(next: ScheduleWindow) => {
			navigate({
				search: ((prev: Record<string, unknown>) => ({
					...prev,
					[`${sectionKey}_from`]: next.from.toISOString(),
					[`${sectionKey}_to`]: next.to.toISOString(),
					// biome-ignore lint/suspicious/noExplicitAny: TanStack search typing is route-specific; this hook is route-agnostic.
				})) as any,
				replace: false,
			});
		},
		[navigate, sectionKey],
	);

	return { window, setWindow };
}
