import { useRouter } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { marked } from "marked";

interface MarkdownData {
	title?: string;
	content: string;
	metadata?: {
		lastEditedBy?: string;
		lastEditedAt?: string;
		category?: string;
	};
	actions?: {
		editLink?: string;
		historyLink?: string;
	};
}

interface Props {
	data: MarkdownData | null;
	serviceSlug: string;
}

export function MarkdownSection({ data, serviceSlug }: Props) {
	const router = useRouter();

	if (!data) {
		return (
			<div className="rounded-lg border border-(--border) p-6 animate-pulse">
				<div className="space-y-4">
					<div className="h-8 w-1/3 rounded bg-(--muted)" />
					<div className="h-4 w-full rounded bg-(--muted)" />
					<div className="h-4 w-2/3 rounded bg-(--muted)" />
					<div className="h-4 w-5/6 rounded bg-(--muted)" />
				</div>
			</div>
		);
	}

	const rawHtml = marked.parse(data.content, { async: false }) as string;
	const cleanHtml = DOMPurify.sanitize(rawHtml);

	return (
		<div>
			{data.actions && (
				<div className="mb-4 flex items-center gap-2">
					{data.actions.editLink && (
						<button
							type="button"
							onClick={() =>
								router.navigate({
									to: "/$service/$",
									params: {
										service: serviceSlug,
										_splat: data.actions?.editLink?.replace(/^\//, ""),
									},
								})
							}
							className="rounded-md bg-(--primary) px-3 py-1.5 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
						>
							Edit
						</button>
					)}
					{data.actions.historyLink && (
						<button
							type="button"
							onClick={() =>
								router.navigate({
									to: "/$service/$",
									params: {
										service: serviceSlug,
										_splat: data.actions?.historyLink?.replace(/^\//, ""),
									},
								})
							}
							className="rounded-md border border-(--border) px-3 py-1.5 text-sm font-medium hover:bg-(--accent)"
						>
							History
						</button>
					)}
				</div>
			)}

			<article
				className="prose prose-neutral dark:prose-invert max-w-none"
				dangerouslySetInnerHTML={{ __html: cleanHtml }}
			/>

			{data.metadata && (
				<div className="mt-8 border-t border-(--border) pt-4 text-xs text-(--muted-foreground)">
					{data.metadata.lastEditedBy && (
						<span>Last edited by {data.metadata.lastEditedBy}</span>
					)}
					{data.metadata.lastEditedAt && (
						<span>
							{data.metadata.lastEditedBy ? " · " : ""}
							{new Date(data.metadata.lastEditedAt).toLocaleDateString()}
						</span>
					)}
					{data.metadata.category && (
						<span>
							{data.metadata.lastEditedBy || data.metadata.lastEditedAt
								? " · "
								: ""}
							{data.metadata.category}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
