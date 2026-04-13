// dashboard/src/lib/kanban/use-kanban-drag.ts
import { useCallback, useState } from "react";
import type { KanbanCard } from "./types";

interface CardDraft {
	cardId: string;
	columnId: string;
	position: number;
}

interface UseDragResult {
	// Card drag
	draggedCardId: string | null;
	cardDrafts: Map<string, CardDraft>;
	beginCardDrag: (card: KanbanCard) => void;
	previewCardMove: (columnId: string, position: number) => void;
	commitCardDrag: (serviceSlug: string, updateUrl: string) => Promise<boolean>;
	cancelCardDrag: () => void;

	// Column drag
	draggedColumnId: string | null;
	columnOrder: string[] | null;
	beginColumnDrag: (columnId: string, currentOrder: string[]) => void;
	previewColumnMove: (position: number) => void;
	commitColumnDrag: (
		serviceSlug: string,
		reorderUrl: string,
	) => Promise<boolean>;
	cancelColumnDrag: () => void;
}

export function useKanbanDrag(onError?: (msg: string) => void): UseDragResult {
	// Card drag state
	const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
	const [cardDrafts, setCardDrafts] = useState<Map<string, CardDraft>>(
		new Map(),
	);

	// Column drag state
	const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
	const [columnOrder, setColumnOrder] = useState<string[] | null>(null);

	const beginCardDrag = useCallback((card: KanbanCard) => {
		setDraggedCardId(card.id);
		setCardDrafts(
			new Map([
				[
					card.id,
					{ cardId: card.id, columnId: card.columnId, position: card.position },
				],
			]),
		);
	}, []);

	const previewCardMove = useCallback(
		(columnId: string, position: number) => {
			if (!draggedCardId) return;
			setCardDrafts((prev) => {
				const next = new Map(prev);
				next.set(draggedCardId, { cardId: draggedCardId, columnId, position });
				return next;
			});
		},
		[draggedCardId],
	);

	const cancelCardDrag = useCallback(() => {
		setDraggedCardId(null);
		setCardDrafts(new Map());
	}, []);

	const commitCardDrag = useCallback(
		async (serviceSlug: string, updateUrl: string): Promise<boolean> => {
			const draft = cardDrafts.get(draggedCardId ?? "");
			if (!draft || !draggedCardId) {
				cancelCardDrag();
				return false;
			}
			try {
				const res = await fetch(`/api/proxy/${serviceSlug}${updateUrl}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						columnId: draft.columnId,
						position: draft.position,
					}),
				});
				if (!res.ok) {
					const text = await res.text().catch(() => "");
					throw new Error(text || `Move failed (${res.status})`);
				}
				// Don't clear optimistic state here — the caller clears it after
				// router.invalidate() completes so there's no snap-back between
				// "optimistic cleared" and "fresh data arrived".
				setDraggedCardId(null);
				return true;
			} catch (err) {
				onError?.(`Couldn't move card: ${(err as Error).message}`);
				cancelCardDrag();
				return false;
			}
		},
		[draggedCardId, cardDrafts, onError, cancelCardDrag],
	);

	const cancelColumnDrag = useCallback(() => {
		setDraggedColumnId(null);
		setColumnOrder(null);
	}, []);

	const beginColumnDrag = useCallback(
		(colId: string, currentOrder: string[]) => {
			setDraggedColumnId(colId);
			setColumnOrder([...currentOrder]);
		},
		[],
	);

	const previewColumnMove = useCallback(
		(position: number) => {
			if (!draggedColumnId || !columnOrder) return;
			setColumnOrder((prev) => {
				if (!prev) return prev;
				const next = prev.filter((id) => id !== draggedColumnId);
				next.splice(position, 0, draggedColumnId);
				return next;
			});
		},
		[draggedColumnId, columnOrder],
	);

	const commitColumnDrag = useCallback(
		async (serviceSlug: string, reorderUrl: string): Promise<boolean> => {
			if (!columnOrder) {
				cancelColumnDrag();
				return false;
			}
			try {
				const res = await fetch(`/api/proxy/${serviceSlug}${reorderUrl}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ order: columnOrder }),
				});
				if (!res.ok) throw new Error(`Reorder failed (${res.status})`);
				// Don't clear optimistic state — caller clears after invalidation.
				setDraggedColumnId(null);
				return true;
			} catch (err) {
				onError?.(`Couldn't reorder columns: ${(err as Error).message}`);
				cancelColumnDrag();
				return false;
			}
		},
		[columnOrder, onError, cancelColumnDrag],
	);

	return {
		draggedCardId,
		cardDrafts,
		beginCardDrag,
		previewCardMove,
		commitCardDrag,
		cancelCardDrag,
		draggedColumnId,
		columnOrder,
		beginColumnDrag,
		previewColumnMove,
		commitColumnDrag,
		cancelColumnDrag,
	};
}
