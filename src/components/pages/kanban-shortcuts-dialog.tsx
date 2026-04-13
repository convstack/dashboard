import { useEffect } from "react";

interface Props {
	open: boolean;
	onClose: () => void;
}

const SHORTCUTS = [
	{
		section: "Navigation",
		items: [
			{ keys: "↑ / ↓", action: "Move between cards" },
			{ keys: "← / →", action: "Move between columns" },
			{ keys: "Home / End", action: "First / last card in column" },
			{ keys: "Tab", action: "Enter / leave board" },
		],
	},
	{
		section: "Actions",
		items: [
			{ keys: "Enter / Space", action: "Open card details" },
			{ keys: "M", action: "Move card to another column" },
			{ keys: "Escape", action: "Cancel / close" },
			{ keys: "?", action: "This dialog" },
		],
	},
	{
		section: "Drag (mouse)",
		items: [
			{ keys: "Drag card", action: "Move between columns / reorder" },
			{ keys: "Drag column header", action: "Reorder columns" },
		],
	},
];

export function KanbanShortcutsDialog({ open, onClose }: Props) {
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<>
			<button
				type="button"
				aria-label="Close shortcuts"
				className="fixed inset-0 z-40 bg-black/40"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Keyboard shortcuts"
				className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-(--border) bg-(--surface-2) p-5 shadow-(--shadow-3)"
			>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-(--fg)">
						Keyboard shortcuts
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-(--fg-muted) hover:text-(--fg)"
						aria-label="Close"
					>
						×
					</button>
				</div>
				{SHORTCUTS.map((group) => (
					<div key={group.section} className="mb-3">
						<div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--fg-subtle)">
							{group.section}
						</div>
						{group.items.map((item) => (
							<div
								key={item.keys}
								className="flex items-center justify-between py-1"
							>
								<span className="text-xs text-(--fg-muted)">{item.action}</span>
								<kbd className="rounded border border-(--border) bg-(--surface-1) px-1.5 py-0.5 text-[10px] font-mono text-(--fg)">
									{item.keys}
								</kbd>
							</div>
						))}
					</div>
				))}
			</div>
		</>
	);
}
