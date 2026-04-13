// dashboard/src/lib/schedule/use-drag-to-move.ts
import { useCallback, useState } from "react";
import type { ScheduleEvent } from "./types";

interface MoveDelta {
	/** Minutes to shift the event by, positive or negative. */
	minutes: number;
	/** Optional new track id (for grid view track changes). */
	trackId?: string;
}

interface UseDragToMoveResult {
	/** Set of event ids currently held in optimistic state (drafts). */
	draftIds: Set<string>;
	/** Get the draft for an event, if any. */
	getDraft: (id: string) => ScheduleEvent | undefined;
	/** Begin a drag — call from onDragStart. */
	beginDrag: (event: ScheduleEvent) => void;
	/** Apply a delta during the drag — call from onDragOver / onMouseMove. */
	applyDelta: (id: string, delta: MoveDelta) => void;
	/** Commit the current draft — call from onDrop. PATCHes the update link. */
	commit: (id: string) => Promise<void>;
	/** Discard the draft (rollback). */
	cancel: (id: string) => void;
	/** Keyboard mode entered via the `M` key on a focused event. */
	keyboardMode: { id: string } | null;
	enterKeyboardMode: (event: ScheduleEvent) => void;
	exitKeyboardMode: () => void;
}

export function useDragToMove(
	onMoved?: (updated: ScheduleEvent) => void,
	onError?: (err: Error, event: ScheduleEvent) => void,
): UseDragToMoveResult {
	const [drafts, setDrafts] = useState<Map<string, ScheduleEvent>>(new Map());
	const [keyboardMode, setKeyboardMode] = useState<{ id: string } | null>(null);

	const beginDrag = useCallback((event: ScheduleEvent) => {
		setDrafts((prev) => {
			const next = new Map(prev);
			next.set(event.id, { ...event });
			return next;
		});
	}, []);

	const applyDelta = useCallback((id: string, delta: MoveDelta) => {
		setDrafts((prev) => {
			const draft = prev.get(id);
			if (!draft) return prev;
			const startMs = new Date(draft.start).getTime() + delta.minutes * 60_000;
			const endMs = new Date(draft.end).getTime() + delta.minutes * 60_000;
			const next = new Map(prev);
			next.set(id, {
				...draft,
				start: new Date(startMs).toISOString(),
				end: new Date(endMs).toISOString(),
				trackId: delta.trackId ?? draft.trackId,
			});
			return next;
		});
	}, []);

	const cancel = useCallback((id: string) => {
		setDrafts((prev) => {
			const next = new Map(prev);
			next.delete(id);
			return next;
		});
	}, []);

	const commit = useCallback(
		async (id: string) => {
			const draft = drafts.get(id);
			if (!draft) return;
			const updateUrl = draft._links?.update;
			if (!updateUrl) {
				cancel(id);
				return;
			}
			try {
				const res = await fetch(updateUrl, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						start: draft.start,
						end: draft.end,
						trackId: draft.trackId,
					}),
				});
				if (!res.ok) throw new Error(`PATCH ${updateUrl} → ${res.status}`);
				const updated = (await res.json()) as ScheduleEvent;
				setDrafts((prev) => {
					const next = new Map(prev);
					next.delete(id);
					return next;
				});
				onMoved?.(updated);
			} catch (err) {
				cancel(id);
				onError?.(err as Error, draft);
			}
		},
		[drafts, cancel, onMoved, onError],
	);

	return {
		draftIds: new Set(drafts.keys()),
		getDraft: (id) => drafts.get(id),
		beginDrag,
		applyDelta,
		commit,
		cancel,
		keyboardMode,
		enterKeyboardMode: (event) => setKeyboardMode({ id: event.id }),
		exitKeyboardMode: () => setKeyboardMode(null),
	};
}
