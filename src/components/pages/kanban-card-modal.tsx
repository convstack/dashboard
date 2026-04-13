import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { KanbanCard, KanbanColumn } from "~/lib/kanban/types";

type DeptOption = { value: string; label: string };
type TeamEntry = { id: string; name: string };
type MemberEntry = { id: string; name: string; userId: string };

interface Comment {
	id: string;
	author: { name: string };
	content: string;
	createdAt: string;
}

interface Props {
	card: KanbanCard;
	columns: KanbanColumn[];
	serviceSlug: string;
	boardSlug: string;
	onClose: () => void;
	departmentOptions: DeptOption[];
	departmentTeams: Record<string, TeamEntry[]>;
	departmentMembers: Record<string, MemberEntry[]>;
}

const PRIORITY_STYLES = {
	urgent: "bg-[var(--danger-muted)] text-[var(--danger)]",
	high: "bg-[var(--warning-muted)] text-[var(--warning)]",
	medium: "bg-[var(--accent-muted)] text-[var(--accent)]",
	low: "bg-[var(--surface-3)] text-[var(--fg-muted)]",
} as const;

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITY_OPTIONS)[number];

function Avatar({ name, avatar }: { name: string; avatar?: string }) {
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
				className="h-7 w-7 rounded-full border-2 border-[var(--surface-2)] object-cover"
			/>
		);
	}
	return (
		<span
			title={name}
			className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--surface-2)] bg-[var(--surface-3)] text-[10px] font-medium text-[var(--fg-muted)]"
		>
			{initials}
		</span>
	);
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function InlineEditText({
	value,
	onSave,
	canEdit,
	as: As = "input",
	className,
	placeholder,
}: {
	value: string;
	onSave: (v: string) => void;
	canEdit: boolean;
	as?: "input" | "textarea";
	className?: string;
	placeholder?: string;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

	useEffect(() => {
		if (editing) ref.current?.focus();
	}, [editing]);

	const displayValue = value || placeholder;

	if (!canEdit) {
		return <span className={className}>{displayValue}</span>;
	}

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => {
					setDraft(value);
					setEditing(true);
				}}
				className={`${className} block w-full text-left cursor-text rounded px-1 -mx-1 hover:bg-[var(--surface-2)] ${!value ? "italic text-[var(--fg-subtle)]" : ""}`}
			>
				{displayValue}
			</button>
		);
	}

	const save = () => {
		if (draft !== value) onSave(draft);
		setEditing(false);
	};

	const sharedClass =
		"w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-[var(--fg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

	if (As === "textarea") {
		return (
			<textarea
				ref={ref}
				value={draft}
				rows={4}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={save}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						setEditing(false);
					}
				}}
				className={`${sharedClass} resize-y text-sm leading-relaxed`}
			/>
		);
	}

	return (
		<input
			ref={ref}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={save}
			onKeyDown={(e) => {
				if (e.key === "Enter") save();
				if (e.key === "Escape") setEditing(false);
			}}
			className={`${sharedClass} text-lg font-semibold`}
		/>
	);
}

export function KanbanCardModal({
	card,
	columns,
	serviceSlug,
	boardSlug,
	onClose,
	departmentOptions,
	departmentTeams,
	departmentMembers,
}: Props) {
	const router = useRouter();

	const [localCard, setLocalCard] = useState(card);
	useEffect(() => {
		setLocalCard(card);
	}, [card]);

	const [movingTo, setMovingTo] = useState(localCard.columnId);
	const [movesBusy, setMovesBusy] = useState(false);
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [error, setError] = useState("");
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	const [comments, setComments] = useState<Comment[]>([]);
	const [commentText, setCommentText] = useState("");
	const [commentBusy, setCommentBusy] = useState(false);
	const [commentsLoading, setCommentsLoading] = useState(true);

	const commentsUrl = `/api/proxy/${serviceSlug}/api/boards/${boardSlug}/cards/${localCard.id}/comments`;

	useEffect(() => {
		closeButtonRef.current?.focus();
	}, []);

	useEffect(() => {
		let cancelled = false;
		setCommentsLoading(true);
		fetch(commentsUrl, { credentials: "include" })
			.then((r) => r.json())
			.then((data) => {
				if (!cancelled) {
					setComments(data.comments ?? []);
					setCommentsLoading(false);
				}
			})
			.catch(() => {
				if (!cancelled) setCommentsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [commentsUrl]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				if (confirmDelete) {
					setConfirmDelete(false);
				} else {
					onClose();
				}
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, confirmDelete]);

	async function patchCard(field: string, value: unknown) {
		if (!localCard._links?.update) return;
		setError("");
		setLocalCard((prev) => ({ ...prev, [field]: value }) as typeof prev);
		const res = await fetch(
			`/api/proxy/${serviceSlug}${localCard._links.update}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ [field]: value }),
			},
		);
		if (!res.ok) {
			setLocalCard(card);
			throw new Error(await res.text().catch(() => `${res.status}`));
		}
		router.invalidate();
	}

	async function handleMoveColumn(newColumnId: string) {
		if (newColumnId === movingTo || !localCard._links?.update) return;
		setMovesBusy(true);
		setError("");
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}${localCard._links.update}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ columnId: newColumnId }),
				},
			);
			if (!res.ok)
				throw new Error(await res.text().catch(() => `${res.status}`));
			setMovingTo(newColumnId);
			router.invalidate();
		} catch (err) {
			setError(`Couldn't move card: ${(err as Error).message}`);
		} finally {
			setMovesBusy(false);
		}
	}

	async function handleDelete() {
		if (!localCard._links?.delete) return;
		setDeleteBusy(true);
		setError("");
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}${localCard._links.delete}`,
				{
					method: "DELETE",
					credentials: "include",
				},
			);
			if (!res.ok)
				throw new Error(await res.text().catch(() => `${res.status}`));
			router.invalidate();
			onClose();
		} catch (err) {
			setError(`Couldn't delete card: ${(err as Error).message}`);
			setDeleteBusy(false);
			setConfirmDelete(false);
		}
	}

	async function handleAddComment() {
		const trimmed = commentText.trim();
		if (!trimmed) return;
		setCommentBusy(true);
		try {
			const res = await fetch(commentsUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ content: trimmed }),
			});
			if (!res.ok)
				throw new Error(await res.text().catch(() => `${res.status}`));
			const data = await res.json();
			setComments((prev) => [...prev, data.comment]);
			setCommentText("");
		} catch (err) {
			setError(`Couldn't add comment: ${(err as Error).message}`);
		} finally {
			setCommentBusy(false);
		}
	}

	const canEdit = !!localCard._links?.update;
	const canDelete = !!localCard._links?.delete;
	const canMove = !!localCard._links?.update && columns.length > 1;
	const progress = localCard.progress ?? null;
	const currentColumn = columns.find((c) => c.id === movingTo);

	return (
		<>
			<button
				type="button"
				aria-label="Close modal"
				className="fixed inset-0 z-40 bg-black/50"
				onClick={onClose}
			/>

			<div
				role="dialog"
				aria-modal="true"
				aria-label={localCard.title}
				className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-lg border border-(--border) bg-(--surface-1) shadow-(--shadow-3) lg:inset-x-[10%] lg:inset-y-[5%]"
			>
				<div className="flex items-start justify-between gap-3 border-b border-(--border) px-6 py-4 shrink-0">
					<InlineEditText
						value={localCard.title}
						canEdit={canEdit}
						onSave={(v) =>
							patchCard("title", v).catch((err) =>
								setError(`Couldn't update title: ${(err as Error).message}`),
							)
						}
						className="text-lg font-semibold leading-snug text-(--fg)"
						placeholder="Untitled"
					/>
					<button
						ref={closeButtonRef}
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="mt-0.5 shrink-0 rounded-(--radius) p-1 text-(--fg-muted) hover:bg-(--surface-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
					>
						<span aria-hidden="true" className="block text-xl leading-none">
							×
						</span>
					</button>
				</div>

				{error && (
					<div className="mx-6 mt-3 shrink-0 rounded-(--radius) bg-(--danger-muted) px-3 py-2 text-sm text-(--danger)">
						{error}
					</div>
				)}

				<div className="flex flex-1 overflow-hidden">
					<div className="flex-1 overflow-y-auto p-6">
						<div className="mb-6">
							<h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-(--fg-subtle)">
								Description
							</h3>
							<InlineEditText
								value={localCard.description ?? ""}
								canEdit={canEdit}
								as="textarea"
								onSave={(v) =>
									patchCard("description", v).catch((err) =>
										setError(
											`Couldn't update description: ${(err as Error).message}`,
										),
									)
								}
								className="text-sm leading-relaxed text-(--fg)"
								placeholder="Add a description..."
							/>
						</div>

						<div>
							<h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-(--fg-subtle)">
								Comments{" "}
								{comments.length > 0 && (
									<span className="ml-1 text-(--fg-muted)">
										({comments.length})
									</span>
								)}
							</h3>

							{commentsLoading ? (
								<p className="text-sm text-(--fg-subtle)">Loading…</p>
							) : comments.length === 0 ? (
								<p className="mb-4 text-sm text-(--fg-subtle)">
									No comments yet.
								</p>
							) : (
								<div className="mb-4 space-y-4">
									{comments.map((c) => (
										<div key={c.id} className="flex gap-3">
											<Avatar name={c.author.name} />
											<div className="flex-1">
												<div className="mb-1 flex items-baseline gap-2">
													<span className="text-sm font-medium text-(--fg)">
														{c.author.name}
													</span>
													<span className="text-xs text-(--fg-subtle)">
														{formatDate(c.createdAt)}
													</span>
												</div>
												<p className="text-sm leading-relaxed text-(--fg-muted)">
													{c.content}
												</p>
											</div>
										</div>
									))}
								</div>
							)}

							<div className="mt-2">
								<textarea
									value={commentText}
									onChange={(e) => setCommentText(e.target.value)}
									placeholder="Write a comment…"
									rows={3}
									className="w-full resize-none rounded-(--radius) border border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--fg) placeholder:text-(--fg-subtle) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
								/>
								<div className="mt-2 flex justify-end">
									<button
										type="button"
										disabled={commentBusy || !commentText.trim()}
										onClick={handleAddComment}
										className="rounded-(--radius) bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--accent-fg) hover:bg-(--accent-hover) disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
									>
										{commentBusy ? "Posting…" : "Comment"}
									</button>
								</div>
							</div>
						</div>
					</div>

					<div className="hidden w-72 shrink-0 overflow-y-auto border-l border-(--border) p-5 lg:block">
						<dl className="space-y-5">
							{canMove && (
								<div>
									<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
										Column
									</dt>
									<dd>
										<select
											value={movingTo}
											disabled={movesBusy}
											onChange={(e) => handleMoveColumn(e.target.value)}
											className="w-full rounded-(--radius) border border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 disabled:opacity-50"
										>
											{columns
												.slice()
												.sort((a, b) => a.position - b.position)
												.map((col) => (
													<option key={col.id} value={col.id}>
														{col.label}
													</option>
												))}
										</select>
									</dd>
								</div>
							)}

							{!canMove && currentColumn && (
								<div>
									<dt className="mb-1 text-xs font-medium text-(--fg-subtle)">
										Column
									</dt>
									<dd className="text-sm text-(--fg)">{currentColumn.label}</dd>
								</div>
							)}

							{(canEdit
								? departmentOptions.length > 0
								: !!localCard.department) && (
								<div>
									<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
										Department
									</dt>
									<dd>
										{canEdit ? (
											<select
												value={localCard.department?.id ?? ""}
												onChange={(e) => {
													const newDeptId = e.target.value || null;
													setLocalCard((prev) => ({
														...prev,
														department: newDeptId
															? {
																	id: newDeptId,
																	name:
																		departmentOptions.find(
																			(o) => o.value === newDeptId,
																		)?.label ?? newDeptId,
																}
															: undefined,
														assignee: undefined,
														collaborators: undefined,
													}));
													patchCard("departmentId", newDeptId).catch((err) =>
														setError(
															`Couldn't update department: ${(err as Error).message}`,
														),
													);
												}}
												className="w-full rounded-(--radius) border border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
											>
												<option value="">No department</option>
												{departmentOptions.map((opt) => (
													<option key={opt.value} value={opt.value}>
														{opt.label}
													</option>
												))}
											</select>
										) : localCard.department ? (
											<span className="inline-flex items-center gap-1.5 rounded bg-(--surface-3) px-2 py-0.5 text-xs text-(--fg-muted)">
												<span
													aria-hidden="true"
													className="h-1.5 w-1.5 rounded-full bg-(--accent)"
												/>
												{localCard.department.name}
												{localCard.department.teamName && (
													<> · {localCard.department.teamName}</>
												)}
											</span>
										) : null}
									</dd>
								</div>
							)}

							{canEdit &&
								localCard.department?.id &&
								(departmentTeams[localCard.department.id]?.length ?? 0) > 0 && (
									<div>
										<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
											Team
										</dt>
										<dd>
											<select
												value={localCard.department?.teamId ?? ""}
												onChange={(e) => {
													const newTeamId = e.target.value || null;
													setLocalCard((prev) => ({
														...prev,
														department: prev.department
															? {
																	...prev.department,
																	teamId: newTeamId ?? undefined,
																}
															: undefined,
													}));
													patchCard("teamId", newTeamId).catch((err) =>
														setError(
															`Couldn't update team: ${(err as Error).message}`,
														),
													);
												}}
												className="w-full rounded-(--radius) border border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
											>
												<option value="">No team</option>
												{(departmentTeams[localCard.department.id] ?? []).map(
													(t) => (
														<option key={t.id} value={t.id}>
															{t.name}
														</option>
													),
												)}
											</select>
										</dd>
									</div>
								)}

							<div>
								<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
									Assignee
								</dt>
								<dd>
									{canEdit &&
									localCard.department?.id &&
									(departmentMembers[localCard.department.id]?.length ?? 0) >
										0 ? (
										<select
											value={
												departmentMembers[localCard.department.id]?.find(
													(m) => m.name === localCard.assignee?.name,
												)?.userId ?? ""
											}
											onChange={(e) => {
												const userId = e.target.value || null;
												const member = departmentMembers[
													localCard.department!.id
												]?.find((m) => m.userId === userId);
												setLocalCard((prev) => ({
													...prev,
													assignee: member ? { name: member.name } : undefined,
												}));
												patchCard("assigneeUserId", userId).catch((err) =>
													setError(
														`Couldn't update assignee: ${(err as Error).message}`,
													),
												);
											}}
											className="w-full rounded-(--radius) border border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
										>
											<option value="">Unassigned</option>
											{departmentMembers[localCard.department.id].map((m) => (
												<option key={m.userId} value={m.userId}>
													{m.name}
												</option>
											))}
										</select>
									) : localCard.assignee ? (
										<div className="flex items-center gap-2">
											<Avatar
												name={localCard.assignee.name}
												avatar={localCard.assignee.avatar}
											/>
											<span className="text-sm text-(--fg)">
												{localCard.assignee.name}
											</span>
										</div>
									) : canEdit ? (
										<span className="text-sm text-(--fg-subtle)">
											Select a department to assign
										</span>
									) : null}
								</dd>
							</div>

							{canEdit &&
							localCard.department?.id &&
							(departmentMembers[localCard.department.id]?.length ?? 0) > 0 ? (
								<div>
									<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
										Collaborators
										{localCard.collaborators &&
											localCard.collaborators.length > 0 && (
												<span className="ml-1 text-(--fg-muted)">
													{localCard.collaborators.length}
												</span>
											)}
									</dt>
									<dd>
										<details className="group rounded-(--radius) border border-(--border) bg-(--surface-2)">
											<summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)">
												{localCard.collaborators &&
												localCard.collaborators.length > 0 ? (
													<div className="flex items-center gap-2 min-w-0">
														<div className="flex -space-x-1.5 shrink-0">
															{localCard.collaborators.slice(0, 4).map((c) => (
																<Avatar
																	key={c.userId}
																	name={c.name}
																	avatar={c.avatar}
																/>
															))}
														</div>
														<span className="truncate text-xs text-(--fg-muted)">
															{localCard.collaborators
																.map((c) => c.name)
																.join(", ")}
														</span>
													</div>
												) : (
													<span className="text-sm text-(--fg-subtle)">
														Add collaborators
													</span>
												)}
												<svg
													aria-hidden="true"
													className="h-4 w-4 shrink-0 text-(--fg-muted) transition-transform group-open:rotate-180"
													viewBox="0 0 20 20"
													fill="currentColor"
												>
													<path
														fillRule="evenodd"
														d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
														clipRule="evenodd"
													/>
												</svg>
											</summary>
											<div className="max-h-56 overflow-y-auto border-t border-(--border) px-3 py-2">
												{(departmentMembers[localCard.department.id] ?? []).map(
													(m) => {
														const current = localCard.collaborators ?? [];
														const checked = current.some(
															(c) => c.userId === m.userId,
														);
														const isPrimary =
															!!localCard.assignee &&
															departmentMembers[localCard.department!.id]?.find(
																(x) => x.name === localCard.assignee?.name,
															)?.userId === m.userId;
														return (
															<label
																key={m.userId}
																className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${
																	isPrimary
																		? "opacity-50"
																		: "cursor-pointer hover:bg-(--surface-3)"
																}`}
															>
																<input
																	type="checkbox"
																	checked={checked}
																	disabled={isPrimary}
																	onChange={(e) => {
																		const next = e.target.checked
																			? [
																					...current,
																					{ userId: m.userId, name: m.name },
																				]
																			: current.filter(
																					(c) => c.userId !== m.userId,
																				);
																		setLocalCard((prev) => ({
																			...prev,
																			collaborators: next,
																		}));
																		fetch(
																			`/api/proxy/${serviceSlug}${localCard._links!.update}`,
																			{
																				method: "PATCH",
																				headers: {
																					"Content-Type": "application/json",
																				},
																				credentials: "include",
																				body: JSON.stringify({
																					collaboratorUserIds: next.map(
																						(c) => c.userId,
																					),
																				}),
																			},
																		)
																			.then((res) => {
																				if (!res.ok) {
																					setLocalCard(card);
																					throw new Error(`${res.status}`);
																				}
																				router.invalidate();
																			})
																			.catch((err) =>
																				setError(
																					`Couldn't update collaborators: ${(err as Error).message}`,
																				),
																			);
																	}}
																	className="h-4 w-4 rounded border-(--border) accent-(--accent)"
																/>
																<span className="truncate text-(--fg)">
																	{m.name}
																</span>
																{isPrimary && (
																	<span className="ml-auto text-[10px] uppercase tracking-wide text-(--fg-muted)">
																		assignee
																	</span>
																)}
															</label>
														);
													},
												)}
											</div>
										</details>
									</dd>
								</div>
							) : localCard.collaborators &&
								localCard.collaborators.length > 0 ? (
								<div>
									<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
										Collaborators
									</dt>
									<dd>
										<div className="flex -space-x-1.5">
											{localCard.collaborators.slice(0, 5).map((c) => (
												<Avatar
													key={c.userId}
													name={c.name}
													avatar={c.avatar}
												/>
											))}
											{localCard.collaborators.length > 5 && (
												<span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-(--surface-2) bg-(--surface-3) text-[10px] text-(--fg-muted)">
													+{localCard.collaborators.length - 5}
												</span>
											)}
										</div>
										<p className="mt-1.5 text-xs text-(--fg-muted)">
											{localCard.collaborators.map((c) => c.name).join(", ")}
										</p>
									</dd>
								</div>
							) : null}

							{localCard.labels && localCard.labels.length > 0 && (
								<div>
									<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
										Labels
									</dt>
									<dd className="flex flex-wrap gap-1.5">
										{localCard.labels.map((label) =>
											label.color ? (
												<span
													key={label.text}
													className="rounded px-2 py-0.5 text-xs font-medium"
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
													className="rounded bg-(--surface-3) px-2 py-0.5 text-xs text-(--fg-muted)"
												>
													{label.text}
												</span>
											),
										)}
									</dd>
								</div>
							)}

							<div>
								<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
									Priority
								</dt>
								<dd>
									{canEdit ? (
										<select
											value={localCard.priority ?? "low"}
											onChange={(e) =>
												patchCard("priority", e.target.value || null).catch(
													(err) =>
														setError(
															`Couldn't update priority: ${(err as Error).message}`,
														),
												)
											}
											className="w-full rounded-(--radius) border border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--fg) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 capitalize"
										>
											{PRIORITY_OPTIONS.map((p) => (
												<option key={p} value={p}>
													{p.charAt(0).toUpperCase() + p.slice(1)}
												</option>
											))}
										</select>
									) : localCard.priority ? (
										<span
											className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLES[localCard.priority as Priority]}`}
										>
											{localCard.priority}
										</span>
									) : null}
								</dd>
							</div>

							{progress !== null && (
								<div>
									<dt className="mb-1.5 text-xs font-medium text-(--fg-subtle)">
										Progress{" "}
										<span className="ml-1 text-(--fg-muted)">{progress}%</span>
									</dt>
									<dd>
										<div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-3)">
											<div
												className="h-full rounded-full transition-[width]"
												style={{
													width: `${progress}%`,
													backgroundColor:
														progress >= 80 ? "var(--success)" : "var(--accent)",
												}}
											/>
										</div>
									</dd>
								</div>
							)}
						</dl>
					</div>
				</div>

				{confirmDelete && (
					<div className="shrink-0 border-t border-(--danger) bg-(--danger-muted) px-6 py-3">
						<div className="flex items-center justify-between gap-3">
							<p className="text-sm text-(--danger)">
								Delete this card? This cannot be undone.
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setConfirmDelete(false)}
									className="rounded-(--radius) border border-(--border) px-3 py-1.5 text-xs text-(--fg) hover:bg-(--surface-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
								>
									Cancel
								</button>
								<button
									type="button"
									disabled={deleteBusy}
									onClick={handleDelete}
									className="rounded-(--radius) bg-(--danger) px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
								>
									{deleteBusy ? "Deleting…" : "Confirm delete"}
								</button>
							</div>
						</div>
					</div>
				)}

				{canDelete && !confirmDelete && (
					<div className="flex items-center justify-end gap-2 border-t border-(--border) px-6 py-3 shrink-0">
						<button
							type="button"
							disabled={deleteBusy}
							onClick={() => setConfirmDelete(true)}
							className="rounded-(--radius) border border-(--border) px-3 py-1.5 text-sm text-(--danger) hover:bg-(--danger-muted) disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2"
						>
							Delete
						</button>
					</div>
				)}
			</div>
		</>
	);
}
