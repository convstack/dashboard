import { useCallback, useEffect, useState } from "react";
import { SearchField } from "~/components/ui/search-field";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import type { FormConfig, PageSection } from "~/lib/types/manifest";

interface Props {
	section: PageSection;
	serviceSlug: string;
	pathParams: Record<string, string>;
}

export function FormSection({ section, serviceSlug, pathParams }: Props) {
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");
	const [values, setValues] = useState<Record<string, string>>({});
	const [prefilled, setPrefilled] = useState(false);
	const [secretResponse, setSecretResponse] = useState<{
		secrets: Record<string, string>;
		redirect?: string;
		message?: string;
	} | null>(null);

	const config = section.config as unknown as FormConfig;

	const endpoint = interpolateEndpoint(
		config.submitEndpoint || section.endpoint,
		pathParams,
	);

	// Pre-fill form values from a GET request to the same endpoint
	// The detail format { fields: [{ key, value }] } is parsed into key-value pairs
	const prefill = useCallback(async () => {
		if (!config?.fields || !endpoint) return;
		try {
			const response = await fetch(`/api/proxy/${serviceSlug}${endpoint}`);
			if (!response.ok) return;
			const data = await response.json();
			if (data?.fields && Array.isArray(data.fields)) {
				const initial: Record<string, string> = {};
				for (const field of data.fields) {
					if (field.key && field.value != null) {
						initial[field.key] = String(field.value);
					}
				}
				setValues(initial);
			}
		} catch {
			// Pre-fill is best-effort
		}
		setPrefilled(true);
	}, [serviceSlug, endpoint, config?.fields]);

	useEffect(() => {
		prefill();
	}, [prefill]);

	if (!config?.fields) {
		return (
			<div className="rounded-lg border border-(--border) p-6">
				<p className="text-sm text-(--muted-foreground)">
					Invalid form configuration
				</p>
			</div>
		);
	}

	const handleChange = (key: string, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		setSuccess(false);

		// Build body from current values (pre-filled + user changes)
		const body: Record<string, string> = {};
		for (const field of config.fields) {
			const val = values[field.key];
			if (val !== undefined) {
				body[field.key] = val;
			}
		}

		try {
			const response = await fetch(`/api/proxy/${serviceSlug}${endpoint}`, {
				method: (config.method as string) || "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const data = await response.json().catch(() => null);
				setError(data?.error || `Error: ${response.status}`);
			} else {
				const responseData = await response.json().catch(() => null);

				// Check if response contains secrets that need to be shown
				const secrets: Record<string, string> = {};
				if (responseData?.apiKey) secrets.apiKey = responseData.apiKey;
				if (responseData?.clientSecret)
					secrets.clientSecret = responseData.clientSecret;
				if (responseData?.clientId) secrets.clientId = responseData.clientId;

				if (Object.keys(secrets).length > 0) {
					setSecretResponse({
						secrets,
						redirect: responseData?.redirect,
						message: responseData?.message,
					});
				} else if (responseData?.redirect) {
					window.location.href = responseData.redirect;
				} else {
					setSuccess(true);
					setTimeout(() => window.location.reload(), 500);
				}
			}
		} catch {
			setError("Network error");
		}
		setLoading(false);
	};

	if (secretResponse) {
		const labels: Record<string, string> = {
			apiKey: "API Key",
			clientId: "Client ID",
			clientSecret: "Client Secret",
		};
		return (
			<div className="rounded-lg border border-(--border) p-6 space-y-4">
				<h3 className="text-sm font-semibold">Created Successfully</h3>
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
									onClick={() => {
										navigator.clipboard.writeText(value);
									}}
									className="shrink-0 rounded-md border border-(--border) px-3 py-2 text-xs hover:bg-(--accent)"
								>
									Copy
								</button>
							</div>
						</div>
					))}
				</div>
				{secretResponse.redirect && (
					<button
						type="button"
						onClick={() => {
							window.location.href = secretResponse.redirect ?? "/";
						}}
						className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
					>
						Continue
					</button>
				)}
			</div>
		);
	}

	if (!prefilled) {
		return (
			<div className="rounded-lg border border-(--border) p-6">
				{config.title && (
					<h3 className="text-sm font-semibold mb-4">{config.title}</h3>
				)}
				<p className="text-sm text-(--muted-foreground)">Loading...</p>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-(--border) p-6">
			{config.title && (
				<h3 className="text-sm font-semibold mb-4">{config.title}</h3>
			)}
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && (
					<div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
						{error}
					</div>
				)}
				{success && (
					<div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
						Submitted successfully
					</div>
				)}
				{config.fields.map((field) => (
					<div key={field.key}>
						<label htmlFor={field.key} className="block text-sm font-medium">
							{field.label}
						</label>
						{field.type === "textarea" ? (
							<textarea
								id={field.key}
								name={field.key}
								required={field.required}
								placeholder={field.placeholder}
								value={values[field.key] ?? ""}
								onChange={(e) => handleChange(field.key, e.target.value)}
								rows={3}
								className="mt-1 block w-full rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
							/>
						) : field.type === "select" ? (
							<select
								id={field.key}
								name={field.key}
								required={field.required}
								value={values[field.key] ?? ""}
								onChange={(e) => handleChange(field.key, e.target.value)}
								className="mt-1 block w-full rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
							>
								{field.options?.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						) : field.type === "search" ? (
							<SearchField
								id={field.key}
								serviceSlug={serviceSlug}
								searchEndpoint={field.searchEndpoint || ""}
								resultLabel={field.searchResultLabel}
								resultValue={field.searchResultValue}
								placeholder={field.placeholder}
								value={values[field.key] ?? ""}
								onChange={(v) => handleChange(field.key, v)}
							/>
						) : field.type === "file" ? (
							<div className="mt-1">
								{values[field.key] && values[field.key].startsWith("http") && (
									<img
										src={values[field.key]}
										alt="Preview"
										className="mb-2 h-16 w-16 rounded-full object-cover"
									/>
								)}
								<input
									id={field.key}
									type="file"
									accept={field.accept || "image/*"}
									onChange={async (e) => {
										const selectedFile = e.target.files?.[0];
										if (!selectedFile) return;
										if (!field.uploadEndpoint) {
											setError("No upload endpoint configured");
											return;
										}
										setLoading(true);
										setError("");
										const form = new FormData();
										form.append("file", selectedFile);
										try {
											const res = await fetch(
												`/api/proxy/${serviceSlug}${field.uploadEndpoint}`,
												{ method: "POST", body: form },
											);
											const data = await res.json();
											if (data.url) {
												handleChange(field.key, data.url);
											} else {
												setError(data.error || "Upload failed");
											}
										} catch {
											setError("Upload failed");
										}
										setLoading(false);
									}}
									className="block w-full text-sm text-(--muted-foreground) file:mr-4 file:rounded-md file:border-0 file:bg-(--primary) file:px-4 file:py-2 file:text-sm file:font-medium file:text-(--primary-foreground) hover:file:opacity-90"
								/>
							</div>
						) : (
							<input
								id={field.key}
								name={field.key}
								type={field.type}
								required={field.required}
								placeholder={field.placeholder}
								value={values[field.key] ?? ""}
								onChange={(e) => handleChange(field.key, e.target.value)}
								className="mt-1 block w-full rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
							/>
						)}
					</div>
				))}
				<button
					type="submit"
					disabled={loading}
					className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90 disabled:opacity-50"
				>
					{loading ? "Submitting..." : config.submitLabel || "Submit"}
				</button>
			</form>
		</div>
	);
}
