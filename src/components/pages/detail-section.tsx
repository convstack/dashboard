import type {
	BadgeValue,
	DetailConfig,
	DetailField,
	DetailGroup,
	PageSection,
} from "@convstack/service-sdk/types";
import { Badge } from "~/components/ui/badge";
import { formatDate } from "~/lib/format";

interface DetailData {
	fields?: DetailField[];
	groups?: DetailGroup[];
}

interface Props {
	section: PageSection;
	data: DetailData | null;
}

function renderFieldValue(field: DetailField): React.ReactNode {
	const value = field.value;
	const type = field.type ?? "string";

	if (value == null) {
		return <span className="text-[var(--fg-subtle)]">—</span>;
	}

	switch (type) {
		case "boolean":
			return (
				<span className="text-sm font-medium">
					{value === true || value === "true" ? "Yes" : "No"}
				</span>
			);
		case "number":
			return (
				<span className="text-sm font-medium">
					{typeof value === "number"
						? new Intl.NumberFormat().format(value)
						: String(value)}
				</span>
			);
		case "date":
			return (
				<span className="text-sm font-medium" suppressHydrationWarning>
					{formatDate(String(value))}
				</span>
			);
		case "link":
			return (
				<a
					href={String(value)}
					target="_blank"
					rel="noreferrer"
					className="text-sm text-[var(--accent)] hover:underline"
				>
					{String(value)}
				</a>
			);
		case "badge":
			if (typeof value === "object" && value !== null && "label" in value) {
				return <Badge value={value as BadgeValue} />;
			}
			return <Badge value={{ label: String(value) }} />;
		case "code":
			return (
				<code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs text-[var(--fg)]">
					{String(value)}
				</code>
			);
		case "multiline":
			return (
				<pre className="whitespace-pre-wrap text-sm font-medium text-[var(--fg)]">
					{String(value)}
				</pre>
			);
		default:
			return (
				<span className="text-sm font-medium break-all">{String(value)}</span>
			);
	}
}

function FieldList({ fields }: { fields: DetailField[] }) {
	return (
		<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{fields.map((field) => (
				<div key={field.key} className="min-w-0">
					<dt className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">
						{field.label}
					</dt>
					<dd className="mt-1">{renderFieldValue(field)}</dd>
				</div>
			))}
		</dl>
	);
}

export function DetailSection({ section, data }: Props) {
	const config = section.config as unknown as DetailConfig;

	if (!data) {
		return (
			<div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6 animate-pulse">
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-6 rounded bg-[var(--surface-2)]" />
					))}
				</div>
			</div>
		);
	}

	// Grouped shape takes precedence over flat fields shape.
	if (data.groups && data.groups.length > 0) {
		return (
			<div className="space-y-6">
				{config.title && (
					<h3 className="text-sm font-semibold text-[var(--fg)]">
						{config.title}
					</h3>
				)}
				{data.groups.map((group) => (
					<div
						key={group.title}
						className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6"
					>
						<h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
							{group.title}
						</h4>
						<FieldList fields={group.fields} />
					</div>
				))}
			</div>
		);
	}

	// Flat shape (backwards-compatible).
	return (
		<div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6">
			{config.title && (
				<h3 className="mb-4 text-sm font-semibold text-[var(--fg)]">
					{config.title}
				</h3>
			)}
			<FieldList fields={data.fields ?? []} />
		</div>
	);
}
