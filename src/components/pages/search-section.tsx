import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateShort } from "~/lib/format";
import type { JsonValue, PageSection } from "~/lib/types/manifest";

interface SearchResult {
	title: string;
	slug: string;
	snippet: string;
	matchText: string;
	updatedBy?: string;
	updatedAt?: string;
}

interface Props {
	section: PageSection;
	serviceSlug: string;
}

/**
 * Highlight all occurrences of `query` in `text` by wrapping them in <mark>.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
	if (!query.trim()) return <>{text}</>;

	const regex = new RegExp(
		`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
		"gi",
	);
	const parts = text.split(regex);

	return (
		<>
			{parts.map((part, i) => {
				const key = `${i}-${part}`;
				return regex.test(part) ? (
					<mark
						key={key}
						className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded-sm px-0.5"
					>
						{part}
					</mark>
				) : (
					<span key={key}>{part}</span>
				);
			})}
		</>
	);
}

export function SearchSection({ section, serviceSlug }: Props) {
	const config = section.config as Record<string, JsonValue>;
	const rowLink = (config.rowLink as string) || "/pages/:slug";

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

	const search = useCallback(
		async (q: string) => {
			if (!q.trim()) {
				setResults([]);
				setSearched(false);
				return;
			}

			setLoading(true);
			try {
				const response = await fetch(
					`/api/proxy/${serviceSlug}${section.endpoint}?q=${encodeURIComponent(q.trim())}`,
				);
				if (response.ok) {
					const data = await response.json();
					setResults(data.results ?? []);
				}
			} catch {
				// Search is best-effort
			}
			setLoading(false);
			setSearched(true);
		},
		[serviceSlug, section.endpoint],
	);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => search(query), 250);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [query, search]);

	function buildHref(slug: string): string {
		const path = `/${serviceSlug}${rowLink.replace(":slug", slug)}`;
		return query ? `${path}?highlight=${encodeURIComponent(query)}` : path;
	}

	// Group consecutive results with the same slug to avoid repeating the title
	const grouped: Array<{
		title: string;
		slug: string;
		updatedBy?: string;
		updatedAt?: string;
		matches: Array<{ snippet: string; matchText: string }>;
	}> = [];

	for (const result of results) {
		const last = grouped[grouped.length - 1];
		if (last && last.slug === result.slug) {
			last.matches.push({
				snippet: result.snippet,
				matchText: result.matchText,
			});
		} else {
			grouped.push({
				title: result.title,
				slug: result.slug,
				updatedBy: result.updatedBy,
				updatedAt: result.updatedAt,
				matches: [{ snippet: result.snippet, matchText: result.matchText }],
			});
		}
	}

	return (
		<div className="space-y-4">
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted-foreground)" />
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search pages..."
					// biome-ignore lint/a11y/noAutofocus: search page should focus input on load
					autoFocus
					className="block w-full rounded-lg border border-(--input) bg-(--background) pl-10 pr-4 py-2.5 text-sm placeholder:text-(--muted-foreground) focus:outline-none focus:ring-2 focus:ring-(--ring)"
				/>
			</div>

			{loading && (
				<p className="text-sm text-(--muted-foreground)">Searching...</p>
			)}

			{!loading && searched && grouped.length === 0 && (
				<p className="text-sm text-(--muted-foreground)">
					No pages found for &ldquo;{query}&rdquo;
				</p>
			)}

			{grouped.length > 0 && (
				<div className="space-y-3">
					{grouped.map((group) => (
						<div
							key={group.slug}
							className="rounded-lg border border-(--border) overflow-hidden"
						>
							<div className="px-4 py-2.5 border-b border-(--border) bg-(--muted)/30">
								<Link
									to={`/${serviceSlug}${rowLink.replace(":slug", group.slug)}`}
									className="font-medium text-sm hover:underline"
								>
									{group.title}
								</Link>
								{group.updatedAt && (
									<span className="text-xs text-(--muted-foreground) ml-2">
										{group.updatedBy && `${group.updatedBy} · `}
										{formatDateShort(group.updatedAt)}
									</span>
								)}
							</div>
							<div className="divide-y divide-(--border)">
								{group.matches.map((match, i) => (
									<Link
										key={`${group.slug}-${match.matchText || i}`}
										to={buildHref(group.slug)}
										className="block px-4 py-2 text-sm text-(--muted-foreground) hover:bg-(--accent) transition-colors"
									>
										<HighlightedText text={match.snippet} query={query} />
									</Link>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{!searched && !loading && (
				<p className="text-sm text-(--muted-foreground)">
					Type to search across all pages.
				</p>
			)}
		</div>
	);
}
