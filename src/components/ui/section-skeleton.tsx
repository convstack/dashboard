interface Props {
	/** Visible height in pixels. Defaults to 320 — sized to match a typical section. */
	height?: number;
	/** Optional accessible label override. */
	label?: string;
}

export function SectionSkeleton({ height = 320, label }: Props) {
	return (
		<div
			role="status"
			className="animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)]"
			style={{ height }}
			aria-busy="true"
			aria-label={label ?? "Loading section content"}
		/>
	);
}
