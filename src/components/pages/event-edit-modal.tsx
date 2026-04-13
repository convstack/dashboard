import type { FormConfig } from "@convstack/service-sdk/types";
import { useEffect, useState } from "react";
import type { ScheduleEvent } from "~/lib/schedule/types";
import { ControlledFormSection } from "./form-section";

interface Props {
	/** Undefined means "create new event"; defined means "edit existing". */
	event?: ScheduleEvent;
	/** The _links.create URL from ScheduleData; required when event is undefined. */
	createUrl?: string;
	/** Form field config from _links.createForm / _links.editForm */
	formConfig: FormConfig;
	serviceSlug: string;
	onClose: () => void;
	/** Called after a successful save so the parent can refresh data. */
	onSaved: () => void;
	/** Override the modal heading. Defaults to "New event" / "Edit event" */
	heading?: string;
}

export function EventEditModal({
	event,
	createUrl,
	formConfig,
	serviceSlug,
	onClose,
	onSaved,
	heading,
}: Props) {
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	// Close on Escape key
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const isEdit = !!event;
	const title = heading ?? (isEdit ? "Edit event" : "New event");

	const handleSubmit = async (values: Record<string, unknown>) => {
		const url = isEdit ? event?._links?.update : createUrl;
		if (!url) {
			setError("No endpoint available for this action.");
			return;
		}

		setSubmitting(true);
		setError("");

		try {
			const res = await fetch(`/api/proxy/${serviceSlug}${url}`, {
				method: isEdit ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				setError(data?.error || `Error: ${res.status}`);
			} else {
				onSaved();
				onClose();
			}
		} catch {
			setError("Network error. Please try again.");
		}

		setSubmitting(false);
	};

	return (
		<>
			{/* Backdrop */}
			<button
				type="button"
				aria-label="Close modal"
				className="fixed inset-0 z-40 bg-black/50"
				onClick={onClose}
			/>

			{/* Dialog */}
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-3)]"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
					<h2 className="text-base font-semibold text-[var(--fg)]">{title}</h2>
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="rounded-[var(--radius)] p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
					>
						{/* Simple × glyph — no icon dependency */}
						<span aria-hidden="true" className="block text-lg leading-none">
							×
						</span>
					</button>
				</div>

				{/* Body */}
				<div
					className="overflow-y-auto px-5 py-4"
					style={{ maxHeight: "70vh" }}
				>
					{error && (
						<div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					)}
					<ControlledFormSection
						config={formConfig}
						initialData={event as Record<string, unknown> | undefined}
						onSubmit={handleSubmit}
						submitting={submitting}
						submitLabel={isEdit ? "Save changes" : "Create event"}
						serviceSlug={serviceSlug}
					/>
				</div>
			</div>
		</>
	);
}
