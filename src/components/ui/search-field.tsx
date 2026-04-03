import { useCallback, useEffect, useRef, useState } from "react";

interface SearchResult {
	label: string;
	value: string;
}

interface Props {
	id: string;
	serviceSlug: string;
	searchEndpoint: string;
	resultLabel?: string;
	resultValue?: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
}

export function SearchField({
	id,
	serviceSlug,
	searchEndpoint,
	resultLabel = "name",
	resultValue = "id",
	placeholder,
	value,
	onChange,
}: Props) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [open, setOpen] = useState(false);
	const [selectedLabel, setSelectedLabel] = useState("");
	const [searching, setSearching] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const search = useCallback(
		async (q: string) => {
			if (!q || q.length < 2) {
				setResults([]);
				return;
			}
			setSearching(true);
			try {
				const res = await fetch(
					`/api/proxy/${serviceSlug}${searchEndpoint}?q=${encodeURIComponent(q)}`,
				);
				if (res.ok) {
					const data = await res.json();
					const items: SearchResult[] = (data.results ?? data.rows ?? []).map(
						(r: Record<string, unknown>) => ({
							label: String(r[resultLabel] ?? r.name ?? r.email ?? ""),
							value: String(r[resultValue] ?? r.id ?? ""),
						}),
					);
					setResults(items);
				}
			} catch {
				setResults([]);
			}
			setSearching(false);
		},
		[serviceSlug, searchEndpoint, resultLabel, resultValue],
	);

	const handleInput = (q: string) => {
		setQuery(q);
		setOpen(true);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => search(q), 300);
	};

	const handleSelect = (result: SearchResult) => {
		onChange(result.value);
		setSelectedLabel(result.label);
		setQuery(result.label);
		setOpen(false);
		setResults([]);
	};

	// Close dropdown on outside click
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	return (
		<div ref={ref} className="relative mt-1">
			<input
				id={id}
				type="text"
				value={query}
				onChange={(e) => handleInput(e.target.value)}
				onFocus={() => results.length > 0 && setOpen(true)}
				placeholder={placeholder || "Search..."}
				autoComplete="off"
				className="block w-full rounded-md border border-(--input) bg-(--background) px-3 py-2 text-sm"
			/>
			{searching && (
				<div className="absolute right-3 top-2.5 text-xs text-(--muted-foreground)">
					...
				</div>
			)}
			{value && selectedLabel && !open && (
				<p className="mt-1 text-xs text-(--muted-foreground)">
					Selected: {selectedLabel}
				</p>
			)}
			{open && results.length > 0 && (
				<ul className="absolute z-50 mt-1 w-full rounded-md border border-(--border) bg-(--background) shadow-lg max-h-48 overflow-y-auto">
					{results.map((r) => (
						<li key={r.value}>
							<button
								type="button"
								onClick={() => handleSelect(r)}
								className="w-full px-3 py-2 text-left text-sm hover:bg-(--accent) transition-colors"
							>
								{r.label}
							</button>
						</li>
					))}
				</ul>
			)}
			{open && query.length >= 2 && results.length === 0 && !searching && (
				<div className="absolute z-50 mt-1 w-full rounded-md border border-(--border) bg-(--background) p-3 text-sm text-(--muted-foreground) shadow-lg">
					No results found
				</div>
			)}
		</div>
	);
}
