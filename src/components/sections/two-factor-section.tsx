import { useEffect, useState } from "react";

interface Props {
	serviceSlug: string;
}

type Step =
	| "idle"
	| "password-prompt"
	| "totp-uri"
	| "verify-code"
	| "disable-prompt";

export function TwoFactorSection({ serviceSlug }: Props) {
	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [loading, setLoading] = useState(true);
	const [step, setStep] = useState<Step>("idle");
	const [password, setPassword] = useState("");
	const [totpURI, setTotpURI] = useState("");
	const [code, setCode] = useState("");
	const [actionLoading, setActionLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	useEffect(() => {
		async function fetchStatus() {
			setLoading(true);
			try {
				const res = await fetch(
					`/api/proxy/${serviceSlug}/api/user/2fa/status`,
				);
				if (res.ok) {
					const data = await res.json();
					setEnabled(data?.enabled ?? false);
				}
			} catch {
				// leave enabled as null
			}
			setLoading(false);
		}
		fetchStatus();
	}, [serviceSlug]);

	function reset() {
		setStep("idle");
		setPassword("");
		setTotpURI("");
		setCode("");
		setError("");
		setSuccess("");
	}

	async function handleEnable() {
		setActionLoading(true);
		setError("");
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}/api/auth/two-factor/enable`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ password }),
				},
			);
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setError(data?.error ?? `Error: ${res.status}`);
			} else {
				setTotpURI(data?.totpURI ?? "");
				setPassword("");
				setStep("totp-uri");
			}
		} catch {
			setError("Network error");
		}
		setActionLoading(false);
	}

	async function handleVerify() {
		setActionLoading(true);
		setError("");
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}/api/auth/two-factor/verify-totp`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ code }),
				},
			);
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setError(data?.error ?? `Error: ${res.status}`);
			} else if (data?.status === true) {
				setEnabled(true);
				setSuccess("Two-factor authentication has been enabled.");
				setStep("idle");
				setCode("");
				setTotpURI("");
			} else {
				setError("Verification failed. Please try again.");
			}
		} catch {
			setError("Network error");
		}
		setActionLoading(false);
	}

	async function handleDisable() {
		setActionLoading(true);
		setError("");
		try {
			const res = await fetch(
				`/api/proxy/${serviceSlug}/api/auth/two-factor/disable`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ password }),
				},
			);
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setError(data?.error ?? `Error: ${res.status}`);
			} else if (data?.status === true) {
				setEnabled(false);
				setSuccess("Two-factor authentication has been disabled.");
				reset();
			} else {
				setError("Failed to disable 2FA. Please try again.");
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
					<h2 className="text-base font-semibold">Two-Factor Authentication</h2>
					<p className="mt-1 text-sm text-(--muted-foreground)">
						Add an extra layer of security with TOTP-based 2FA.
					</p>
				</div>
				{!loading && enabled !== null && (
					<span
						className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
							enabled
								? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
								: "bg-(--muted) text-(--muted-foreground)"
						}`}
					>
						{enabled ? "Enabled" : "Disabled"}
					</span>
				)}
			</div>

			{loading && (
				<div className="mt-4 h-4 w-24 animate-pulse rounded bg-(--muted)" />
			)}

			{!loading && (
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

					{/* Disabled state */}
					{!enabled && step === "idle" && (
						<button
							type="button"
							onClick={() => {
								setError("");
								setSuccess("");
								setStep("password-prompt");
							}}
							className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
						>
							Enable 2FA
						</button>
					)}

					{!enabled && step === "password-prompt" && (
						<div className="space-y-3">
							<div>
								<label
									htmlFor="tfa-password"
									className="block text-sm font-medium"
								>
									Confirm your password
								</label>
								<input
									id="tfa-password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Enter your password"
									className="mt-1 block w-full max-w-sm rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
								/>
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={actionLoading || !password}
									onClick={handleEnable}
									className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90 disabled:opacity-50"
								>
									{actionLoading ? "Please wait..." : "Continue"}
								</button>
								<button
									type="button"
									onClick={reset}
									className="rounded-md border border-(--border) px-4 py-2 text-sm font-medium text-(--foreground) hover:bg-(--muted)"
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					{!enabled && step === "totp-uri" && (
						<div className="space-y-4">
							<div>
								<p className="text-sm font-medium">
									Copy this URI into your authenticator app:
								</p>
								<code className="mt-2 block break-all rounded-md bg-(--muted) px-3 py-2 text-xs">
									{totpURI}
								</code>
							</div>
							<div>
								<label htmlFor="tfa-code" className="block text-sm font-medium">
									Enter the 6-digit code from your app
								</label>
								<input
									id="tfa-code"
									type="text"
									inputMode="numeric"
									maxLength={6}
									value={code}
									onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
									placeholder="000000"
									className="mt-1 block w-40 rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm tracking-widest"
								/>
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={actionLoading || code.length !== 6}
									onClick={handleVerify}
									className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90 disabled:opacity-50"
								>
									{actionLoading ? "Verifying..." : "Verify"}
								</button>
								<button
									type="button"
									onClick={reset}
									className="rounded-md border border-(--border) px-4 py-2 text-sm font-medium text-(--foreground) hover:bg-(--muted)"
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					{/* Enabled state */}
					{enabled && step === "idle" && (
						<button
							type="button"
							onClick={() => {
								setError("");
								setSuccess("");
								setStep("disable-prompt");
							}}
							className="rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
						>
							Disable 2FA
						</button>
					)}

					{enabled && step === "disable-prompt" && (
						<div className="space-y-3">
							<div>
								<label
									htmlFor="tfa-disable-password"
									className="block text-sm font-medium"
								>
									Confirm your password to disable 2FA
								</label>
								<input
									id="tfa-disable-password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Enter your password"
									className="mt-1 block w-full max-w-sm rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
								/>
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									disabled={actionLoading || !password}
									onClick={handleDisable}
									className="rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
								>
									{actionLoading ? "Please wait..." : "Disable"}
								</button>
								<button
									type="button"
									onClick={reset}
									className="rounded-md border border-(--border) px-4 py-2 text-sm font-medium text-(--foreground) hover:bg-(--muted)"
								>
									Cancel
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
