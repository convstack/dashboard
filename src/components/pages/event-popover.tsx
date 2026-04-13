import { useRouter } from "@tanstack/react-router";
import { format as formatDate } from "date-fns";
import { useEffect, useState } from "react";
import { formatEventTime } from "~/lib/schedule/format-time";
import type { ScheduleEvent } from "~/lib/schedule/types";
import { useTzPreference } from "~/lib/schedule/use-tz-preference";

interface Props {
	event: ScheduleEvent;
	/** Service slug for proxy URL construction. Required for publish/archive. */
	serviceSlug?: string;
	onClose: () => void;
	onEdit?: (event: ScheduleEvent) => void;
	onDelete?: (event: ScheduleEvent) => void;
}

export function EventPopover({
	event,
	serviceSlug,
	onClose,
	onEdit,
	onDelete,
}: Props) {
	const { mode } = useTzPreference();
	const router = useRouter();
	const [busy, setBusy] = useState<"publish" | "archive" | "request" | null>(
		null,
	);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const canEdit = !!event._links?.update && !!onEdit;
	const canDelete = !!event._links?.delete && !!onDelete;
	const canPublish = !!event._links?.publish && !!serviceSlug;
	const canArchive = !!event._links?.archive && !!serviceSlug;
	// Hide the Request button if the user already has an active assignment
	// (requested or approved). _meta.assignmentStatus is set by the schedule
	// service for the requesting user's own assignment status.
	const assignmentStatus = (event as Record<string, unknown>)?._meta
		? (((event as Record<string, unknown>)._meta as Record<string, unknown>)
				?.assignmentStatus as string | undefined)
		: undefined;
	const alreadyRequested =
		assignmentStatus === "requested" || assignmentStatus === "approved";
	const canRequest =
		!!event._links?.request && !!serviceSlug && !alreadyRequested;

	async function runTransition(kind: "publish" | "archive" | "request") {
		const linkMap = {
			publish: event._links?.publish,
			archive: event._links?.archive,
			request: event._links?.request,
		};
		const link = linkMap[kind];
		if (!link || !serviceSlug) return;
		setBusy(kind);
		try {
			const res = await fetch(`/api/proxy/${serviceSlug}${link}`, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) {
				const body = await res.text().catch(() => "");
				throw new Error(body || `${kind} failed (${res.status})`);
			}
			onClose();
			router.invalidate();
		} catch (err) {
			alert(`Couldn't ${kind}: ${(err as Error).message}`);
		} finally {
			setBusy(null);
		}
	}

	return (
		<>
			<button
				type="button"
				aria-label="Close popover"
				className="fixed inset-0 z-40 bg-black/40"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={event.title}
				className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-3)]"
			>
				<h3 className="mb-1 text-lg font-semibold text-[var(--fg)]">
					{event.title}
				</h3>
				<div className="mb-3 text-sm text-[var(--fg-muted)]">
					{(() => {
						const s = new Date(event.start);
						const e = new Date(event.end);
						const sameDay = s.toDateString() === e.toDateString();
						const startTime = formatEventTime(
							event.start,
							event.timezone,
							mode,
						);
						const endTime = formatEventTime(event.end, event.timezone, mode);
						if (sameDay) {
							return (
								<>
									<time dateTime={event.start}>
										{formatDate(s, "EEE, MMM d")} · {startTime}
									</time>
									{" – "}
									<time dateTime={event.end}>{endTime}</time>
								</>
							);
						}
						return (
							<>
								<time dateTime={event.start}>
									{formatDate(s, "EEE, MMM d")}, {startTime}
								</time>
								{" – "}
								<time dateTime={event.end}>
									{formatDate(e, "EEE, MMM d")}, {endTime}
								</time>
							</>
						);
					})()}
					{event.location && <span> · {event.location}</span>}
				</div>
				{(() => {
					// capacity/filledCount/requestedCount are on the projected shift
					// shape but not on the base ScheduleEvent type — access via index.
					const ev = event as Record<string, unknown>;
					const capacity = typeof ev.capacity === "number" ? ev.capacity : null;
					const filled =
						typeof ev.filledCount === "number" ? ev.filledCount : 0;
					const pending =
						typeof ev.requestedCount === "number" ? ev.requestedCount : 0;
					if (!event.category && capacity === null) return null;
					return (
						<div className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
							{event.category && (
								<span className="rounded bg-[var(--surface-3)] px-2 py-0.5">
									{event.category}
								</span>
							)}
							{capacity !== null && (
								<span>
									{filled} / {capacity} filled
									{/* Only coordinators see the pending count — they have
                      update/delete links which non-coordinators don't. */}
									{pending > 0 &&
										!!event._links?.update &&
										` · ${pending} pending`}
								</span>
							)}
						</div>
					);
				})()}
				{assignmentStatus === "requested" && (
					<div className="mb-3 rounded bg-[var(--surface-3)] px-3 py-1.5 text-xs text-[var(--fg-muted)]">
						You've already requested this shift — waiting for coordinator
						approval.
					</div>
				)}
				{assignmentStatus === "approved" && (
					<div className="mb-3 rounded bg-[var(--accent-muted)] px-3 py-1.5 text-xs text-[var(--accent)]">
						You're confirmed for this shift.
					</div>
				)}
				{event.description && (
					<p className="mb-4 text-sm text-[var(--fg)]">{event.description}</p>
				)}
				{event.presenters && event.presenters.length > 0 && (
					<div className="mb-4 text-xs text-[var(--fg-muted)]">
						With: {event.presenters.map((p) => p.name).join(", ")}
					</div>
				)}
				<div className="flex flex-wrap items-center justify-end gap-2">
					{event.link && (
						<a
							href={event.link}
							className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-3)]"
						>
							Open detail
						</a>
					)}
					{canArchive && (
						<button
							type="button"
							disabled={busy !== null}
							onClick={() => runTransition("archive")}
							className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--fg-muted)] hover:bg-[var(--surface-3)] disabled:opacity-50"
						>
							{busy === "archive" ? "Archiving…" : "Archive"}
						</button>
					)}
					{canDelete && (
						<button
							type="button"
							disabled={busy !== null}
							onClick={() => onDelete!(event)}
							className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-muted)] disabled:opacity-50"
						>
							Delete
						</button>
					)}
					{canRequest && (
						<button
							type="button"
							disabled={busy !== null}
							onClick={() => runTransition("request")}
							className="rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
						>
							{busy === "request" ? "Requesting…" : "Request shift"}
						</button>
					)}
					{canPublish && (
						<button
							type="button"
							disabled={busy !== null}
							onClick={() => runTransition("publish")}
							className="rounded-[var(--radius)] bg-[var(--success)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
						>
							{busy === "publish" ? "Publishing…" : "Publish"}
						</button>
					)}
					{canEdit && (
						<button
							type="button"
							disabled={busy !== null}
							onClick={() => onEdit!(event)}
							className="rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
						>
							Edit
						</button>
					)}
				</div>
			</div>
		</>
	);
}
