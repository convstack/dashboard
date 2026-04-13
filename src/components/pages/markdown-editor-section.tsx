import type { PageSection } from "@convstack/service-sdk/types";
import DOMPurify from "isomorphic-dompurify";
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListChecks,
	ListOrdered,
	Quote,
	Strikethrough,
	Table,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { interpolateEndpoint } from "~/lib/manifest-routing";
import { marked, preprocessMarkdown } from "~/lib/markdown";

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

type FormatAction = {
	icon: React.ReactNode;
	label: string;
	action: (
		textarea: HTMLTextAreaElement,
		setContent: (v: string) => void,
	) => void;
};

function wrapSelection(
	textarea: HTMLTextAreaElement,
	setContent: (v: string) => void,
	before: string,
	after: string,
) {
	const { selectionStart, selectionEnd, value } = textarea;
	const selected = value.slice(selectionStart, selectionEnd);
	const replacement = `${before}${selected || "text"}${after}`;
	const newValue =
		value.slice(0, selectionStart) + replacement + value.slice(selectionEnd);
	setContent(newValue);
	requestAnimationFrame(() => {
		textarea.focus();
		const cursorPos = selectionStart + before.length;
		const cursorEnd = cursorPos + (selected.length || 4);
		textarea.setSelectionRange(cursorPos, cursorEnd);
	});
}

function insertAtCursor(
	textarea: HTMLTextAreaElement,
	setContent: (v: string) => void,
	text: string,
) {
	const { selectionStart, value } = textarea;
	const newValue =
		value.slice(0, selectionStart) + text + value.slice(selectionStart);
	setContent(newValue);
	requestAnimationFrame(() => {
		textarea.focus();
		const pos = selectionStart + text.length;
		textarea.setSelectionRange(pos, pos);
	});
}

function prependLine(
	textarea: HTMLTextAreaElement,
	setContent: (v: string) => void,
	prefix: string,
) {
	const { selectionStart, selectionEnd, value } = textarea;
	const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
	const lineEnd = value.indexOf("\n", selectionEnd);
	const end = lineEnd === -1 ? value.length : lineEnd;
	const lines = value.slice(lineStart, end).split("\n");
	const prefixed = lines.map((l) => `${prefix}${l}`).join("\n");
	const newValue = value.slice(0, lineStart) + prefixed + value.slice(end);
	setContent(newValue);
	requestAnimationFrame(() => {
		textarea.focus();
	});
}

const TABLE_TEMPLATE = `| Header | Header | Header |
|--------|--------|--------|
| Cell   | Cell   | Cell   |
| Cell   | Cell   | Cell   |`;

function buildActions(
	serviceSlug: string,
	pageSlug: string | undefined,
): FormatAction[] {
	return [
		{
			icon: <Bold className="h-4 w-4" />,
			label: "Bold",
			action: (ta, set) => wrapSelection(ta, set, "**", "**"),
		},
		{
			icon: <Italic className="h-4 w-4" />,
			label: "Italic",
			action: (ta, set) => wrapSelection(ta, set, "*", "*"),
		},
		{
			icon: <Strikethrough className="h-4 w-4" />,
			label: "Strikethrough",
			action: (ta, set) => wrapSelection(ta, set, "~~", "~~"),
		},
		{
			icon: <Code className="h-4 w-4" />,
			label: "Code",
			action: (ta, set) => wrapSelection(ta, set, "`", "`"),
		},
		{
			icon: <Heading1 className="h-4 w-4" />,
			label: "Heading 1",
			action: (ta, set) => prependLine(ta, set, "# "),
		},
		{
			icon: <Heading2 className="h-4 w-4" />,
			label: "Heading 2",
			action: (ta, set) => prependLine(ta, set, "## "),
		},
		{
			icon: <Heading3 className="h-4 w-4" />,
			label: "Heading 3",
			action: (ta, set) => prependLine(ta, set, "### "),
		},
		{
			icon: <List className="h-4 w-4" />,
			label: "Bullet list",
			action: (ta, set) => prependLine(ta, set, "- "),
		},
		{
			icon: <ListOrdered className="h-4 w-4" />,
			label: "Numbered list",
			action: (ta, set) => prependLine(ta, set, "1. "),
		},
		{
			icon: <ListChecks className="h-4 w-4" />,
			label: "Task list",
			action: (ta, set) => prependLine(ta, set, "- [ ] "),
		},
		{
			icon: <Quote className="h-4 w-4" />,
			label: "Blockquote",
			action: (ta, set) => prependLine(ta, set, "> "),
		},
		{
			icon: <Link2 className="h-4 w-4" />,
			label: "Link",
			action: (ta, set) => wrapSelection(ta, set, "[", "](url)"),
		},
		{
			icon: <ImageIcon className="h-4 w-4" />,
			label: "Upload image",
			action: (ta, set) => {
				const input = document.createElement("input");
				input.type = "file";
				input.accept = "image/*";
				input.onchange = async () => {
					const file = input.files?.[0];
					if (file) {
						const url = await uploadImage(file, serviceSlug, pageSlug);
						if (url) {
							insertAtCursor(ta, set, `![${file.name}](${url})`);
						}
					}
				};
				input.click();
			},
		},
		{
			icon: <Table className="h-4 w-4" />,
			label: "Table",
			action: (ta, set) => insertAtCursor(ta, set, `\n${TABLE_TEMPLATE}\n`),
		},
	];
}

async function uploadImage(
	file: File,
	serviceSlug: string,
	pageSlug?: string,
): Promise<string | null> {
	const form = new FormData();
	form.append("file", file);
	const qs = pageSlug ? `?pageSlug=${encodeURIComponent(pageSlug)}` : "";
	try {
		const res = await fetch(`/api/proxy/${serviceSlug}/api/upload/image${qs}`, {
			method: "POST",
			body: form,
		});
		const data = await res.json();
		return data.url || null;
	} catch {
		return null;
	}
}

export function MarkdownEditorSection({
	section,
	serviceSlug,
	pathParams,
}: Props) {
	const config = section.config as unknown as MarkdownEditorConfig;
	const contentField = config.contentField || "content";
	const titleField = config.titleField || "title";

	const isEdit = config.method === "PUT";
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [editSummary, setEditSummary] = useState("");
	const [loading, setLoading] = useState(false);
	const [prefilled, setPrefilled] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [uploading, setUploading] = useState(false);

	const endpoint = interpolateEndpoint(section.endpoint, pathParams);
	const pageSlug = pathParams.slug;
	const actions = buildActions(serviceSlug, pageSlug);

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

	// Handle paste and drop image uploads
	const handleImageFile = useCallback(
		async (file: File) => {
			if (!file.type.startsWith("image/")) return;
			const ta = textareaRef.current;
			if (!ta) return;

			setUploading(true);
			const placeholder = `![Uploading ${file.name}...]()`;
			insertAtCursor(ta, setContent, placeholder);

			const url = await uploadImage(file, serviceSlug, pageSlug);
			setUploading(false);

			if (url) {
				setContent((prev) =>
					prev.replace(placeholder, `![${file.name}](${url})`),
				);
			} else {
				setContent((prev) =>
					prev.replace(placeholder, `<!-- Upload failed: ${file.name} -->`),
				);
			}
		},
		[serviceSlug, pageSlug],
	);

	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;
			for (const item of items) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (file) handleImageFile(file);
					return;
				}
			}
		},
		[handleImageFile],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			const files = e.dataTransfer?.files;
			if (!files) return;
			for (const file of files) {
				if (file.type.startsWith("image/")) {
					e.preventDefault();
					handleImageFile(file);
					return;
				}
			}
		},
		[handleImageFile],
	);

	const handleSubmit = async () => {
		setLoading(true);
		setError("");
		setSuccess(false);

		const body: Record<string, string> = {};
		body[titleField] = title;
		body[contentField] = content;
		if (isEdit && editSummary.trim()) {
			body.editSummary = editSummary.trim();
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
		marked.parse(preprocessMarkdown(content || "*Nothing to preview*"), {
			async: false,
		}) as string,
		{
			ADD_TAGS: ["input"],
			ADD_ATTR: ["checked", "disabled", "type"],
		},
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
					className="prose prose-neutral dark:prose-invert max-w-none min-h-75 rounded-lg border border-(--border) p-6"
					dangerouslySetInnerHTML={{ __html: previewHtml }}
				/>
			) : (
				<div>
					{/* Floating toolbar */}
					<div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-(--border) bg-(--muted)/50 px-2 py-1.5">
						{actions.map((action) => (
							<button
								key={action.label}
								type="button"
								title={action.label}
								onClick={() => {
									const ta = textareaRef.current;
									if (ta) action.action(ta, setContent);
								}}
								className="rounded p-1.5 text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors"
							>
								{action.icon}
							</button>
						))}
						{uploading && (
							<span className="ml-2 text-xs text-(--muted-foreground)">
								Uploading...
							</span>
						)}
					</div>
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						onPaste={handlePaste}
						onDrop={handleDrop}
						onDragOver={(e) => e.preventDefault()}
						placeholder="Write your content in Markdown..."
						rows={16}
						className="block w-full rounded-b-lg border border-(--input) bg-(--background) px-4 py-3 text-sm font-mono resize-y min-h-75"
					/>
				</div>
			)}

			<div className="flex items-center gap-3">
				{isEdit && (
					<input
						type="text"
						value={editSummary}
						onChange={(e) => setEditSummary(e.target.value)}
						placeholder="Edit summary (optional)"
						className="flex-1 rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
					/>
				)}
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
