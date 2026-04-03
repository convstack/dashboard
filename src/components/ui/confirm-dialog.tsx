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
			className="fixed inset-0 m-auto backdrop:bg-black/50 rounded-lg border border-(--border) bg-(--background) p-6 space-y-4 min-w-[320px] max-w-md shadow-lg"
		>
			<h2 className="text-lg font-semibold text-(--foreground)">{title}</h2>
			<p className="text-sm text-(--muted-foreground)">{message}</p>
			<div className="flex items-center justify-end gap-3 pt-2">
				<button
					type="button"
					onClick={onCancel}
					className="px-4 py-2 text-sm font-medium rounded-md border border-(--border) text-(--foreground) hover:bg-(--muted) transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
						variant === "danger"
							? "bg-red-600 hover:bg-red-700 text-white"
							: "bg-(--primary) text-(--primary-foreground) hover:opacity-90"
					}`}
				>
					{confirmLabel}
				</button>
			</div>
		</dialog>
	);
}
