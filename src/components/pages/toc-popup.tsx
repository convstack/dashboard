import { List, X } from "lucide-react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

interface TocEntry {
	id: string;
	text: string;
	level: number; // 2 or 3
}

interface Props {
	articleRef: RefObject<HTMLElement | null>;
	/** Markdown source. Used as a re-extraction trigger — when the parent
	 *  navigates to a new article, this string changes and we re-walk headings
	 *  and reset the popover. Without this dep, extraction would only run on
	 *  the initial mount and stale headings would persist across navigations. */
	content?: string;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-");
}

/**
 * Extract h2 and h3 headings from the article, ensuring each has an `id`.
 * Called after the markdown renders.
 */
function extractHeadings(article: HTMLElement | null): TocEntry[] {
	if (!article) return [];
	const nodes = article.querySelectorAll("h2, h3");
	const entries: TocEntry[] = [];
	for (const node of Array.from(nodes)) {
		const element = node as HTMLElement;
		const text = (element.textContent ?? "").trim();
		if (!text) continue;
		let id = element.id;
		if (!id) {
			id = slugify(text);
			element.id = id;
		}
		entries.push({
			id,
			text,
			level: element.tagName === "H2" ? 2 : 3,
		});
	}
	return entries;
}

export function TocPopup({ articleRef, content }: Props) {
	const [entries, setEntries] = useState<TocEntry[]>([]);
	const [open, setOpen] = useState(false);
	const dialogRef = useRef<HTMLDivElement | null>(null);

	// Re-extract headings whenever the article content changes. The article
	// ref itself is stable (same object across renders) so we use `content` as
	// the trigger — when the parent navigates to a new page, MarkdownSection
	// passes a new content string, this effect re-runs, and the popover lists
	// the new page's headings instead of stale ones from the previous page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: content is the trigger even though articleRef.current reads from the DOM.
	useEffect(() => {
		const extracted = extractHeadings(articleRef.current);
		setEntries(extracted);
		// Also close the popover so the user isn't left with stale state visible.
		setOpen(false);
	}, [content]);

	// Close on Escape.
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open]);

	// Close on outside click.
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		// Delay to avoid catching the toggle-button's own click.
		const timer = window.setTimeout(() => {
			window.addEventListener("mousedown", handler);
		}, 0);
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("mousedown", handler);
		};
	}, [open]);

	const jumpTo = useCallback((id: string) => {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
			setOpen(false);
		}
	}, []);

	// Hide the button entirely when there are 0 or 1 headings.
	if (entries.length < 2) return null;

	return (
		// Sticky wrapper: button sits at the top-LEFT of the article in flow,
		// scrolls naturally with the page initially, then sticks at `top-0`
		// (the very top of the scrolling <main> element, just below the global
		// TopBar which lives outside main) once scrolled past its natural
		// position. The threshold MUST be `top-0` (or smaller than main's
		// top padding ~24-40 px), otherwise sticky engages immediately at
		// scroll 0 and the button never scrolls naturally.
		// `flex justify-start` puts the button on the left.
		// On lg+ viewports the article is `max-w-[720px]` centered with gutter
		// space to its left — `lg:-ml-14` (-56 px) pushes the button into that
		// gutter so it sits OUTSIDE the article's text width. On smaller
		// viewports the article fills the screen so the button has no choice
		// but to align with the article's left edge.
		// `pointer-events-none` on the wrapper lets clicks pass through the
		// empty horizontal space when the button is stuck and overlaying
		// article text below; `pointer-events-auto` on the inner button +
		// popover re-enables interaction where it matters.
		<div className="sticky top-0 z-20 mb-3 flex justify-start pointer-events-none">
			<div className="relative pointer-events-auto lg:-ml-14">
				<button
					type="button"
					aria-label="Table of contents"
					aria-expanded={open}
					onClick={() => setOpen((p) => !p)}
					className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-1)] text-[var(--fg-muted)] shadow-[var(--shadow-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] lg:h-10 lg:w-10"
				>
					{open ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
				</button>

				{open && (
					<div
						ref={dialogRef}
						role="dialog"
						aria-label="Table of contents"
						className="absolute left-0 top-12 w-[min(320px,90vw)] max-h-[60vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-3)] p-2 shadow-[var(--shadow-3)]"
					>
						<p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
							Table of contents
						</p>
						<ul className="mt-1 space-y-0.5">
							{entries.map((entry) => (
								<li key={entry.id}>
									<button
										type="button"
										onClick={() => jumpTo(entry.id)}
										className={`block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] ${
											entry.level === 3 ? "pl-6" : ""
										}`}
									>
										{entry.text}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}
