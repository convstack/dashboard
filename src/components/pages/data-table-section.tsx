import type {
	BadgeValue,
	DataTableColumn,
	DataTableConfig,
	EmptyStateConfig,
	PageSection,
	RowAction,
} from "@convstack/service-sdk/types";
import { useRouter } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { formatCellByType, formatCellValue } from "~/lib/format";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import { EmptyStateSection } from "./empty-state-section";

interface TableData {
	columns: DataTableColumn[];
	rows: Record<string, unknown>[];
	total?: number;
	rowActions?: RowAction[];
	emptyState?: EmptyStateConfig;
}

interface Props {
	section: PageSection;
	data: TableData | null;
	pathParams: Record<string, string>;
	serviceSlug: string;
}

interface PendingAction {
	action: RowAction;
	endpoint: string;
}

type SortState = { column: string; direction: "asc" | "desc" } | null;

function buildRowKey(row: Record<string, unknown>, idx: number): string {
	const id = row.id ?? row.key ?? row.slug;
	return id !== undefined ? String(id) : `row-${idx}`;
}

function buildAllParams(
	row: Record<string, unknown>,
	pathParams: Record<string, string>,
): Record<string, string> {
	const rowStrings: Record<string, string> = {};
	for (const [k, v] of Object.entries(row)) {
		if (typeof v === "string" || typeof v === "number") {
			rowStrings[k] = String(v);
		}
	}
	return { ...pathParams, ...rowStrings };
}

/**
 * Determine if a column is sortable. Explicit `sortable: false` disables;
 * otherwise defaults to true for string/number/date/currency types.
 */
function isSortable(column: DataTableColumn): boolean {
	if (column.sortable === false) return false;
	if (column.sortable === true) return true;
	const type = column.type ?? "string";
	return (
		type === "string" ||
		type === "number" ||
		type === "date" ||
		type === "currency"
	);
}

/**
 * Compare two values for sorting. Returns -1, 0, or 1.
 */
function compareValues(
	a: unknown,
	b: unknown,
	type: DataTableColumn["type"],
): number {
	if (a == null && b == null) return 0;
	if (a == null) return -1;
	if (b == null) return 1;
	if (type === "number" || type === "currency") {
		const an = Number(a);
		const bn = Number(b);
		return an < bn ? -1 : an > bn ? 1 : 0;
	}
	if (type === "date") {
		const at = new Date(String(a)).getTime();
		const bt = new Date(String(b)).getTime();
		return at - bt;
	}
	return String(a).localeCompare(String(b));
}

/**
 * Debounce a value: returns a copy that updates `delay` ms after the
 * source stops changing. Used for the filter input.
 */
function useDebounced<T>(value: T, delay = 200): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

/**
 * Render a cell value according to its column type.
 */
function renderCell(value: unknown, column: DataTableColumn): React.ReactNode {
	const formatted = formatCellByType(value, column);
	const type = column.type ?? "string";

	if (
		type === "badge" &&
		typeof formatted === "object" &&
		formatted &&
		"label" in formatted
	) {
		return <Badge value={formatted as BadgeValue} size="sm" />;
	}
	if (
		type === "avatar" &&
		typeof formatted === "object" &&
		formatted &&
		"name" in formatted
	) {
		const obj = formatted as { name: string; avatar?: string };
		return (
			<div className="flex items-center gap-2">
				{obj.avatar ? (
					<img
						src={obj.avatar}
						alt=""
						className="h-6 w-6 rounded-full object-cover"
					/>
				) : (
					<div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--accent-muted) text-[10px] font-medium text-(--accent)">
						{obj.name.charAt(0).toUpperCase()}
					</div>
				)}
				<span>{obj.name}</span>
			</div>
		);
	}
	if (
		type === "link" &&
		typeof formatted === "object" &&
		formatted &&
		"url" in formatted
	) {
		const obj = formatted as { label: string; url: string };
		return (
			<a
				href={obj.url}
				className="text-(--accent) hover:underline"
				onClick={(e) => e.stopPropagation()}
				target="_blank"
				rel="noreferrer"
			>
				{obj.label}
			</a>
		);
	}
	if (type === "code") {
		return (
			<code className="rounded bg-(--surface-2) px-1.5 py-0.5 font-mono text-xs text-(--fg-muted)">
				{String(formatted)}
			</code>
		);
	}
	return <span suppressHydrationWarning>{formatCellValue(formatted)}</span>;
}

export function DataTableSection({
	section,
	data,
	pathParams,
	serviceSlug,
}: Props) {
	const router = useRouter();
	const config = section.config as unknown as DataTableConfig;
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(
		null,
	);
	const [sort, setSort] = useState<SortState>(null);
	const [filterInput, setFilterInput] = useState("");
	const debouncedFilter = useDebounced(filterInput);

	const filterable = config.filterable !== false;
	const sortable = config.sortable !== false;

	const filteredRows = useMemo(() => {
		const rows = Array.isArray(data?.rows) ? data.rows : [];
		const columns = Array.isArray(data?.columns) ? data.columns : [];
		if (!debouncedFilter.trim()) return rows;
		const needle = debouncedFilter.trim().toLowerCase();
		return rows.filter((row) =>
			columns.some((col) => {
				const value = row[col.key];
				if (value == null) return false;
				return String(value).toLowerCase().includes(needle);
			}),
		);
	}, [data, debouncedFilter]);

	const sortedRows = useMemo(() => {
		if (!data || !sort || !sortable) return filteredRows;
		if (!Array.isArray(data.columns)) return filteredRows;
		const col = data.columns.find((c) => c.key === sort.column);
		if (!col) return filteredRows;
		const copy = [...filteredRows];
		copy.sort((a, b) => {
			const cmp = compareValues(a[col.key], b[col.key], col.type);
			return sort.direction === "asc" ? cmp : -cmp;
		});
		return copy;
	}, [data, sort, sortable, filteredRows]);

	if (!data) {
		return (
			<div className="rounded-lg border border-(--border) p-6">
				<p className="text-sm text-(--fg-muted)">Loading...</p>
			</div>
		);
	}

	if (!Array.isArray(data.rows) || !Array.isArray(data.columns)) {
		return (
			<div className="rounded-lg border border-dashed border-(--border) p-6 text-center text-sm text-(--fg-muted)">
				No data
			</div>
		);
	}

	if (data.rows.length === 0) {
		const interpolatedCreateLink = config.createLink
			? interpolateEndpoint(config.createLink, pathParams)
			: undefined;
		const fallback: EmptyStateConfig = data.emptyState ??
			config.emptyState ?? {
				icon: "inbox",
				title: config.title
					? `No ${config.title.toLowerCase()} yet`
					: "No items yet",
				action: interpolatedCreateLink
					? {
							label: config.createLabel ?? "Create",
							link: interpolatedCreateLink,
						}
					: undefined,
			};
		return <EmptyStateSection config={fallback} serviceSlug={serviceSlug} />;
	}

	async function executeAction(action: RowAction, endpoint: string) {
		await fetch(`/api/proxy/${serviceSlug}${endpoint}`, {
			method: action.method,
		});
		router.invalidate();
	}

	function handleRowClick(row: Record<string, unknown>) {
		if (!config.rowLink) return;
		const allParams = buildAllParams(row, pathParams);
		const path = interpolateEndpoint(config.rowLink, allParams);
		const splat = path.startsWith("/") ? path.slice(1) : path;
		router.navigate({
			to: "/$service/$",
			params: { service: serviceSlug, _splat: splat },
		});
	}

	function toggleSort(columnKey: string) {
		setSort((prev) => {
			if (!prev || prev.column !== columnKey) {
				return { column: columnKey, direction: "asc" };
			}
			if (prev.direction === "asc") {
				return { column: columnKey, direction: "desc" };
			}
			return null;
		});
	}

	const rowActions = config.readOnly
		? []
		: [...(config.rowActions ?? []), ...(data.rowActions ?? [])];
	const hasRowActions = rowActions.length > 0;

	return (
		<div className="rounded-lg border border-(--border) overflow-hidden">
			{(config.title || config.createLink || filterable) && (
				<div className="border-b border-(--border) px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					{config.title ? (
						<h3 className="text-sm font-semibold text-(--fg)">
							{config.title}
						</h3>
					) : (
						<div />
					)}
					<div className="flex items-center gap-2">
						{filterable && (
							<div className="relative">
								<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--fg-subtle)" />
								<input
									type="search"
									value={filterInput}
									onChange={(e) => setFilterInput(e.target.value)}
									placeholder="Filter..."
									className="h-8 rounded-(--radius) border border-(--border) bg-(--surface-1) pl-8 pr-3 text-sm text-(--fg) placeholder:text-(--fg-subtle) focus:border-(--accent) focus:outline-none"
								/>
							</div>
						)}
						{config.createLink && !config.readOnly && (
							<button
								type="button"
								onClick={() => {
									const link = interpolateEndpoint(
										config.createLink ?? "",
										pathParams,
									);
									router.navigate({
										to: "/$service/$",
										params: {
											service: serviceSlug,
											_splat: link.replace(/^\//, ""),
										},
									});
								}}
								className="rounded-(--radius) bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--accent-fg) hover:bg-(--accent-hover)"
							>
								{config.createLabel || "Create"}
							</button>
						)}
					</div>
				</div>
			)}
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead className="sticky top-0 z-10 bg-(--surface-2)">
						<tr className="border-b border-(--border)">
							{data.columns.map((col) => {
								const sortableCol = sortable && isSortable(col);
								const isActive = sort?.column === col.key;
								return (
									<th
										key={col.key}
										className="px-4 py-3 text-left text-xs font-medium text-(--fg-muted) uppercase tracking-wider"
									>
										{sortableCol ? (
											<button
												type="button"
												onClick={() => toggleSort(col.key)}
												className="flex items-center gap-1 hover:text-(--fg)"
											>
												{col.label}
												{isActive && sort.direction === "asc" && (
													<ChevronUp className="h-3 w-3" />
												)}
												{isActive && sort.direction === "desc" && (
													<ChevronDown className="h-3 w-3" />
												)}
											</button>
										) : (
											col.label
										)}
									</th>
								);
							})}
							{hasRowActions && (
								<th className="px-4 py-3 text-left text-xs font-medium text-(--fg-muted) uppercase tracking-wider">
									Actions
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{sortedRows.map((row, idx) => (
							<tr
								key={buildRowKey(row, idx)}
								onClick={config.rowLink ? () => handleRowClick(row) : undefined}
								className={`border-b border-(--border) last:border-b-0 hover:bg-(--surface-2) ${config.rowLink ? "cursor-pointer" : ""}`}
							>
								{data.columns.map((col) => (
									<td
										key={col.key}
										className="px-4 py-3"
										suppressHydrationWarning
									>
										{renderCell(row[col.key], col)}
									</td>
								))}
								{hasRowActions && (
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											{rowActions.map((action) => {
												const allParams = buildAllParams(row, pathParams);
												const interpolated = interpolateEndpoint(
													action.endpoint,
													allParams,
												);
												return (
													<button
														key={action.label}
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															if (action.confirm) {
																setPendingAction({
																	action,
																	endpoint: interpolated,
																});
															} else {
																executeAction(action, interpolated);
															}
														}}
														className={`text-xs font-medium hover:underline ${action.variant === "danger" ? "text-(--danger)" : "text-(--accent)"}`}
													>
														{action.label}
													</button>
												);
											})}
										</div>
									</td>
								)}
							</tr>
						))}
						{sortedRows.length === 0 && (
							<tr>
								<td
									colSpan={data.columns.length + (hasRowActions ? 1 : 0)}
									className="px-4 py-8 text-center text-(--fg-muted)"
								>
									No results match your filter
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			{data.total !== undefined && (
				<div className="border-t border-(--border) px-4 py-2 text-xs text-(--fg-muted)">
					{data.total} total items
				</div>
			)}
			{pendingAction && (
				<ConfirmDialog
					open={true}
					title="Confirm Action"
					message={pendingAction.action.confirm ?? "Are you sure?"}
					variant={
						pendingAction.action.variant === "danger" ? "danger" : "default"
					}
					onConfirm={() => {
						const { action, endpoint } = pendingAction;
						setPendingAction(null);
						executeAction(action, endpoint);
					}}
					onCancel={() => setPendingAction(null)}
				/>
			)}
		</div>
	);
}
