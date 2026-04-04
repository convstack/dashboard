import { PasskeySection } from "~/components/sections/passkey-section";
import { TwoFactorSection } from "~/components/sections/two-factor-section";
import { WidgetRenderer } from "~/components/widgets/widget-renderer";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";
import type { PageDefinition } from "~/lib/types/manifest";
import { ActionBarSection } from "./action-bar-section";
import { DataTableSection } from "./data-table-section";
import { DetailSection } from "./detail-section";
import { FormSection } from "./form-section";
import { MarkdownEditorSection } from "./markdown-editor-section";
import { MarkdownSection } from "./markdown-section";

interface Props {
	page: PageDefinition;
	service: ServiceCatalogEntry;
	sectionData: (unknown | null)[];
	pathParams?: Record<string, string>;
}

export function DynamicPage({
	page,
	service,
	sectionData,
	pathParams = {},
}: Props) {
	return (
		<div>
			{page.showBack && (
				<button
					type="button"
					onClick={() => window.history.back()}
					className="mb-2 flex items-center gap-1 text-sm text-(--muted-foreground) hover:text-(--foreground) transition-colors"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={2}
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
						/>
					</svg>
					Back
				</button>
			)}
			<h1 className="text-2xl font-bold">{page.title}</h1>

			<div
				className={`mt-6 space-y-6 ${
					page.layout === "split"
						? "grid grid-cols-1 gap-6 space-y-0 lg:grid-cols-2"
						: page.layout === "full-width"
							? "max-w-none"
							: ""
				}`}
			>
				{page.sections.map((section, idx) => {
					const data = sectionData[idx] ?? null;
					const key = `${section.type}-${idx}`;

					switch (section.type) {
						case "data-table":
							return (
								<DataTableSection
									key={key}
									section={section}
									data={data as Parameters<typeof DataTableSection>[0]["data"]}
									pathParams={pathParams}
									serviceSlug={service.slug}
								/>
							);
						case "detail":
							return (
								<DetailSection
									key={key}
									section={section}
									data={data as Parameters<typeof DetailSection>[0]["data"]}
								/>
							);
						case "form":
							return (
								<FormSection
									key={key}
									section={section}
									serviceSlug={service.slug}
									pathParams={pathParams}
								/>
							);
						case "action-bar":
							return (
								<ActionBarSection
									key={key}
									section={section}
									data={data as Parameters<typeof ActionBarSection>[0]["data"]}
									pathParams={pathParams}
									serviceSlug={service.slug}
								/>
							);
						case "widget-grid":
							return (
								<div
									key={key}
									className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
								>
									{(service.uiManifest?.widgets ?? []).map((widget) => (
										<WidgetRenderer
											key={widget.id}
											widget={widget}
											service={service}
										/>
									))}
								</div>
							);
						case "two-factor":
							return <TwoFactorSection key={key} serviceSlug={service.slug} />;
						case "passkey-manager":
							return <PasskeySection key={key} serviceSlug={service.slug} />;
						case "markdown":
							return (
								<MarkdownSection
									key={key}
									data={data as Parameters<typeof MarkdownSection>[0]["data"]}
									serviceSlug={service.slug}
								/>
							);
						case "markdown-editor":
							return (
								<MarkdownEditorSection
									key={key}
									section={section}
									serviceSlug={service.slug}
									pathParams={pathParams}
								/>
							);
						default:
							return (
								<div
									key={key}
									className="rounded-lg border border-dashed border-(--border) p-6"
								>
									<p className="text-sm text-(--muted-foreground)">
										Unknown section type: {section.type}
									</p>
								</div>
							);
					}
				})}
			</div>
		</div>
	);
}
