import { useState } from "react";
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

	const config = section.config as unknown as FormConfig;
	if (!config?.fields) {
		return (
			<div className="rounded-lg border border-(--border) p-6">
				<p className="text-sm text-(--muted-foreground)">
					Invalid form configuration
				</p>
			</div>
		);
	}

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		setSuccess(false);

		const formData = new FormData(e.currentTarget);
		const body: Record<string, string> = {};
		for (const [key, value] of formData.entries()) {
			body[key] = value as string;
		}

		const rawEndpoint = config.submitEndpoint || section.endpoint;
		const endpoint = interpolateEndpoint(rawEndpoint, pathParams);

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
			}
		} catch {
			setError("Network error");
		}
		setLoading(false);
	};

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
								rows={3}
								className="mt-1 block w-full rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
							/>
						) : field.type === "select" ? (
							<select
								id={field.key}
								name={field.key}
								required={field.required}
								className="mt-1 block w-full rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
							>
								{field.options?.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						) : (
							<input
								id={field.key}
								name={field.key}
								type={field.type}
								required={field.required}
								placeholder={field.placeholder}
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
