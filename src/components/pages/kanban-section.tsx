import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	KanbanCard,
	KanbanColumn,
	KanbanConfig,
	KanbanData,
} from "~/lib/kanban/types";
import { useKanbanDrag } from "~/lib/kanban/use-kanban-drag";
import { EventEditModal } from "./event-edit-modal";
import { KanbanCardModal } from "./kanban-card-modal";
import { KanbanShortcutsDialog } from "./kanban-shortcuts-dialog";

interface Props {
	config: KanbanConfig;
	data: KanbanData | null;
	serviceSlug: string;
	sectionIndex: number;
}

interface InnerProps extends Omit<Props, "data"> {
	data: KanbanData;
}

const PRIORITY_STYLES = {
	urgent: "bg-[var(--danger-muted)] text-[var(--danger)]",
	high: "bg-[var(--warning-muted)] text-[var(--warning)]",
	medium: "bg-[var(--accent-muted)] text-[var(--accent)]",
	low: "bg-[var(--surface-3)] text-[var(--fg-muted)]",
} as const;

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		const handler = () => setIsMobile(mq.matches);
		handler();
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return isMobile;
}

function buildCardAriaLabel(card: KanbanCard): string {
	const parts = [card.title];
	if (card.priority) parts.push(`Priority: ${card.priority}`);
	if (card.assignee) parts.push(`Assigned to ${card.assignee.name}`);
	if (card.department) {
		parts.push(`Department: ${card.department.name}`);
		if (card.department.teamName)
			parts.push(`Team: ${card.department.teamName}`);
	}
	if (card.labels?.length)
		parts.push(`Labels: ${card.labels.map((l) => l.text).join(", ")}`);
	if (card.progress != null) parts.push(`Progress: ${card.progress}%`);
	return `${parts.join(". ")}.`;
}

function CardAvatar({ name, avatar }: { name: string; avatar?: string }) {
	const initials = name
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	if (avatar) {
		return (
			<img
				src={avatar}
				alt={name}
				title={name}
				className="h-5 w-5 rounded-full border-2 border-(--surface-2) object-cover"
			/>
		);
	}
	return (
		<span
			title={name}
			className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-(--surface-2) bg-(--surface-3) text-[8px] font-medium text-(--fg-muted)"
		>
			{initials}
		</span>
	);
}

export function KanbanSection(props: Props) {
	if (!props.data || !Array.isArray(props.data.columns)) {
		return (
			<section className="rounded-lg border border-(--border) bg-(--surface-1) p-8 text-center">
				<h3 className="text-base font-medium text-(--fg)">
					{props.config.title ?? "Board"}
				</h3>
				<p className="mt-2 text-sm text-(--fg-muted)">
					Couldn't load board data. The service may be unavailable.
				</p>
			</section>
		);
	}
	return <KanbanBoard {...props} data={props.data} />;
}

function KanbanBoard({ config, data, serviceSlug }: InnerProps) {
	const router = useRouter();
	const isMobile = useIsMobile();
	const drag = useKanbanDrag((msg) => console.warn("[kanban]", msg));

	const cancelCardDrag = drag.cancelCardDrag;
	const cancelColumnDrag = drag.cancelColumnDrag;

	const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const dropHandledRef = useRef(false);

	useEffect(() => {
		cancelCardDrag();
		cancelColumnDrag();

		if (selectedCard && data.cards) {
			const fresh = data.cards.find((c) => c.id === selectedCard.id);
			if (fresh) setSelectedCard(fresh);
			else setSelectedCard(null);
		}
	}, [data, selectedCard, cancelCardDrag, cancelColumnDrag]);
	const [activeTab, setActiveTab] = useState<string | null>(null);

	const [moveMode, setMoveMode] = useState<{
		cardId: string;
		columnIndex: number;
	} | null>(null);

	const [focusCoords, setFocusCoords] = useState<[number, number]>([0, 0]);
	const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
	const boardRef = useRef<HTMLDivElement>(null);

	const [liveMessage, setLiveMessage] = useState("");

	const [dropIndicator, setDropIndicator] = useState<{
		columnId: string;
		position: number;
	} | null>(null);
	const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

	const boardData = data;

	const departmentOptions = useMemo(() => {
		const createForm = data._links?.createForm;
		if (!createForm || !("fields" in createForm)) return [];
		const fields = createForm.fields as Array<{
			key: string;
			options?: Array<{ value: string; label: string }>;
		}>;
		const deptField = fields.find((f) => f.key === "departmentId");
		return deptField?.options ?? [];
	}, [data._links?.createForm]);

	const departmentTeams = useMemo(
		() => data._meta?.departmentTeams ?? {},
		[data],
	);

	const departmentMembers = useMemo(
		() => data._meta?.departmentMembers ?? {},
		[data],
	);

	const sortedColumns = useMemo(() => {
		const cols = [...data.columns].sort((a, b) => a.position - b.position);
		if (drag.columnOrder) {
			return drag.columnOrder
				.map((id) => cols.find((c) => c.id === id))
				.filter((c): c is KanbanColumn => !!c);
		}
		return cols;
	}, [data.columns, drag.columnOrder]);

	const columnCards = useMemo(() => {
		const buckets = new Map<string, KanbanCard[]>();
		for (const col of sortedColumns) {
			buckets.set(col.id, []);
		}

		for (const card of data.cards) {
			const draft = drag.cardDrafts.get(card.id);
			const effectiveColumnId = draft ? draft.columnId : card.columnId;
			const effectivePosition = draft ? draft.position : card.position;
			const bucket = buckets.get(effectiveColumnId);
			if (bucket) {
				bucket.push({
					...card,
					columnId: effectiveColumnId,
					position: effectivePosition,
				});
			}
		}

		for (const [, cards] of buckets) {
			cards.sort((a, b) => a.position - b.position);
		}
		return buckets;
	}, [data.cards, sortedColumns, drag.cardDrafts]);

	useEffect(() => {
		if (isMobile && !activeTab && sortedColumns.length > 0) {
			setActiveTab(sortedColumns[0].id);
		}
	}, [isMobile, activeTab, sortedColumns]);

	// Last column is treated as the "done" column (used for M→done shortcut).
	const doneColumnId =
		sortedColumns.length > 0
			? sortedColumns[sortedColumns.length - 1].id
			: null;

	const canCreate = !!data._links?.create;
	const canReorderColumns = !!data._links?.reorderColumns;

	const focusCard = useCallback(
		(colIdx: number, cardIdx: number) => {
			const col = sortedColumns[colIdx];
			if (!col) return;
			const cards = columnCards.get(col.id) ?? [];
			const clamped = Math.max(0, Math.min(cardIdx, cards.length - 1));
			const card = cards[clamped];
			if (card) {
				setFocusCoords([colIdx, clamped]);
				cardRefs.current.get(card.id)?.focus();
			}
		},
		[sortedColumns, columnCards],
	);

	const activateCard = useCallback(
		(card: KanbanCard) => {
			if (card.link) {
				router.navigate({ to: card.link });
			} else {
				setSelectedCard(card);
			}
		},
		[router],
	);

	const handleBoardKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const [colIdx, cardIdx] = focusCoords;
			const tag = (e.target as HTMLElement).tagName;
			const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

			if (e.key === "?" && !isInput) {
				e.preventDefault();
				setShortcutsOpen(true);
				return;
			}

			if (moveMode) {
				if (e.key === "Escape") {
					e.preventDefault();
					setMoveMode(null);
					setLiveMessage("Move cancelled.");
					return;
				}
				if (e.key === "ArrowLeft") {
					e.preventDefault();
					const newIdx = Math.max(0, moveMode.columnIndex - 1);
					setMoveMode({ ...moveMode, columnIndex: newIdx });
					setLiveMessage(
						`Column: ${sortedColumns[newIdx]?.label ?? "unknown"}`,
					);
					return;
				}
				if (e.key === "ArrowRight") {
					e.preventDefault();
					const newIdx = Math.min(
						sortedColumns.length - 1,
						moveMode.columnIndex + 1,
					);
					setMoveMode({ ...moveMode, columnIndex: newIdx });
					setLiveMessage(
						`Column: ${sortedColumns[newIdx]?.label ?? "unknown"}`,
					);
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					const targetCol = sortedColumns[moveMode.columnIndex];
					const card = boardData.cards.find((c) => c.id === moveMode.cardId);
					if (
						targetCol &&
						card?.columnId !== targetCol.id &&
						card?._links?.update
					) {
						const targetCards = columnCards.get(targetCol.id) ?? [];
						const newPos = targetCards.length;
						drag.beginCardDrag(card);
						drag.previewCardMove(targetCol.id, newPos);
						drag.commitCardDrag(serviceSlug, card._links.update).then((ok) => {
							if (ok) {
								setLiveMessage(
									`Moved ${card.title} to ${targetCol.label} at position ${newPos + 1}.`,
								);
								router.invalidate();
							}
						});
					}
					setMoveMode(null);
					return;
				}
				return;
			}

			if (e.key === "m" || e.key === "M") {
				if (isInput) return;
				e.preventDefault();
				const col = sortedColumns[colIdx];
				const cards = col ? (columnCards.get(col.id) ?? []) : [];
				const card = cards[cardIdx];
				if (card?._links?.update) {
					const currentColIdx = sortedColumns.findIndex(
						(c) => c.id === card.columnId,
					);
					setMoveMode({
						cardId: card.id,
						columnIndex: currentColIdx >= 0 ? currentColIdx : colIdx,
					});
					setLiveMessage(
						`Move mode. Use left/right arrows to pick a column, Enter to confirm, Escape to cancel. Current: ${col?.label ?? "unknown"}.`,
					);
				}
				return;
			}

			if (e.key === "ArrowDown") {
				e.preventDefault();
				const col = sortedColumns[colIdx];
				const cards = col ? (columnCards.get(col.id) ?? []) : [];
				if (cardIdx < cards.length - 1) focusCard(colIdx, cardIdx + 1);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				if (cardIdx > 0) focusCard(colIdx, cardIdx - 1);
				return;
			}
			if (e.key === "ArrowRight") {
				e.preventDefault();
				if (colIdx < sortedColumns.length - 1) focusCard(colIdx + 1, cardIdx);
				return;
			}
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				if (colIdx > 0) focusCard(colIdx - 1, cardIdx);
				return;
			}
			if (e.key === "Home") {
				e.preventDefault();
				focusCard(colIdx, 0);
				return;
			}
			if (e.key === "End") {
				e.preventDefault();
				const col = sortedColumns[colIdx];
				const cards = col ? (columnCards.get(col.id) ?? []) : [];
				focusCard(colIdx, cards.length - 1);
				return;
			}

			if (e.key === "Enter" || e.key === " ") {
				if (isInput) return;
				e.preventDefault();
				const col = sortedColumns[colIdx];
				const cards = col ? (columnCards.get(col.id) ?? []) : [];
				const card = cards[cardIdx];
				if (card) activateCard(card);
				return;
			}

			if (e.key === "Escape") {
				if (shortcutsOpen) setShortcutsOpen(false);
				return;
			}
		},
		[
			focusCoords,
			moveMode,
			sortedColumns,
			columnCards,
			boardData.cards,
			drag,
			serviceSlug,
			router,
			focusCard,
			activateCard,
			shortcutsOpen,
		],
	);

	function onCardDragStart(e: React.DragEvent, card: KanbanCard) {
		if (!card._links?.update) {
			e.preventDefault();
			return;
		}
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", card.id);
		drag.beginCardDrag(card);
		const col = sortedColumns.find((c) => c.id === card.columnId);
		setLiveMessage(
			`Grabbed ${card.title}. Current column: ${col?.label ?? "unknown"}. Arrow keys to move, Enter to drop, Escape to cancel.`,
		);
	}

	function onCardDragEnd() {
		if (dropHandledRef.current) {
			dropHandledRef.current = false;
			return;
		}
		if (drag.draggedCardId) {
			const card = boardData.cards.find((c) => c.id === drag.draggedCardId);
			const col = sortedColumns.find((c) => c.id === card?.columnId);
			drag.cancelCardDrag();
			setDropIndicator(null);
			setDragOverColumn(null);
			setLiveMessage(
				`Drag cancelled. ${card?.title ?? "Card"} returned to ${col?.label ?? "original column"}.`,
			);
		}
	}

	function onColumnDragOver(e: React.DragEvent, columnId: string) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverColumn(columnId);

		if (!drag.draggedCardId) return;

		const colEl = e.currentTarget as HTMLElement;
		const cardEls = colEl.querySelectorAll("[data-card-id]");
		let position = 0;
		for (const el of cardEls) {
			const rect = el.getBoundingClientRect();
			if (e.clientY > rect.top + rect.height / 2) {
				position++;
			}
		}
		setDropIndicator({ columnId, position });
		drag.previewCardMove(columnId, position);

		const col = sortedColumns.find((c) => c.id === columnId);
		const cards = columnCards.get(columnId) ?? [];
		setLiveMessage(
			`Moved to ${col?.label ?? "unknown"}, position ${position + 1} of ${cards.length + 1}.`,
		);
	}

	function onColumnDragLeave(e: React.DragEvent) {
		const relatedTarget = e.relatedTarget as HTMLElement | null;
		if (!e.currentTarget.contains(relatedTarget)) {
			setDragOverColumn(null);
			setDropIndicator(null);
		}
	}

	async function onColumnDrop(e: React.DragEvent, columnId: string) {
		e.preventDefault();
		setDragOverColumn(null);
		setDropIndicator(null);
		dropHandledRef.current = true;

		if (drag.draggedCardId) {
			const card = boardData.cards.find((c) => c.id === drag.draggedCardId);
			if (card?._links?.update) {
				const draft = drag.cardDrafts.get(card.id);
				const col = sortedColumns.find((c) => c.id === columnId);
				const ok = await drag.commitCardDrag(serviceSlug, card._links.update);
				if (ok) {
					setLiveMessage(
						`Dropped ${card.title} in ${col?.label ?? "unknown"} at position ${(draft?.position ?? 0) + 1}.`,
					);
					// Drafts are cleared by the useEffect on `data` when fresh data
					// arrives, not here — doing it now would cause a snap-back gap.
					router.invalidate();
				}
			} else {
				drag.cancelCardDrag();
			}
			return;
		}

		if (drag.draggedColumnId && boardData._links?.reorderColumns) {
			const col = sortedColumns.find((c) => c.id === drag.draggedColumnId);
			const ok = await drag.commitColumnDrag(
				serviceSlug,
				boardData._links.reorderColumns,
			);
			if (ok) {
				setLiveMessage(`Column ${col?.label ?? "unknown"} reordered.`);
				router.invalidate();
			}
		}
	}

	function onColumnHeaderDragStart(e: React.DragEvent, columnId: string) {
		if (!canReorderColumns) {
			e.preventDefault();
			return;
		}
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", `col:${columnId}`);
		drag.beginColumnDrag(
			columnId,
			sortedColumns.map((c) => c.id),
		);
	}

	function onColumnHeaderDragOver(e: React.DragEvent, colIndex: number) {
		if (!drag.draggedColumnId) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		drag.previewColumnMove(colIndex);
	}

	function onColumnHeaderDragEnd() {
		if (dropHandledRef.current) {
			dropHandledRef.current = false;
			return;
		}
		if (drag.draggedColumnId) drag.cancelColumnDrag();
	}

	async function moveCardToColumn(card: KanbanCard, newColumnId: string) {
		if (!card._links?.update || newColumnId === card.columnId) return;
		const targetCards = columnCards.get(newColumnId) ?? [];
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}${card._links.update}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						columnId: newColumnId,
						position: targetCards.length,
					}),
				},
			);
			if (!res.ok) throw new Error(`Move failed (${res.status})`);
			router.invalidate();
		} catch (err) {
			console.warn("[kanban] move failed:", (err as Error).message);
		}
	}

	function renderCard(
		card: KanbanCard,
		colIndex: number,
		cardIndex: number,
		isDoneColumn: boolean,
	) {
		const isFocused =
			focusCoords[0] === colIndex && focusCoords[1] === cardIndex;
		const isDragging = drag.draggedCardId === card.id;
		const isDraggable = !!card._links?.update;
		const allAvatars = [
			...(card.assignee ? [card.assignee] : []),
			...(card.collaborators ?? []),
		];
		const visibleAvatars = allAvatars.slice(0, 4);
		const overflowCount = Math.max(0, allAvatars.length - 4);

		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: drag wrapper needs native drop events to propagate to parent column.
			<div
				key={card.id}
				onDragOver={(e) => e.preventDefault()}
				onDrop={(e) => e.preventDefault()}
			>
				<button
					type="button"
					ref={(el) => {
						if (el) cardRefs.current.set(card.id, el);
						else cardRefs.current.delete(card.id);
					}}
					data-card-id={card.id}
					tabIndex={isFocused ? 0 : -1}
					aria-label={buildCardAriaLabel(card)}
					aria-describedby="kanban-instructions"
					aria-grabbed={isDragging ? true : undefined}
					draggable={isDraggable && !isMobile}
					onDragStart={(e) => onCardDragStart(e, card)}
					onDragEnd={onCardDragEnd}
					onDragOver={(e) => e.preventDefault()}
					onClick={() => activateCard(card)}
					onFocus={() => setFocusCoords([colIndex, cardIndex])}
					className={[
						"w-full cursor-pointer rounded-(--radius) border p-3 text-left transition-[border-color,box-shadow,opacity]",
						"motion-reduce:transition-none",
						"bg-(--surface-2) border-(--border)",
						"hover:border-(--border-strong) hover:shadow-(--shadow-1)",
						"focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2",
						isDragging ? "opacity-40" : "",
						isDoneColumn && !isDragging ? "opacity-60" : "",
					]
						.filter(Boolean)
						.join(" ")}
				>
					{card.department && (
						<div className="mb-1 flex items-center gap-1 text-[10px] text-(--fg-muted)">
							<span
								aria-hidden="true"
								className="inline-block h-1.5 w-1.5 rounded-full bg-(--accent)"
							/>
							<span>
								{card.department.name}
								{card.department.teamName && ` · ${card.department.teamName}`}
							</span>
						</div>
					)}

					<div className="text-[13px] font-medium leading-snug text-(--fg)">
						{card.title}
					</div>

					{card.description && (
						<p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-(--fg-muted)">
							{card.description}
						</p>
					)}

					{card.labels && card.labels.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{card.labels.map((label) =>
								label.color ? (
									<span
										key={label.text}
										className="rounded px-1.5 py-0.5 text-[10px] font-medium"
										style={{
											backgroundColor: `${label.color}22`,
											color: label.color,
										}}
									>
										{label.text}
									</span>
								) : (
									<span
										key={label.text}
										className="rounded bg-(--surface-3) px-1.5 py-0.5 text-[10px] font-medium text-(--fg-muted)"
									>
										{label.text}
									</span>
								),
							)}
						</div>
					)}

					{card.progress != null && (
						<div className="mt-2">
							<div className="flex items-center gap-2">
								<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--surface-3)">
									<div
										className="h-full rounded-full"
										style={{
											width: `${card.progress}%`,
											backgroundColor:
												card.progress >= 80
													? "var(--success)"
													: "var(--accent)",
										}}
									/>
								</div>
								<span className="text-[10px] tabular-nums text-(--fg-muted)">
									{card.progress}%
								</span>
							</div>
						</div>
					)}

					{(allAvatars.length > 0 || card.priority) && (
						<div className="mt-2 flex items-center justify-between">
							<div className="flex -space-x-1.5">
								{visibleAvatars.map((person) => (
									<CardAvatar
										key={person.name}
										name={person.name}
										avatar={person.avatar}
									/>
								))}
								{overflowCount > 0 && (
									<span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-(--surface-2) bg-(--surface-3) text-[8px] text-(--fg-muted)">
										+{overflowCount}
									</span>
								)}
							</div>

							{card.priority && (
								<span
									className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_STYLES[card.priority]}`}
								>
									{card.priority}
								</span>
							)}
						</div>
					)}

					{isMobile && card._links?.update && sortedColumns.length > 1 && (
						<div className="mt-2 border-t border-(--border) pt-2">
							<select
								aria-label={`Move "${card.title}" to column`}
								value={card.columnId}
								onClick={(e) => e.stopPropagation()}
								onChange={(e) => {
									e.stopPropagation();
									moveCardToColumn(card, e.target.value);
								}}
								className="w-full rounded-(--radius) border border-(--border) bg-(--surface-1) px-2 py-1.5 text-xs text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
							>
								{sortedColumns.map((col) => (
									<option key={col.id} value={col.id}>
										{col.id === card.columnId
											? `${col.label} (current)`
											: `Move to ${col.label}`}
									</option>
								))}
							</select>
						</div>
					)}
				</button>

				{moveMode?.cardId === card.id && (
					<div className="mt-1 rounded-(--radius) border border-(--accent) bg-(--accent-muted) px-2 py-1 text-[11px] text-(--accent)">
						Move to:{" "}
						<strong>{sortedColumns[moveMode.columnIndex]?.label}</strong>
						<span className="ml-2 text-(--fg-muted)">
							← → pick · Enter confirm · Esc cancel
						</span>
					</div>
				)}
			</div>
		);
	}

	function renderColumn(col: KanbanColumn, colIndex: number) {
		const cards = columnCards.get(col.id) ?? [];
		const isDoneColumn = col.id === doneColumnId;
		const isColumnDragging = drag.draggedColumnId === col.id;
		const isDropTarget =
			dragOverColumn === col.id && drag.draggedCardId != null;

		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: drop zone wrapping the column cards.
			<div
				key={col.id}
				className={[
					"group flex w-72 shrink-0 flex-col rounded-lg border bg-(--surface-1)",
					"transition-[border-color,opacity] motion-reduce:transition-none",
					isDropTarget
						? "border-(--accent)/50 bg-(--accent-muted)"
						: "border-(--border)",
					isColumnDragging ? "opacity-40" : "",
				]
					.filter(Boolean)
					.join(" ")}
				style={{ maxHeight: "calc(100vh - 200px)" }}
				onDragOver={(e) => onColumnDragOver(e, col.id)}
				onDragLeave={onColumnDragLeave}
				onDrop={(e) => onColumnDrop(e, col.id)}
			>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: header drag handle for column reorder. */}
				<div
					draggable={canReorderColumns}
					onDragStart={(e) => onColumnHeaderDragStart(e, col.id)}
					onDragOver={(e) => onColumnHeaderDragOver(e, colIndex)}
					onDragEnd={onColumnHeaderDragEnd}
					className={[
						"flex items-center gap-2 border-b border-(--border) px-3 py-2.5",
						canReorderColumns ? "cursor-grab active:cursor-grabbing" : "",
					].join(" ")}
				>
					{col.color && (
						<span
							aria-hidden="true"
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ backgroundColor: col.color }}
						/>
					)}
					<span className="text-[13px] font-semibold text-(--fg)">
						{col.label}
					</span>
					<span className="ml-auto rounded-full bg-(--surface-3) px-2 py-0.5 text-[10px] tabular-nums text-(--fg-muted)">
						{cards.length}
					</span>
					{canReorderColumns && (
						<button
							type="button"
							title="Delete column"
							onClick={async (e) => {
								e.stopPropagation();
								const hasCards = cards.length > 0;
								const msg = hasCards
									? `Delete "${col.label}" and its ${cards.length} card(s)?`
									: `Delete "${col.label}"?`;
								if (!window.confirm(msg)) return;
								const slug =
									((boardData as Record<string, unknown>).slug as string) ?? "";
								await fetch(
									`/api/proxy/${serviceSlug}/api/boards/${slug}/columns/${col.id}`,
									{ method: "DELETE", credentials: "include" },
								);
								await router.invalidate();
							}}
							className="ml-1 rounded p-0.5 text-(--fg-subtle) opacity-0 transition-opacity hover:text-(--danger) group-hover:opacity-100 focus-visible:opacity-100"
						>
							×
						</button>
					)}
				</div>

				{/* biome-ignore lint/a11y/noStaticElementInteractions: drag plumbing — cards inside are the interactive elements. */}
				<div
					className="flex-1 space-y-2 overflow-y-auto p-2"
					onDragOver={(e) => e.preventDefault()}
				>
					{cards.length === 0 ? (
						<p className="py-6 text-center text-xs text-(--fg-subtle)">
							No cards yet
						</p>
					) : (
						cards.map((card, cardIndex) => (
							<div key={card.id}>
								{dropIndicator?.columnId === col.id &&
									dropIndicator.position === cardIndex && (
										<div className="mx-1 mb-1 h-0.5 rounded-full bg-(--accent)" />
									)}
								{renderCard(card, colIndex, cardIndex, isDoneColumn)}
							</div>
						))
					)}
					{dropIndicator?.columnId === col.id &&
						dropIndicator.position >= cards.length && (
							<div className="mx-1 mt-1 h-0.5 rounded-full bg-(--accent)" />
						)}
				</div>
			</div>
		);
	}

	function renderMobile() {
		const currentTab = activeTab ?? sortedColumns[0]?.id;
		const currentColumn = sortedColumns.find((c) => c.id === currentTab);
		const colIndex = sortedColumns.findIndex((c) => c.id === currentTab);
		const cards = currentColumn
			? (columnCards.get(currentColumn.id) ?? [])
			: [];
		const isDoneColumn = currentColumn?.id === doneColumnId;

		return (
			<div>
				<div
					className="flex gap-1 overflow-x-auto border-b border-(--border) px-2 py-1"
					role="tablist"
					aria-label="Board columns"
				>
					{sortedColumns.map((col) => {
						const colCards = columnCards.get(col.id) ?? [];
						const isActive = col.id === currentTab;
						return (
							<button
								key={col.id}
								type="button"
								role="tab"
								aria-selected={isActive}
								aria-controls={`kanban-tabpanel-${col.id}`}
								onClick={() => setActiveTab(col.id)}
								className={[
									"flex shrink-0 items-center gap-1.5 rounded-t-(--radius) px-3 py-2 text-xs font-medium",
									"transition-colors motion-reduce:transition-none",
									"focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)",
									isActive
										? "border-b-2 border-(--accent) text-(--fg)"
										: "text-(--fg-muted) hover:text-(--fg)",
								].join(" ")}
							>
								{col.color && (
									<span
										aria-hidden="true"
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: col.color }}
									/>
								)}
								{col.label}
								<span className="rounded-full bg-(--surface-3) px-1.5 py-0.5 text-[10px] tabular-nums">
									{colCards.length}
								</span>
							</button>
						);
					})}
				</div>

				<div
					id={`kanban-tabpanel-${currentTab}`}
					role="tabpanel"
					aria-label={currentColumn?.label ?? "Cards"}
					className="space-y-2 p-3"
				>
					{cards.length === 0 ? (
						<p className="py-8 text-center text-sm text-(--fg-subtle)">
							No cards yet
						</p>
					) : (
						cards.map((card, cardIndex) =>
							renderCard(card, colIndex, cardIndex, isDoneColumn ?? false),
						)
					)}
				</div>
			</div>
		);
	}

	return (
		<section className="rounded-lg border border-(--border) bg-(--surface-1)">
			<div id="kanban-instructions" className="sr-only">
				Press Enter to open details. Press M to move. Press ? for all shortcuts.
			</div>

			<div aria-live="polite" aria-atomic="true" className="sr-only">
				{liveMessage}
			</div>

			<header className="flex items-center justify-between border-b border-(--border) px-5 py-4">
				<h2 className="text-base font-semibold text-(--fg)">
					{config.title ?? "Board"}
				</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShortcutsOpen(true)}
						aria-label="Keyboard shortcuts"
						title="Keyboard shortcuts"
						className="rounded-(--radius) border border-(--border) px-2 py-1 text-xs text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 active:bg-(--surface-3)"
					>
						?
					</button>
					{canCreate && (
						<button
							type="button"
							onClick={() => setCreating(true)}
							className="rounded-(--radius) bg-(--accent) px-3 py-1.5 text-xs font-medium text-(--accent-fg) hover:bg-(--accent-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 active:opacity-90"
						>
							+ New card
						</button>
					)}
				</div>
			</header>

			{isMobile ? (
				renderMobile()
			) : (
				// biome-ignore lint/a11y/noStaticElementInteractions: board container handles keyboard navigation across cards.
				<div
					ref={boardRef}
					onKeyDown={handleBoardKeyDown}
					className="flex gap-4 overflow-x-auto p-4"
				>
					{sortedColumns.map((col, i) => renderColumn(col, i))}
					{boardData?._links?.addColumn && (
						<button
							type="button"
							onClick={async () => {
								const label = window.prompt("Column name:");
								if (!label?.trim()) return;
								await fetch(
									`/api/proxy/${serviceSlug}${boardData._links!.addColumn}`,
									{
										method: "POST",
										headers: { "Content-Type": "application/json" },
										credentials: "include",
										body: JSON.stringify({ label: label.trim() }),
									},
								);
								router.invalidate();
							}}
							className="flex h-10 w-72 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-(--border) text-xs text-(--fg-muted) hover:border-(--border-strong) hover:text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
						>
							+ Add column
						</button>
					)}
				</div>
			)}

			<KanbanShortcutsDialog
				open={shortcutsOpen}
				onClose={() => setShortcutsOpen(false)}
			/>

			{selectedCard && (
				<KanbanCardModal
					card={selectedCard}
					columns={sortedColumns}
					serviceSlug={serviceSlug}
					boardSlug={
						((boardData as Record<string, unknown>).slug as string) ?? ""
					}
					departmentOptions={departmentOptions}
					departmentTeams={departmentTeams}
					departmentMembers={departmentMembers}
					onClose={() => {
						const cardId = selectedCard.id;
						setSelectedCard(null);
						// Focus restoration: return focus to the card that opened the modal
						requestAnimationFrame(() => {
							cardRefs.current.get(cardId)?.focus();
						});
					}}
				/>
			)}

			{creating && data._links?.createForm && (
				<EventEditModal
					createUrl={data._links.create}
					formConfig={data._links.createForm}
					serviceSlug={serviceSlug}
					heading="New card"
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
