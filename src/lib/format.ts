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
