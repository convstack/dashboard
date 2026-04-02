import type { DetailConfig, PageSection } from "~/lib/types/manifest";

interface DetailData {
	fields: { key: string; label: string; value: string | number | boolean }[];
}

interface Props {
	section: PageSection;
	data: DetailData | null;
}

export function DetailSection({ section, data }: Props) {
	const config = section.config as unknown as DetailConfig;

	if (!data) {
		return (
			<div className="rounded-lg border border-(--border) p-6 animate-pulse">
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-6 rounded bg-(--muted)" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-(--border) p-6">
			{config.title && (
				<h3 className="text-sm font-semibold mb-4">{config.title}</h3>
			)}
			<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{data.fields.map((field) => (
					<div key={field.key}>
						<dt className="text-sm text-(--muted-foreground)">{field.label}</dt>
						<dd className="mt-1 text-sm font-medium">
							{typeof field.value === "boolean"
								? field.value
									? "Yes"
									: "No"
								: String(field.value)}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
