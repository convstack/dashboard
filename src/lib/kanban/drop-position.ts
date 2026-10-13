// Index among the column's other cards, which is what the service expects:
// the dragged card is still in the column's DOM while it is dragged, and
// counting it would land a downward drop one slot too far.
export function dropPosition(
	cardEls: Iterable<Element>,
	clientY: number,
	draggedCardId: string,
): number {
	let position = 0;
	for (const el of cardEls) {
		if (el.getAttribute("data-card-id") === draggedCardId) continue;
		const rect = el.getBoundingClientRect();
		if (clientY > rect.top + rect.height / 2) position++;
	}
	return position;
}
