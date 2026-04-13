import type {
	PageDefinition,
	PageSection,
	TabsConfig,
} from "@convstack/service-sdk/types";
import { useCallback, useEffect, useState } from "react";
import { DynamicIcon } from "~/components/layout/dynamic-icon";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import { SectionRenderer } from "./section-renderer";

interface Props {
	section: PageSection;
	/** Nested data array: outer index = tab, inner index = section within that tab */
	data: unknown[][] | null;
	service: ServiceCatalogEntry;
	pathParams: Record<string, string>;
	pageLayout?: PageDefinition["layout"];
}

/**
 * Read the current tab key from the URL hash (`#tab=key`). Returns null if
 * absent or malformed.
 */
function readTabFromHash(): string | null {
	if (typeof window === "undefined") return null;
	const hash = window.location.hash.replace(/^#/, "");
	const params = new URLSearchParams(hash);
	return params.get("tab");
}

/**
 * Write the current tab key into the URL hash (`#tab=key`) without a full
 * navigation. Uses history.replaceState so back-button behaves naturally.
 */
function writeTabToHash(key: string): void {
	if (typeof window === "undefined") return;
	const url = new URL(window.location.href);
	url.hash = `tab=${key}`;
	window.history.replaceState(null, "", url.toString());
}

export function TabsSection({
	section,
	data,
	service,
	pathParams,
	pageLayout,
}: Props) {
	const config = section.config as unknown as TabsConfig;
	const defaultKey = config.default ?? config.tabs[0]?.key ?? "";

	// Always initialize with the config default so the server and client
	// render the same tab on first paint (no hydration mismatch). The hash
	// is read in a client-only effect below.
	const [activeKey, setActiveKey] = useState<string>(defaultKey);

	// On mount (client-only), sync from the URL hash if present. Also
	// subscribe to hashchange for back-button support.
	useEffect(() => {
		const syncFromHash = () => {
			const fromHash = readTabFromHash();
			if (fromHash && config.tabs.some((t) => t.key === fromHash)) {
				setActiveKey(fromHash);
			}
		};
		// Initial sync on mount
		syncFromHash();
		window.addEventListener("hashchange", syncFromHash);
		return () => window.removeEventListener("hashchange", syncFromHash);
	}, [config.tabs]);

	const selectTab = useCallback((key: string) => {
		setActiveKey(key);
		writeTabToHash(key);
	}, []);

	const activeTabIndex = config.tabs.findIndex((t) => t.key === activeKey);
	const activeTab = config.tabs[activeTabIndex] ?? config.tabs[0];
	if (!activeTab) return null;

	const activeTabData = data?.[activeTabIndex] ?? [];

	return (
		<div className="space-y-4">
			{/* Tab bar */}
			<div
				role="tablist"
				className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)]"
			>
				{config.tabs.map((tab) => {
					const isActive = tab.key === activeKey;
					return (
						<button
							key={tab.key}
							type="button"
							role="tab"
							aria-selected={isActive}
							onClick={() => selectTab(tab.key)}
							className={`flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
								isActive
									? "border-b-2 border-[var(--accent)] text-[var(--fg)]"
									: "border-b-2 border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
							}`}
						>
							{tab.icon && <DynamicIcon name={tab.icon} className="h-4 w-4" />}
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Active tab panel */}
			<div role="tabpanel" className="space-y-6">
				{activeTab.sections.map((innerSection, idx) => {
					const key = `${innerSection.type}-${idx}`;
					return (
						<SectionRenderer
							key={key}
							section={innerSection}
							data={activeTabData[idx] ?? null}
							service={service}
							pathParams={pathParams}
							pageLayout={pageLayout}
							sectionIndex={idx}
						/>
					);
				})}
			</div>
		</div>
	);
}
