import { useRouter } from "@tanstack/react-router";
import DOMPurify from "isomorphic-dompurify";
import { marked, preprocessMarkdown } from "~/lib/markdown";

interface DiffLine {
	type: "added" | "removed" | "unchanged";
	text: string;
}

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
	diff?: DiffLine[];
}

interface Props {
	data: MarkdownData | null;
	serviceSlug: string;
}

function DiffView({ diff }: { diff: DiffLine[] }) {
	return (
		<div className="mt-6 rounded-lg border border-(--border) overflow-hidden">
			<div className="bg-(--muted) px-4 py-2 text-xs font-semibold text-(--muted-foreground)">
				Changes from this revision to current version
			</div>
			<pre className="overflow-x-auto text-sm font-mono leading-relaxed">
				{diff.map((line, i) => {
					const key = `${line.type}-${i}`;
					if (line.type === "added") {
						return (
							<div
								key={key}
								className="bg-green-500/15 text-green-700 dark:text-green-400 px-4 py-0.5"
							>
								<span className="select-none mr-2">+</span>
								{line.text}
							</div>
						);
					}
					if (line.type === "removed") {
						return (
							<div
								key={key}
								className="bg-red-500/15 text-red-700 dark:text-red-400 px-4 py-0.5"
							>
								<span className="select-none mr-2">-</span>
								{line.text}
							</div>
						);
					}
					return (
						<div key={key} className="px-4 py-0.5 text-(--muted-foreground)">
							<span className="select-none mr-2">&nbsp;</span>
							{line.text}
						</div>
					);
				})}
			</pre>
		</div>
	);
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

	const rawHtml = marked.parse(preprocessMarkdown(data.content), {
		async: false,
	}) as string;
	const cleanHtml = DOMPurify.sanitize(rawHtml, {
		ADD_TAGS: ["input"],
		ADD_ATTR: ["checked", "disabled", "type"],
	});

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

			{data.diff && data.diff.length > 0 && <DiffView diff={data.diff} />}

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
