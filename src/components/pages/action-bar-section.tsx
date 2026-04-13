import type { PageSection, RowAction } from "@convstack/service-sdk/types";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { interpolateEndpoint } from "~/lib/manifest-routing";

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
	const [secretResponse, setSecretResponse] = useState<{
		secrets: Record<string, string>;
		message?: string;
	} | null>(null);
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
				const body = await response.json().catch(() => null);

				// Check for secrets in response
				const secrets: Record<string, string> = {};
				if (body?.apiKey) secrets.apiKey = body.apiKey;
				if (body?.clientSecret) secrets.clientSecret = body.clientSecret;

				if (Object.keys(secrets).length > 0) {
					setSecretResponse({
						secrets,
						message: body?.message,
					});
				} else if (action.redirect || body?.redirect) {
					const target = action.redirect || body.redirect;
					router.navigate({
						to: "/$service/$",
						params: {
							service: serviceSlug,
							_splat: target.replace(/^\//, ""),
						},
					});
				} else {
					setResult({ ok: true, message: "Action completed successfully" });
					router.invalidate();
				}
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

	if (secretResponse) {
		const labels: Record<string, string> = {
			apiKey: "API Key",
			clientSecret: "Client Secret",
		};
		return (
			<div className="rounded-lg border border-(--border) p-4 space-y-4">
				{secretResponse.message && (
					<div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
						{secretResponse.message}
					</div>
				)}
				<div className="space-y-3">
					{Object.entries(secretResponse.secrets).map(([key, value]) => (
						<div key={key}>
							<p className="text-xs font-medium text-(--muted-foreground)">
								{labels[key] || key}
							</p>
							<div className="mt-1 flex items-center gap-2">
								<code className="flex-1 block rounded bg-(--muted) px-3 py-2 text-sm font-mono break-all">
									{value}
								</code>
								<button
									type="button"
									onClick={() => navigator.clipboard.writeText(value)}
									className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--surface-2)]"
								>
									Copy
								</button>
							</div>
						</div>
					))}
				</div>
				<button
					type="button"
					onClick={() => setSecretResponse(null)}
					className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)]"
				>
					Done
				</button>
			</div>
		);
	}

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
