import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import type {
	DataTableConfig,
	PageSection,
	RowAction,
} from "~/lib/types/manifest";

interface TableData {
	columns: { key: string; label: string }[];
	rows: Record<string, unknown>[];
	total?: number;
	rowActions?: RowAction[];
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

	if (!data) {
		return (
			<div className="rounded-lg border border-(--border) p-6">
				<p className="text-sm text-(--muted-foreground)">Loading...</p>
			</div>
		);
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

	const rowActions = config.readOnly
		? []
		: [...(config.rowActions ?? []), ...(data?.rowActions ?? [])];
	const hasRowActions = rowActions.length > 0;

	return (
		<div className="rounded-lg border border-(--border) overflow-hidden">
			{(config.title || config.createLink) && (
				<div className="border-b border-(--border) px-4 py-3 flex items-center justify-between">
					{config.title ? (
						<h3 className="text-sm font-semibold">{config.title}</h3>
					) : (
						<div />
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
							className="rounded-md bg-(--primary) px-3 py-1.5 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
						>
							{config.createLabel || "Create"}
						</button>
					)}
				</div>
			)}
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-(--border) bg-(--muted)">
							{data.columns.map((col) => (
								<th
									key={col.key}
									className="px-4 py-3 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider"
								>
									{col.label}
								</th>
							))}
							{hasRowActions && (
								<th className="px-4 py-3 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
									Actions
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{data.rows.map((row, idx) => (
							<tr
								key={buildRowKey(row, idx)}
								onClick={config.rowLink ? () => handleRowClick(row) : undefined}
								className={`border-b border-(--border) last:border-b-0 hover:bg-(--accent) ${config.rowLink ? "cursor-pointer" : ""}`}
							>
								{data.columns.map((col) => (
									<td key={col.key} className="px-4 py-3">
										{String(row[col.key] ?? "")}
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
														className={`text-xs font-medium hover:underline ${action.variant === "danger" ? "text-red-600" : "text-(--primary)"}`}
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
						{data.rows.length === 0 && (
							<tr>
								<td
									colSpan={data.columns.length + (hasRowActions ? 1 : 0)}
									className="px-4 py-8 text-center text-(--muted-foreground)"
								>
									No data
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			{data.total !== undefined && (
				<div className="border-t border-(--border) px-4 py-2 text-xs text-(--muted-foreground)">
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
