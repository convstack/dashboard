import type { BadgeValue, DataTableColumn } from "@convstack/service-sdk/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Format a value for display. Detects ISO date strings and formats
 * them in the user's local timezone and locale.
 */
export function formatCellValue(value: unknown): string {
	if (value == null) return "";
	const str = String(value);
	if (ISO_DATE_RE.test(str)) {
		return formatDate(str);
	}
	return str;
}

/**
 * Format an ISO date string or Date in the user's local timezone.
 * Returns a human-readable string like "5 apr 2026, 18:23" (locale-dependent).
 */
export function formatDate(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return String(date);
	return d.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Format an ISO date string or Date as date only (no time).
 */
export function formatDateShort(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return String(date);
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/**
 * Format a raw cell value according to the column's declared type.
 * Returns a string for primitive types; returns a structured object for
 * `badge`, `avatar`, and `link` that the renderer handles specially.
 */
export function formatCellByType(
	value: unknown,
	column: DataTableColumn,
):
	| string
	| BadgeValue
	| { name: string; avatar?: string }
	| { label: string; url: string }
	| null {
	if (value == null) return "";
	const type = column.type ?? "string";
	switch (type) {
		case "number":
			return typeof value === "number"
				? new Intl.NumberFormat().format(value)
				: String(value);
		case "date":
			return formatDate(String(value));
		case "currency": {
			const num = typeof value === "number" ? value : Number(value);
			if (Number.isNaN(num)) return String(value);
			return new Intl.NumberFormat(undefined, {
				style: "currency",
				currency: column.currency ?? "USD",
			}).format(num);
		}
		case "badge":
			if (typeof value === "object" && value !== null && "label" in value) {
				return value as BadgeValue;
			}
			return { label: String(value) };
		case "avatar":
			if (typeof value === "object" && value !== null && "name" in value) {
				return value as { name: string; avatar?: string };
			}
			return { name: String(value) };
		case "link":
			if (typeof value === "object" && value !== null && "url" in value) {
				return value as { label: string; url: string };
			}
			return { label: String(value), url: String(value) };
		case "code":
			return String(value);
		default:
			return String(value);
	}
}
