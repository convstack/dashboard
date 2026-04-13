import type {
	ApprovalQueueConfig,
	ApprovalQueueData,
	ApprovalQueueItem,
} from "@convstack/service-sdk/types";
import { useState } from "react";

interface Props {
	config: ApprovalQueueConfig;
	data: ApprovalQueueData | null;
	serviceSlug: string;
}

function formatWhen(iso: string): string {
	const date = new Date(iso);
	return date.toLocaleString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function timeAgo(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins} min ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function ApprovalQueueSection({ config, data, serviceSlug }: Props) {
	const [items, setItems] = useState<ApprovalQueueItem[]>(data?.items ?? []);
	const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
	const [declineTarget, setDeclineTarget] = useState<string | null>(null);
	const [declineReason, setDeclineReason] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
		return (
			<section className="rounded-lg border border-(--border) bg-(--surface-1) p-8 text-center">
				<h3 className="text-base font-medium text-(--fg)">
					{config.title ?? "Approval queue"}
				</h3>
				<p className="mt-2 text-sm text-(--fg-muted)">
					Couldn't load approval queue. The schedule service may be unavailable.
				</p>
			</section>
		);
	}

	async function approve(item: ApprovalQueueItem) {
		if (!item._links?.approve) return;
		setBusy(item.id);
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}${item._links.approve}`,
				{ method: "POST", credentials: "include" },
			);
			if (!res.ok) throw new Error(await res.text());
			setItems((prev) => prev.filter((i) => i.id !== item.id));
		} catch (err) {
			console.error("approve failed:", err);
			alert(`Couldn't approve: ${(err as Error).message}`);
		} finally {
			setBusy(null);
		}
	}

	async function decline(item: ApprovalQueueItem) {
		if (!item._links?.decline) return;
		setBusy(item.id);
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}${item._links.decline}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ reason: declineReason || undefined }),
				},
			);
			if (!res.ok) throw new Error(await res.text());
			setItems((prev) => prev.filter((i) => i.id !== item.id));
			setDeclineTarget(null);
			setDeclineReason("");
		} catch (err) {
			console.error("decline failed:", err);
			alert(`Couldn't decline: ${(err as Error).message}`);
		} finally {
			setBusy(null);
		}
	}

	if (items.length === 0 && data.emptyState) {
		return (
			<section className="rounded-lg border border-(--border) bg-(--surface-1) p-8 text-center">
				<h3 className="text-base font-medium text-(--fg)">
					{data.emptyState.title}
				</h3>
				{data.emptyState.description && (
					<p className="mt-1 text-sm text-(--fg-muted)">
						{data.emptyState.description}
					</p>
				)}
			</section>
		);
	}

	return (
		<section className="rounded-lg border border-(--border) bg-(--surface-1)">
			{config.title && (
				<header className="border-b border-(--border) px-5 py-4">
					<h2 className="text-base font-semibold text-(--fg)">
						{config.title}{" "}
						<span className="ml-2 text-sm font-normal text-(--fg-muted)">
							({items.length})
						</span>
					</h2>
				</header>
			)}
			<ul className="divide-y divide-(--border)">
				{items.map((item) => {
					const isExpanded = expandedProfile === item.id;
					const isDeclining = declineTarget === item.id;
					return (
						<li key={item.id} className="px-5 py-4">
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-(--fg)">
											{item.critter.name}
										</span>
										<span className="rounded bg-(--surface-2) px-1.5 py-0.5 text-[10px] text-(--fg-muted)">
											{item.shift.departmentName}
										</span>
									</div>
									<div className="mt-1 text-sm text-(--fg)">
										{item.shift.title}
									</div>
									<div className="text-xs text-(--fg-muted)">
										{formatWhen(item.shift.start)} –{" "}
										{formatWhen(item.shift.end)}
										{item.shift.location && ` · ${item.shift.location}`}
									</div>
									<div className="mt-1 text-xs text-(--fg-subtle)">
										{item.shift.filledCount} / {item.shift.capacity} filled ·{" "}
										Requested {timeAgo(item.requestedAt)}
									</div>

									{item.requestNote && (
										<div className="mt-2 rounded border-l-2 border-(--border) bg-(--surface-2) px-3 py-2 text-sm italic text-(--fg)">
											"{item.requestNote}"
										</div>
									)}

									{item.conflicts && item.conflicts.length > 0 && (
										<div className="mt-2 rounded border border-(--warning) bg-(--warning-muted) px-3 py-2 text-xs text-(--warning)">
											⚠ Overlaps with:{" "}
											{item.conflicts
												.map((c) => `${c.title} (${c.status})`)
												.join(", ")}
										</div>
									)}

									{item.critter.hasProfile && item.critter.profile && (
										<button
											type="button"
											onClick={() =>
												setExpandedProfile(isExpanded ? null : item.id)
											}
											className="mt-2 text-xs text-(--accent) hover:underline"
										>
											{isExpanded ? "▴ Hide profile" : "▾ View profile"}
										</button>
									)}

									{isExpanded && item.critter.profile && (
										<dl className="mt-2 space-y-1 text-xs text-(--fg-muted)">
											{item.critter.profile.shirtSize && (
												<div>
													<dt className="inline font-medium">Shirt:</dt>{" "}
													<dd className="inline">
														{item.critter.profile.shirtSize}
													</dd>
												</div>
											)}
											{item.critter.profile.skills &&
												item.critter.profile.skills.length > 0 && (
													<div>
														<dt className="inline font-medium">Skills:</dt>{" "}
														<dd className="inline">
															{item.critter.profile.skills.join(", ")}
														</dd>
													</div>
												)}
											{item.critter.profile.availabilityNote && (
												<div>
													<dt className="inline font-medium">Availability:</dt>{" "}
													<dd className="inline">
														{item.critter.profile.availabilityNote}
													</dd>
												</div>
											)}
											{item.critter.profile.dietary && (
												<div>
													<dt className="inline font-medium">Dietary:</dt>{" "}
													<dd className="inline">
														{item.critter.profile.dietary}
													</dd>
												</div>
											)}
										</dl>
									)}
								</div>

								<div className="flex shrink-0 flex-col gap-2">
									{item._links?.approve && (
										<button
											type="button"
											disabled={busy === item.id}
											onClick={() => approve(item)}
											className="rounded-(--radius) bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--accent-fg) hover:bg-(--accent-hover) disabled:opacity-50"
										>
											Approve
										</button>
									)}
									{item._links?.decline && !isDeclining && (
										<button
											type="button"
											disabled={busy === item.id}
											onClick={() => setDeclineTarget(item.id)}
											className="rounded-(--radius) border border-(--border) px-3 py-1.5 text-sm text-(--danger) hover:bg-(--danger-muted) disabled:opacity-50"
										>
											Decline
										</button>
									)}
								</div>
							</div>

							{isDeclining && (
								<div className="mt-3 rounded-(--radius) border border-(--border) bg-(--surface-2) p-3">
									<label className="block">
										<span className="mb-1 block text-xs text-(--fg-muted)">
											Reason (optional, visible to the critter)
										</span>
										<textarea
											value={declineReason}
											onChange={(e) => setDeclineReason(e.target.value)}
											className="mb-2 w-full rounded border border-(--border) bg-(--surface-1) px-2 py-1 text-sm text-(--fg)"
											rows={2}
										/>
									</label>
									<div className="flex justify-end gap-2">
										<button
											type="button"
											onClick={() => {
												setDeclineTarget(null);
												setDeclineReason("");
											}}
											className="rounded-(--radius) border border-(--border) px-3 py-1 text-xs text-(--fg) hover:bg-(--surface-3)"
										>
											Cancel
										</button>
										<button
											type="button"
											disabled={busy === item.id}
											onClick={() => decline(item)}
											className="rounded-(--radius) bg-(--danger) px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
										>
											Confirm decline
										</button>
									</div>
								</div>
							)}
						</li>
					);
				})}
			</ul>
		</section>
	);
}
