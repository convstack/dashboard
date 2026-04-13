import type {
	PageDefinition,
	TopBarContribution,
} from "@convstack/service-sdk/types";
import { useEffect } from "react";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { useTopBarContext } from "~/lib/use-topbar-context";
import { SectionRenderer } from "./section-renderer";

interface Props {
	page: PageDefinition;
	service: ServiceCatalogEntry;
	sectionData: (unknown | null)[];
	pathParams?: Record<string, string>;
}

/** Extract topBar envelope from the first non-null section data entry that has one. */
function extractTopBar(
	sectionData: (unknown | null)[],
): TopBarContribution | null {
	for (const data of sectionData) {
		if (data && typeof data === "object" && "topBar" in data) {
			const topBar = (data as { topBar?: TopBarContribution }).topBar;
			if (topBar) return topBar;
		}
	}
	return null;
}

/** Map the new layout values to Tailwind max-width classes.
 * Padding lives on `<main>` in DashboardShell so plain non-DynamicPage routes
 * inherit it. These classes only handle width-capping and centering on top of that. */
function layoutClasses(layout: PageDefinition["layout"]): string {
	switch (layout) {
		case "reading":
			return "mx-auto w-full max-w-[720px]";
		case "default":
			return "mx-auto w-full max-w-[1280px]";
		case "wide":
			return "mx-auto w-full max-w-[1600px]";
		case "full":
			return "w-full";
		case "split":
			return "mx-auto w-full max-w-[1280px]";
		default:
			return "mx-auto w-full max-w-[1280px]";
	}
}

export function DynamicPage({
	page,
	service,
	sectionData,
	pathParams = {},
}: Props) {
	const { set: setTopBar } = useTopBarContext();

	// Push the topBar envelope (or null for fallback) to the shared context
	// whenever the section data changes, and clear it on unmount so navigating
	// from a service page to a non-DynamicPage route (e.g. /home) doesn't leave
	// the previous service's actions stranded in the top bar.
	useEffect(() => {
		setTopBar(extractTopBar(sectionData));
		return () => setTopBar(null);
	}, [sectionData, setTopBar]);

	const layoutClass = layoutClasses(page.layout);
	const isSplit = page.layout === "split";

	return (
		<div className={layoutClass}>
			<div
				className={
					isSplit ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : "space-y-6"
				}
			>
				{page.sections.map((section, idx) => {
					const data = sectionData[idx] ?? null;
					const key = `${section.type}-${idx}`;
					return (
						<SectionRenderer
							key={key}
							section={section}
							data={data}
							service={service}
							pathParams={pathParams}
							pageLayout={page.layout}
							sectionIndex={idx}
						/>
					);
				})}
			</div>
		</div>
	);
}
