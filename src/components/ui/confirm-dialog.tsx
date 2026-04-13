import { useEffect, useRef } from "react";

interface Props {
	open: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	variant?: "default" | "danger";
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = "Confirm",
	variant = "default",
	onConfirm,
	onCancel,
}: Props) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		if (!dialogRef.current) return;

		if (open) {
			dialogRef.current.showModal();
		} else {
			dialogRef.current.close();
		}
	}, [open]);

	if (!open) {
		return null;
	}

	return (
		<dialog
			ref={dialogRef}
			onClose={onCancel}
			className="fixed inset-0 m-auto backdrop:bg-black/50 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-3)] p-6 space-y-4 min-w-[320px] max-w-md shadow-[var(--shadow-3)]"
		>
			<h2 className="text-lg font-semibold text-[var(--fg)]">{title}</h2>
			<p className="text-sm text-[var(--fg-muted)]">{message}</p>
			<div className="flex items-center justify-end gap-3 pt-2">
				<button
					type="button"
					onClick={onCancel}
					className="px-4 py-2 text-sm font-medium rounded-[var(--radius)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className={`px-4 py-2 text-sm font-medium rounded-[var(--radius)] transition-colors ${
						variant === "danger"
							? "bg-[var(--danger)] text-[var(--accent-fg)] hover:opacity-90"
							: "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
					}`}
				>
					{confirmLabel}
				</button>
			</div>
		</dialog>
	);
}
