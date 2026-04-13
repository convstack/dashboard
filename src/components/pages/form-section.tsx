import type { FormConfig, PageSection } from "@convstack/service-sdk/types";
import { useCallback, useEffect, useState } from "react";
import { SearchField } from "~/components/ui/search-field";
import { interpolateEndpoint } from "~/lib/manifest-routing";

// ──────────────────────────────────────────────────────────────────────────────
// ControlledFormSection — renders field grid + submit button with no fetch.
// The caller owns the submit lifecycle and passes it via onSubmit.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert an ISO 8601 timestamp into the `YYYY-MM-DDTHH:mm` format that
 * `<input type="datetime-local">` expects. Interpreted in the browser's
 * local timezone. Returns an empty string for unparseable input.
 */
function isoToDatetimeLocal(iso: string | undefined | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert a `YYYY-MM-DDTHH:mm` datetime-local value back to an ISO 8601
 * UTC string. Interpreted in the browser's local timezone.
 */
function datetimeLocalToIso(local: string): string {
	if (!local) return "";
	const d = new Date(local);
	if (Number.isNaN(d.getTime())) return "";
	return d.toISOString();
}

/** Extract the YYYY-MM-DD portion of any ISO timestamp. */
function isoToDate(iso: string | undefined | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Build the string-keyed seed for the form state from the initialData dict,
 * honoring field types so datetime values get converted to the display
 * format the native inputs expect.
 */
function seedFromInitial(
	fields: FormConfig["fields"],
	initialData: Record<string, unknown> | undefined,
): Record<string, string> {
	const seed: Record<string, string> = {};
	if (!initialData) return seed;
	const fieldByKey = new Map(fields.map((f) => [f.key, f]));
	for (const [k, v] of Object.entries(initialData)) {
		if (v == null) continue;
		const field = fieldByKey.get(k);
		if (field?.type === "datetime") {
			seed[k] = isoToDatetimeLocal(String(v));
		} else if (field?.type === "date") {
			seed[k] = isoToDate(String(v));
		} else if (Array.isArray(v)) {
			seed[k] = JSON.stringify(v);
		} else {
			seed[k] = String(v);
		}
	}
	return seed;
}

export interface ControlledFormSectionProps {
	config: FormConfig;
	initialData?: Record<string, unknown>;
	onSubmit: (values: Record<string, unknown>) => Promise<void>;
	submitting?: boolean;
	submitLabel?: string;
	/** Required for `search` and `file` field types that proxy through a service */
	serviceSlug?: string;
}

export function ControlledFormSection({
	config,
	initialData,
	onSubmit,
	submitting = false,
	submitLabel,
	serviceSlug,
}: ControlledFormSectionProps) {
	const [values, setValues] = useState<Record<string, string>>(() =>
		seedFromInitial(config?.fields ?? [], initialData),
	);
	const [localError, setLocalError] = useState("");
	const [localLoading, setLocalLoading] = useState(false);

	// Re-seed when initialData reference changes (e.g. modal opened with new event)
	useEffect(() => {
		setValues(seedFromInitial(config?.fields ?? [], initialData));
	}, [initialData, config?.fields]);

	const activeFields = config?.fields;

	if (!activeFields) {
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

	const handleCheckboxToggle = (key: string, optionValue: string) => {
		setValues((prev) => {
			let current: string[] = [];
			try {
				current = JSON.parse(prev[key] || "[]");
			} catch {
				current = [];
			}
			const next = current.includes(optionValue)
				? current.filter((v) => v !== optionValue)
				: [...current, optionValue];
			return { ...prev, [key]: JSON.stringify(next) };
		});
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLocalError("");

		// Build body from current values
		const body: Record<string, unknown> = {};
		for (const field of activeFields) {
			let val = values[field.key];
			// Select fields: use first option if value is empty/unset
			if (
				(!val || val === "") &&
				field.type === "select" &&
				field.options?.length
			) {
				val = field.options[0].value;
			}
			// Checkboxes: send as array
			if (field.type === "checkboxes") {
				try {
					const arr = JSON.parse(val || "[]");
					if (arr.length > 0) body[field.key] = arr;
				} catch {
					// skip
				}
				continue;
			}
			// Datetime: convert the browser's YYYY-MM-DDTHH:mm value back to
			// an ISO 8601 UTC string for the wire.
			if (field.type === "datetime") {
				if (val) {
					const iso = datetimeLocalToIso(val);
					if (iso) body[field.key] = iso;
				}
				continue;
			}
			// Date: append midnight UTC to get a valid ISO datetime (the
			// server validators accept datetime strings).
			if (field.type === "date") {
				if (val) body[field.key] = `${val}T00:00:00.000Z`;
				continue;
			}
			if (val !== undefined && val !== "") {
				body[field.key] = val;
			}
		}

		await onSubmit(body);
	};

	const isLoading = submitting || localLoading;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{localError && (
				<div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
					{localError}
				</div>
			)}
			{activeFields.map((field) => (
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
							serviceSlug={serviceSlug ?? ""}
							searchEndpoint={field.searchEndpoint || ""}
							resultLabel={field.searchResultLabel}
							resultValue={field.searchResultValue}
							placeholder={field.placeholder}
							value={values[field.key] ?? ""}
							onChange={(v) => handleChange(field.key, v)}
						/>
					) : field.type === "checkboxes" ? (
						<div className="mt-1 space-y-2">
							{field.options?.map((opt) => {
								let checked: string[] = [];
								try {
									checked = JSON.parse(values[field.key] || "[]");
								} catch {
									checked = [];
								}
								return (
									<label
										key={opt.value}
										className="flex items-center gap-2 text-sm"
									>
										<input
											type="checkbox"
											checked={checked.includes(opt.value)}
											onChange={() =>
												handleCheckboxToggle(field.key, opt.value)
											}
											className="rounded border border-(--input)"
										/>
										{opt.label}
									</label>
								);
							})}
						</div>
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
										setLocalError("No upload endpoint configured");
										return;
									}
									setLocalLoading(true);
									setLocalError("");
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
											setLocalError(data.error || "Upload failed");
										}
									} catch {
										setLocalError("Upload failed");
									}
									setLocalLoading(false);
								}}
								className="block w-full text-sm text-(--muted-foreground) file:mr-4 file:rounded-md file:border-0 file:bg-(--primary) file:px-4 file:py-2 file:text-sm file:font-medium file:text-(--primary-foreground) hover:file:opacity-90"
							/>
						</div>
					) : (
						<input
							id={field.key}
							name={field.key}
							// HTML has no `datetime` input type — map to the native
							// `datetime-local` picker.
							type={field.type === "datetime" ? "datetime-local" : field.type}
							required={field.required}
							placeholder={field.placeholder}
							value={values[field.key] ?? ""}
							onChange={(e) => handleChange(field.key, e.target.value)}
							className="mt-1 block w-full min-w-0 rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
						/>
					)}
				</div>
			))}
			<button
				type="submit"
				disabled={isLoading}
				className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90 disabled:opacity-50"
			>
				{isLoading
					? "Submitting..."
					: (submitLabel ?? config.submitLabel ?? "Submit")}
			</button>
		</form>
	);
}

// ──────────────────────────────────────────────────────────────────────────────
// FormSection — original public API wrapper; owns fetch + state management.
// Uses ControlledFormSection internally.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
	section: PageSection;
	serviceSlug: string;
	pathParams: Record<string, string>;
}

export function FormSection({ section, serviceSlug, pathParams }: Props) {
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");
	const [prefillData, setPrefillData] = useState<
		Record<string, unknown> | undefined
	>(undefined);
	const [prefilled, setPrefilled] = useState(false);
	const [dynamicFields, setDynamicFields] = useState<
		FormConfig["fields"] | null
	>(null);
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

	// Pre-fill form values from a GET request to the same endpoint.
	// The detail format { fields: [{ key, value }] } is parsed into key-value pairs.
	// If the response fields include type/label, use them as dynamic field definitions.
	const prefillEndpoint = interpolateEndpoint(section.endpoint, pathParams);

	const prefill = useCallback(async () => {
		if (!prefillEndpoint) return;
		try {
			const response = await fetch(
				`/api/proxy/${serviceSlug}${prefillEndpoint}`,
			);
			if (!response.ok) return;
			const data = await response.json();
			if (data?.fields && Array.isArray(data.fields)) {
				const initial: Record<string, unknown> = {};
				const dynFields: FormConfig["fields"] = [];
				let hasDynamicDefs = false;

				for (const field of data.fields) {
					if (field.key && field.value != null) {
						// Store array values as-is; ControlledFormSection serialises them
						initial[field.key] = field.value;
					}
					// If the endpoint returns field definitions (type, label),
					// use those instead of the static manifest config
					if (field.key && field.label && field.type) {
						hasDynamicDefs = true;
						dynFields.push({
							key: field.key,
							label: field.label,
							type: field.type,
							required: field.required,
							placeholder: field.placeholder,
							options: field.options,
						});
					}
				}

				setPrefillData(initial);
				if (hasDynamicDefs) {
					setDynamicFields(dynFields);
				}
			}
		} catch {
			// Pre-fill is best-effort
		}
		setPrefilled(true);
	}, [serviceSlug, prefillEndpoint]);

	useEffect(() => {
		prefill();
	}, [prefill]);

	// Merge dynamic fields from prefill into the config for ControlledFormSection
	const activeConfig: FormConfig = dynamicFields
		? { ...config, fields: dynamicFields }
		: config;

	const handleSubmit = async (body: Record<string, unknown>) => {
		setLoading(true);
		setError("");
		setSuccess(false);

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
				if (responseData?.secret) secrets.secret = responseData.secret;

				if (Object.keys(secrets).length > 0) {
					setSecretResponse({
						secrets,
						redirect: responseData?.redirect,
						message: responseData?.message,
					});
				} else if (responseData?.redirect) {
					// Prefix with service slug if the redirect is service-relative
					const redir = responseData.redirect as string;
					window.location.href = redir.startsWith(`/${serviceSlug}`)
						? redir
						: `/${serviceSlug}${redir.startsWith("/") ? "" : "/"}${redir}`;
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
			secret: "Webhook Secret",
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
									className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--surface-2)]"
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
		<div className="rounded-lg border border-(--border) p-6 min-w-0 overflow-hidden">
			{config.title && (
				<h3 className="text-sm font-semibold mb-4">{config.title}</h3>
			)}
			{error && (
				<div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			)}
			{success && (
				<div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
					Submitted successfully
				</div>
			)}
			<ControlledFormSection
				config={activeConfig}
				initialData={prefillData}
				onSubmit={handleSubmit}
				submitting={loading}
				serviceSlug={serviceSlug}
			/>
		</div>
	);
}
