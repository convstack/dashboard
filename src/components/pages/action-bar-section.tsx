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
	const [result, setResult] = useState<{
		ok: boolean;
		message: string;
	} | null>(null);

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

	function handleClick(action: RowAction) {
		// Navigation action
		if (action.link) {
			router.navigate({
				to: "/$service/$",
				params: {
					service: serviceSlug,
					_splat: action.link.replace(/^\//, ""),
				},
			});
			return;
		}
		// Confirmation required
		if (action.confirm) {
			setPendingAction(action);
			return;
		}
		// Execute immediately
		executeAction(action);
	}

	const safeActions = data.actions.filter((a) => a.variant !== "danger");
	const dangerActions = data.actions.filter((a) => a.variant === "danger");

	return (
		<div className="rounded-lg border border-(--border) p-4 space-y-3">
			<div className="flex items-center justify-between gap-3">
				{/* Safe actions on the left */}
				<div className="flex flex-wrap gap-2">
					{safeActions.map((action) => (
						<button
							key={action.label}
							type="button"
							disabled={loading}
							onClick={() => handleClick(action)}
							className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90 disabled:opacity-50 transition-opacity"
						>
							{action.label}
						</button>
					))}
				</div>

				{/* Danger actions on the right */}
				{dangerActions.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{dangerActions.map((action) => (
							<button
								key={action.label}
								type="button"
								disabled={loading}
								onClick={() => handleClick(action)}
								className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
							>
								{action.label}
							</button>
						))}
					</div>
				)}
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
					title={pendingAction.label}
					message={pendingAction.confirm ?? "Are you sure?"}
					confirmLabel={pendingAction.label}
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
