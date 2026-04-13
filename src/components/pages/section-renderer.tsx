import type {
	ApprovalQueueConfig,
	ApprovalQueueData,
	KanbanConfig,
	KanbanData,
	PageDefinition,
	PageSection,
} from "@convstack/service-sdk/types";
import { lazy, Suspense } from "react";
import { PasskeySection } from "~/components/sections/passkey-section";
import { TwoFactorSection } from "~/components/sections/two-factor-section";
import { SectionSkeleton } from "~/components/ui/section-skeleton";
import { WidgetRenderer } from "~/components/widgets/widget-renderer";
import type {
	AgendaConfig,
	CalendarDayConfig,
	CalendarGridConfig,
	CalendarMonthConfig,
	ScheduleData,
	UpcomingStripConfig,
} from "~/lib/schedule/types";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";

const CalendarMonthSection = lazy(() =>
	import("./calendar-month-section").then((m) => ({
		default: m.CalendarMonthSection,
	})),
);
const CalendarDaySection = lazy(() =>
	import("./calendar-day-section").then((m) => ({
		default: m.CalendarDaySection,
	})),
);
const CalendarGridSection = lazy(() =>
	import("./calendar-grid-section").then((m) => ({
		default: m.CalendarGridSection,
	})),
);
const AgendaSection = lazy(() =>
	import("./agenda-section").then((m) => ({ default: m.AgendaSection })),
);
const UpcomingStripSection = lazy(() =>
	import("./upcoming-strip-section").then((m) => ({
		default: m.UpcomingStripSection,
	})),
);
const ApprovalQueueSection = lazy(() =>
	import("./approval-queue-section").then((m) => ({
		default: m.ApprovalQueueSection,
	})),
);
const KanbanSection = lazy(() =>
	import("./kanban-section").then((m) => ({ default: m.KanbanSection })),
);

import { ActionBarSection } from "./action-bar-section";
import { CalloutSection } from "./callout-section";
import { CardsSection } from "./cards-section";
import { DataTableSection } from "./data-table-section";
import { DetailSection } from "./detail-section";
import { EmptyStateSection } from "./empty-state-section";
import { FormSection } from "./form-section";
import { HeroSection } from "./hero-section";
import { MarkdownEditorSection } from "./markdown-editor-section";
import { MarkdownSection } from "./markdown-section";
import { SearchSection } from "./search-section";
import { StatsRowSection } from "./stats-row-section";
import { TabsSection } from "./tabs-section";
import { TimelineSection } from "./timeline-section";

interface Props {
	section: PageSection;
	data: unknown | null;
	service: ServiceCatalogEntry;
	pathParams: Record<string, string>;
	pageLayout?: PageDefinition["layout"];
	sectionIndex: number;
}

export function SectionRenderer({
	section,
	data,
	service,
	pathParams,
	pageLayout,
	sectionIndex,
}: Props) {
	// Dev-mode warning: calendar sections that declare _links.create but omit
	// _links.createForm will silently suppress the "+ New" button at runtime.
	if (
		import.meta.env.DEV &&
		(section.type === "calendar-month" ||
			section.type === "calendar-day" ||
			section.type === "calendar-grid" ||
			section.type === "agenda") &&
		data &&
		typeof data === "object" &&
		"_links" in data
	) {
		const links = (data as ScheduleData)._links;
		if (links?.create && !links?.createForm) {
			console.warn(
				`[schedule] Section "${section.endpoint}" has _links.create but no _links.createForm — the "+ New" button will be hidden. Add createForm to fix.`,
			);
		}
	}

	switch (section.type) {
		case "data-table":
			return (
				<DataTableSection
					section={section}
					data={data as Parameters<typeof DataTableSection>[0]["data"]}
					pathParams={pathParams}
					serviceSlug={service.slug}
				/>
			);
		case "detail":
			return (
				<DetailSection
					section={section}
					data={data as Parameters<typeof DetailSection>[0]["data"]}
				/>
			);
		case "form":
			return (
				<FormSection
					section={section}
					serviceSlug={service.slug}
					pathParams={pathParams}
				/>
			);
		case "action-bar":
			return (
				<ActionBarSection
					section={section}
					data={data as Parameters<typeof ActionBarSection>[0]["data"]}
					pathParams={pathParams}
					serviceSlug={service.slug}
				/>
			);
		case "widget-grid":
			return (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{(service.uiManifest?.widgets ?? []).map((widget) => (
						<WidgetRenderer key={widget.id} widget={widget} service={service} />
					))}
				</div>
			);
		case "two-factor":
			return <TwoFactorSection serviceSlug={service.slug} />;
		case "passkey-manager":
			return <PasskeySection serviceSlug={service.slug} />;
		case "markdown":
			return (
				<MarkdownSection
					data={data as Parameters<typeof MarkdownSection>[0]["data"]}
					serviceSlug={service.slug}
					showToc={pageLayout === "reading"}
				/>
			);
		case "markdown-editor":
			return (
				<MarkdownEditorSection
					section={section}
					serviceSlug={service.slug}
					pathParams={pathParams}
				/>
			);
		case "search":
			return <SearchSection section={section} serviceSlug={service.slug} />;
		case "cards":
			return (
				<CardsSection
					section={section}
					data={data as Parameters<typeof CardsSection>[0]["data"]}
					serviceSlug={service.slug}
				/>
			);
		case "tabs":
			return (
				<TabsSection
					section={section}
					data={data as unknown[][]}
					service={service}
					pathParams={pathParams}
					pageLayout={pageLayout}
				/>
			);
		case "stats-row":
			return (
				<StatsRowSection
					section={section}
					data={data as Parameters<typeof StatsRowSection>[0]["data"]}
				/>
			);
		case "callout":
			return <CalloutSection section={section} />;
		case "empty-state":
			return <EmptyStateSection section={section} serviceSlug={service.slug} />;
		case "hero":
			return <HeroSection section={section} serviceSlug={service.slug} />;
		case "timeline":
			return (
				<TimelineSection
					section={section}
					data={data as Parameters<typeof TimelineSection>[0]["data"]}
					serviceSlug={service.slug}
				/>
			);
		case "calendar-month":
			return (
				<Suspense fallback={<SectionSkeleton />}>
					<CalendarMonthSection
						config={section.config as CalendarMonthConfig}
						data={data as ScheduleData}
						serviceSlug={service.slug}
						sectionKey={`cal${sectionIndex}`}
					/>
				</Suspense>
			);
		case "calendar-day":
			return (
				<Suspense fallback={<SectionSkeleton />}>
					<CalendarDaySection
						config={section.config as CalendarDayConfig}
						data={data as ScheduleData}
						serviceSlug={service.slug}
						sectionKey={`cal${sectionIndex}`}
					/>
				</Suspense>
			);
		case "calendar-grid":
			return (
				<Suspense fallback={<SectionSkeleton />}>
					<CalendarGridSection
						config={section.config as CalendarGridConfig}
						data={data as ScheduleData}
						serviceSlug={service.slug}
						sectionKey={`cal${sectionIndex}`}
					/>
				</Suspense>
			);
		case "agenda":
			return (
				<Suspense fallback={<SectionSkeleton />}>
					<AgendaSection
						config={section.config as AgendaConfig}
						data={data as ScheduleData}
						serviceSlug={service.slug}
						sectionKey={`cal${sectionIndex}`}
					/>
				</Suspense>
			);
		case "upcoming-strip":
			return (
				<Suspense fallback={<SectionSkeleton />}>
					<UpcomingStripSection
						config={section.config as UpcomingStripConfig}
						data={data as ScheduleData}
					/>
				</Suspense>
			);
		case "approval-queue":
			return (
				<Suspense fallback={<SectionSkeleton />}>
					<ApprovalQueueSection
						config={section.config as ApprovalQueueConfig}
						data={data as ApprovalQueueData}
						serviceSlug={service.slug}
					/>
				</Suspense>
			);
		case "kanban":
			return (
				<Suspense fallback={<SectionSkeleton height={500} />}>
					<KanbanSection
						config={section.config as KanbanConfig}
						data={data as KanbanData}
						serviceSlug={service.slug}
						sectionIndex={sectionIndex}
					/>
				</Suspense>
			);
		default:
			return (
				<div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-6">
					<p className="text-sm text-[var(--fg-muted)]">
						Unknown section type: {section.type}
					</p>
				</div>
			);
	}
}
