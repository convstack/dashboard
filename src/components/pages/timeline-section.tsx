import type {
	EmptyStateConfig,
	PageSection,
	TimelineConfig,
} from "@convstack/service-sdk/types";
import { Link } from "@tanstack/react-router";
import { formatDate } from "~/lib/format";
import { EmptyStateSection } from "./empty-state-section";

interface TimelineEvent {
	id: string;
	timestamp: string;
	actor?: { name: string; avatar?: string; link?: string };
	action: string;
	description?: string;
	link?: string;
}

interface TimelineData {
	events: TimelineEvent[];
	emptyState?: EmptyStateConfig;
}

interface Props {
	section: PageSection;
	data: TimelineData | null;
	serviceSlug: string;
}

/**
 * Format an ISO timestamp into a relative date key used for grouping.
 * Returns "Today", "Yesterday", or an absolute date string.
 */
function groupKey(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const oneDay = 24 * 60 * 60 * 1000;
	const diffDays = Math.floor(
		(now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / oneDay,
	);
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	return formatDate(iso);
}

function formatTime(iso: string): string {
	const date = new Date(iso);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((w) => w[0])
		.filter(Boolean)
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function TimelineSection({ section, data, serviceSlug }: Props) {
	const config = section.config as unknown as TimelineConfig;

	if (!data) {
		return (
			<div className="space-y-3">
				{[0, 1, 2].map((i) => (
					<div
						key={i}
						className="h-14 animate-pulse rounded-[var(--radius)] bg-[var(--surface-2)]"
					/>
				))}
			</div>
		);
	}

	const events = Array.isArray(data.events) ? data.events : [];

	if (events.length === 0) {
		const emptyStateConfig = data.emptyState ??
			config.emptyState ?? {
				icon: "clock",
				title: "No history yet",
			};
		return (
			<EmptyStateSection config={emptyStateConfig} serviceSlug={serviceSlug} />
		);
	}

	// Group events by the relative date key while preserving order.
	const groups: Array<{ key: string; events: TimelineEvent[] }> = [];
	for (const event of events) {
		const key = groupKey(event.timestamp);
		const last = groups[groups.length - 1];
		if (last && last.key === key) {
			last.events.push(event);
		} else {
			groups.push({ key, events: [event] });
		}
	}

	return (
		<div className="space-y-6">
			{config.title && (
				<h2 className="text-sm font-semibold text-[var(--fg)]">
					{config.title}
				</h2>
			)}
			{groups.map((group) => (
				<section key={group.key}>
					<h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
						{group.key}
					</h3>
					<ul className="space-y-1">
						{group.events.map((event) => {
							const rowContent = (
								<div className="relative flex items-start gap-3 rounded-[var(--radius)] px-3 py-2 transition-colors hover:bg-[var(--surface-2)]">
									{/* Connector line — vertical line down the left edge of the timestamp column. */}
									<div
										aria-hidden="true"
										className="absolute left-[calc(3rem+0.75rem)] top-0 bottom-0 w-px bg-[var(--border)]"
									/>
									{/* Connector dot — positioned on the line at the start of each row. */}
									<div
										aria-hidden="true"
										className="absolute left-[calc(3rem+0.75rem-2px)] top-3 h-1 w-1 rounded-full bg-[var(--fg-subtle)]"
									/>
									<time className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-[var(--fg-subtle)]">
										{formatTime(event.timestamp)}
									</time>
									{event.actor && (
										<div className="shrink-0">
											{event.actor.avatar ? (
												<img
													src={event.actor.avatar}
													alt=""
													className="h-6 w-6 rounded-full object-cover"
												/>
											) : (
												<div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[10px] font-medium text-[var(--accent)]">
													{getInitials(event.actor.name)}
												</div>
											)}
										</div>
									)}
									<div className="min-w-0 flex-1">
										<p className="text-sm text-[var(--fg)]">
											{event.actor && (
												<span className="font-medium">{event.actor.name}</span>
											)}{" "}
											<span className="text-[var(--fg-muted)]">
												{event.action}
											</span>
										</p>
										{event.description && (
											<p className="mt-0.5 text-sm text-[var(--fg-muted)]">
												{event.description}
											</p>
										)}
									</div>
								</div>
							);
							if (event.link) {
								return (
									<li key={event.id}>
										<Link
											to="/$service/$"
											params={{
												service: serviceSlug,
												_splat: event.link.replace(/^\//, ""),
											}}
											className="block"
										>
											{rowContent}
										</Link>
									</li>
								);
							}
							return <li key={event.id}>{rowContent}</li>;
						})}
					</ul>
				</section>
			))}
		</div>
	);
}
