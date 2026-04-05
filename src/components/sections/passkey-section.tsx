import { startRegistration } from "@simplewebauthn/browser";
import { useCallback, useEffect, useState } from "react";
import { formatDateShort } from "~/lib/format";

interface Props {
	serviceSlug: string;
}

interface Passkey {
	id: string;
	name: string;
	credentialID: string;
	createdAt: string;
}

export function PasskeySection({ serviceSlug }: Props) {
	const [passkeys, setPasskeys] = useState<Passkey[]>([]);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const fetchPasskeys = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/proxy/${serviceSlug}/api/user/passkeys`);
			if (res.ok) {
				const data = await res.json();
				setPasskeys(data?.data ?? []);
			}
		} catch {
			// leave passkeys empty
		}
		setLoading(false);
	}, [serviceSlug]);

	useEffect(() => {
		fetchPasskeys();
	}, [fetchPasskeys]);

	async function handleRegister() {
		const name = prompt("Enter a name for this passkey:");
		if (!name) return;

		setActionLoading(true);
		setError("");
		setSuccess("");
		try {
			const optionsRes = await fetch(
				`/api/proxy/${serviceSlug}/api/auth/passkey/generate-registration-options`,
				{ method: "POST" },
			);
			if (!optionsRes.ok) {
				const data = await optionsRes.json().catch(() => null);
				setError(data?.error ?? `Error: ${optionsRes.status}`);
				setActionLoading(false);
				return;
			}
			const options = await optionsRes.json();

			let attestation: Awaited<ReturnType<typeof startRegistration>>;
			try {
				attestation = await startRegistration({ optionsJSON: options });
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: "Passkey registration cancelled.",
				);
				setActionLoading(false);
				return;
			}

			const verifyRes = await fetch(
				`/api/proxy/${serviceSlug}/api/auth/passkey/verify-registration`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ...attestation, name }),
				},
			);
			if (!verifyRes.ok) {
				const data = await verifyRes.json().catch(() => null);
				setError(data?.error ?? `Error: ${verifyRes.status}`);
			} else {
				setSuccess("Passkey registered successfully.");
				await fetchPasskeys();
			}
		} catch {
			setError("Network error");
		}
		setActionLoading(false);
	}

	async function handleDelete(id: string) {
		const password = prompt("Enter your password to delete this passkey:");
		if (!password) return;

		setActionLoading(true);
		setError("");
		setSuccess("");
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}/api/user/passkeys/${id}/delete`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
				},
			);
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setError(data?.error ?? `Error: ${res.status}`);
			} else if (data?.status === true) {
				setPasskeys((prev) => prev.filter((p) => p.id !== id));
				setSuccess("Passkey deleted successfully.");
			} else {
				setError("Failed to delete passkey. Please try again.");
			}
		} catch {
			setError("Network error");
		}
		setActionLoading(false);
	}

	return (
		<div className="rounded-lg border border-(--border) bg-(--card) p-6">
			<div className="flex items-start justify-between">
				<div>
					<h2 className="text-base font-semibold">Passkeys</h2>
					<p className="mt-1 text-sm text-(--muted-foreground)">
						Use biometrics or security keys for passwordless authentication.
					</p>
				</div>
				<button
					type="button"
					disabled={actionLoading}
					onClick={handleRegister}
					className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90 disabled:opacity-50"
				>
					Register Passkey
				</button>
			</div>

			<div className="mt-4 space-y-3">
				{error && (
					<div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
						{error}
					</div>
				)}
				{success && (
					<div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
						{success}
					</div>
				)}

				{loading && (
					<div className="space-y-2">
						{[1, 2].map((i) => (
							<div
								key={i}
								className="h-12 animate-pulse rounded-md bg-(--muted)"
							/>
						))}
					</div>
				)}

				{!loading && passkeys.length === 0 && (
					<p className="text-sm text-(--muted-foreground)">
						No passkeys registered.
					</p>
				)}

				{!loading && passkeys.length > 0 && (
					<ul className="divide-y divide-(--border)">
						{passkeys.map((passkey) => (
							<li
								key={passkey.id}
								className="flex items-center justify-between py-3"
							>
								<div>
									<p className="text-sm font-medium">{passkey.name}</p>
									<p className="text-xs text-(--muted-foreground)">
										Created {formatDateShort(passkey.createdAt)}
									</p>
								</div>
								<button
									type="button"
									disabled={actionLoading}
									onClick={() => handleDelete(passkey.id)}
									className="rounded-md border border-red-500 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
								>
									Delete
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
