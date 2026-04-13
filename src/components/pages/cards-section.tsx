import type {
	BadgeValue,
	CardsConfig,
	EmptyStateConfig,
	PageSection,
} from "@convstack/service-sdk/types";
import { Link } from "@tanstack/react-router";
import { DynamicIcon } from "~/components/layout/dynamic-icon";
import { Badge } from "~/components/ui/badge";
import { EmptyStateSection } from "./empty-state-section";

interface CardItem {
	id: string;
	title: string;
	description?: string;
	icon?: string;
	image?: string;
	badge?: BadgeValue;
	link?: string;
	metadata?: Array<{ label: string; value: string }>;
}

interface CardsData {
	cards: CardItem[];
	emptyState?: EmptyStateConfig;
}

interface Props {
	section: PageSection;
	data: CardsData | null;
	serviceSlug: string;
}

const SM_GRID_CLASS: Record<1 | 2 | 3 | 4, string> = {
	1: "grid-cols-1",
	2: "grid-cols-2",
	3: "grid-cols-3",
	4: "grid-cols-4",
};

const MD_GRID_CLASS: Record<1 | 2 | 3 | 4, string> = {
	1: "sm:grid-cols-1",
	2: "sm:grid-cols-2",
	3: "sm:grid-cols-3",
	4: "sm:grid-cols-4",
};

const LG_GRID_CLASS: Record<1 | 2 | 3 | 4, string> = {
	1: "lg:grid-cols-1",
	2: "lg:grid-cols-2",
	3: "lg:grid-cols-3",
	4: "lg:grid-cols-4",
};

function columnClasses(columns?: CardsConfig["columns"]): string {
	const sm = columns?.sm ?? 1;
	const md = columns?.md ?? 2;
	const lg = columns?.lg ?? 3;
	return `${SM_GRID_CLASS[sm]} ${MD_GRID_CLASS[md]} ${LG_GRID_CLASS[lg]}`;
}

function CardBody({ card }: { card: CardItem }) {
	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex items-start gap-3">
				{card.image && (
					<img
						src={card.image}
						alt=""
						className="h-10 w-10 shrink-0 rounded-[var(--radius)] object-cover"
					/>
				)}
				{!card.image && card.icon && (
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--accent-muted)] text-[var(--accent)]">
						<DynamicIcon name={card.icon} className="h-5 w-5" />
					</div>
				)}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h3 className="truncate text-sm font-semibold text-[var(--fg)]">
							{card.title}
						</h3>
						{card.badge && <Badge value={card.badge} size="sm" />}
					</div>
					{card.description && (
						<p className="mt-1 line-clamp-2 text-xs text-[var(--fg-muted)]">
							{card.description}
						</p>
					)}
				</div>
			</div>
			{card.metadata && card.metadata.length > 0 && (
				<div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--border)] pt-2 text-xs text-[var(--fg-muted)]">
					{card.metadata.map((m) => (
						<span key={m.label}>
							<span className="text-[var(--fg-subtle)]">{m.label}:</span>{" "}
							<span className="text-[var(--fg)]">{m.value}</span>
						</span>
					))}
				</div>
			)}
		</div>
	);
}

export function CardsSection({ section, data, serviceSlug }: Props) {
	const config = section.config as unknown as CardsConfig;

	if (!data) {
		return (
			<div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6 animate-pulse">
				<div className="space-y-3">
					<div className="h-20 rounded bg-[var(--surface-2)]" />
					<div className="h-20 rounded bg-[var(--surface-2)]" />
				</div>
			</div>
		);
	}

	if (data.cards.length === 0) {
		const emptyStateConfig = data.emptyState ??
			config.emptyState ?? {
				icon: "inbox",
				title: config.title
					? `No ${config.title.toLowerCase()} yet`
					: "Nothing here yet",
			};
		return (
			<EmptyStateSection config={emptyStateConfig} serviceSlug={serviceSlug} />
		);
	}

	return (
		<div className="space-y-3">
			{config.title && (
				<h2 className="text-sm font-semibold text-[var(--fg)]">
					{config.title}
				</h2>
			)}
			<div className={`grid gap-3 ${columnClasses(config.columns)}`}>
				{data.cards.map((card) =>
					card.link ? (
						<Link
							key={card.id}
							to="/$service/$"
							params={{
								service: serviceSlug,
								_splat: card.link.replace(/^\//, ""),
							}}
							className="block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] transition-shadow hover:shadow-[var(--shadow-2)] active:scale-[0.995]"
						>
							<CardBody card={card} />
						</Link>
					) : (
						<div
							key={card.id}
							className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)]"
						>
							<CardBody card={card} />
						</div>
					),
				)}
			</div>
		</div>
	);
}
