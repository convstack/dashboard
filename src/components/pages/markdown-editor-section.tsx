import DOMPurify from "dompurify";
import { marked } from "marked";
import { useCallback, useEffect, useState } from "react";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import type { PageSection } from "~/lib/types/manifest";

interface MarkdownEditorConfig {
	contentField?: string;
	titleField?: string;
	submitLabel?: string;
	method?: string;
}

interface Props {
	section: PageSection;
	serviceSlug: string;
	pathParams: Record<string, string>;
}

export function MarkdownEditorSection({
	section,
	serviceSlug,
	pathParams,
}: Props) {
	const config = section.config as unknown as MarkdownEditorConfig;
	const contentField = config.contentField || "content";
	const titleField = config.titleField || "title";

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [loading, setLoading] = useState(false);
	const [prefilled, setPrefilled] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [showPreview, setShowPreview] = useState(false);

	const endpoint = interpolateEndpoint(section.endpoint, pathParams);

	// Pre-fill from GET (for editing existing pages)
	const prefill = useCallback(async () => {
		if (!endpoint) {
			setPrefilled(true);
			return;
		}
		try {
			const response = await fetch(`/api/proxy/${serviceSlug}${endpoint}`);
			if (response.ok) {
				const data = await response.json();
				if (data?.[titleField]) setTitle(data[titleField]);
				if (data?.[contentField]) setContent(data[contentField]);
			}
		} catch {
			// Pre-fill is best-effort
		}
		setPrefilled(true);
	}, [serviceSlug, endpoint, titleField, contentField]);

	useEffect(() => {
		prefill();
	}, [prefill]);

	const handleSubmit = async () => {
		setLoading(true);
		setError("");
		setSuccess(false);

		const body: Record<string, string> = {};
		body[titleField] = title;
		body[contentField] = content;

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
				const data = await response.json().catch(() => null);
				if (data?.redirect) {
					window.location.href = data.redirect;
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

	if (!prefilled) {
		return (
			<div className="rounded-lg border border-(--border) p-6">
				<p className="text-sm text-(--muted-foreground)">Loading...</p>
			</div>
		);
	}

	const previewHtml = DOMPurify.sanitize(
		marked.parse(content || "*Nothing to preview*", {
			async: false,
		}) as string,
	);

	return (
		<div className="space-y-4">
			{error && (
				<div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			)}
			{success && (
				<div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
					Saved successfully
				</div>
			)}

			<div>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Page title"
					className="block w-full rounded-md border border-(--input) bg-(--background) px-3 py-2 text-lg font-semibold"
				/>
			</div>

			<div className="flex items-center gap-2 border-b border-(--border) pb-2">
				<button
					type="button"
					onClick={() => setShowPreview(false)}
					className={`rounded-md px-3 py-1 text-sm font-medium ${!showPreview ? "bg-(--muted) text-(--foreground)" : "text-(--muted-foreground) hover:text-(--foreground)"}`}
				>
					Write
				</button>
				<button
					type="button"
					onClick={() => setShowPreview(true)}
					className={`rounded-md px-3 py-1 text-sm font-medium ${showPreview ? "bg-(--muted) text-(--foreground)" : "text-(--muted-foreground) hover:text-(--foreground)"}`}
				>
					Preview
				</button>
			</div>

			{showPreview ? (
				<article
					className="prose prose-neutral dark:prose-invert max-w-none min-h-[300px] rounded-lg border border-(--border) p-6"
					dangerouslySetInnerHTML={{ __html: previewHtml }}
				/>
			) : (
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Write your content in Markdown..."
					rows={16}
					className="block w-full rounded-lg border border-(--input) bg-(--background) px-4 py-3 text-sm font-mono resize-y min-h-[300px]"
				/>
			)}

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={handleSubmit}
					disabled={loading || !title.trim()}
					className="rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-(--primary-foreground) hover:opacity-90 disabled:opacity-50"
				>
					{loading ? "Saving..." : config.submitLabel || "Save"}
				</button>
			</div>
		</div>
	);
}
