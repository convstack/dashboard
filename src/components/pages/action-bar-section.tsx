import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import type { PageSection, RowAction } from "~/lib/types/manifest";

interface Props {
	section: PageSection;
	data: { actions: RowAction[] } | null;
	pathParams: Record<string, string>;
	serviceSlug: string;
}

export function ActionBarSection({ data, pathParams, serviceSlug }: Props) {
	const router = useRouter();
	const [pendingAction, setPendingAction] = useState<RowAction | null>(null);
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
		null,
	);

	useEffect(() => {
		if (!result) return;
		const timer = setTimeout(() => setResult(null), 3000);
		return () => clearTimeout(timer);
	}, [result]);

	if (!data || !data.actions || data.actions.length === 0) {
		return null;
	}

	async function executeAction(action: RowAction) {
		setLoading(true);
		try {
			const endpoint = interpolateEndpoint(action.endpoint, pathParams);
			const response = await fetch(`/api/proxy/${serviceSlug}${endpoint}`, {
				method: action.method,
			});
			if (response.ok) {
				setResult({ ok: true, message: "Action completed successfully" });
				router.invalidate();
			} else {
				const body = await response.json().catch(() => null);
				setResult({
					ok: false,
					message: body?.error ?? `Error: ${response.status}`,
				});
			}
		} catch {
			setResult({ ok: false, message: "Network error" });
		}
		setLoading(false);
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-2">
				{data.actions.map((action) => (
					<button
						key={action.label}
						type="button"
						disabled={loading}
						onClick={() => {
							if (action.confirm) {
								setPendingAction(action);
							} else {
								executeAction(action);
							}
						}}
						className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
							action.variant === "danger"
								? "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
								: "border-(--border) text-(--foreground) hover:bg-(--muted)"
						}`}
					>
						{action.label}
					</button>
				))}
			</div>
			{result && (
				<p
					className={`text-sm ${result.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
				>
					{result.message}
				</p>
			)}
			{pendingAction && (
				<ConfirmDialog
					open={true}
					title="Confirm Action"
					message={pendingAction.confirm ?? "Are you sure?"}
					variant={pendingAction.variant === "danger" ? "danger" : "default"}
					onConfirm={() => {
						const action = pendingAction;
						setPendingAction(null);
						executeAction(action);
					}}
					onCancel={() => setPendingAction(null)}
				/>
			)}
		</div>
	);
}
