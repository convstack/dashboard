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
				setSuccess(true);
				// Reload to reflect changes in sidebar/header
				setTimeout(() => window.location.reload(), 500);
			}
		} catch {
			setError("Network error");
		}
		setLoading(false);
	};

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
