import type { marked, Tokens } from "marked";

type CalloutVariant = "info" | "success" | "warning" | "danger" | "tip";

/**
 * Recognized GitHub-flavored callout types, mapped to our variant names.
 * "NOTE" is an alias for "INFO" per GitHub's syntax.
 */
const TYPE_MAP: Record<string, CalloutVariant> = {
	INFO: "info",
	NOTE: "info",
	TIP: "tip",
	WARNING: "warning",
	DANGER: "danger",
	SUCCESS: "success",
};

const DEFAULT_ICONS: Record<CalloutVariant, string> = {
	info: "ⓘ",
	success: "✓",
	warning: "⚠",
	danger: "✕",
	tip: "💡",
};

/**
 * Inline CSS tokens for callout rendering. Uses the same design tokens as
 * `CalloutSection` so the visual matches between section-type and markdown-
 * embedded callouts.
 */
const VARIANT_STYLES: Record<
	CalloutVariant,
	{ bg: string; border: string; fg: string }
> = {
	info: { bg: "var(--info-muted)", border: "var(--info)", fg: "var(--info)" },
	success: {
		bg: "var(--success-muted)",
		border: "var(--success)",
		fg: "var(--success)",
	},
	warning: {
		bg: "var(--warning-muted)",
		border: "var(--warning)",
		fg: "var(--warning)",
	},
	danger: {
		bg: "var(--danger-muted)",
		border: "var(--danger)",
		fg: "var(--danger)",
	},
	tip: {
		bg: "var(--accent-muted)",
		border: "var(--accent)",
		fg: "var(--accent)",
	},
};

/**
 * Detect whether a blockquote token begins with a `[!TYPE]` marker.
 * Returns the normalized variant and remaining body tokens, or null.
 */
function parseCalloutMarker(
	blockquote: Tokens.Blockquote,
): { variant: CalloutVariant; bodyTokens: Tokens.Generic[] } | null {
	const tokens = blockquote.tokens;
	if (!tokens || tokens.length === 0) return null;

	const first = tokens[0];
	if (first.type !== "paragraph") return null;

	const paragraph = first as Tokens.Paragraph;
	const paragraphText = paragraph.text ?? "";

	// Match `[!TYPE]` optionally followed by a newline and body text.
	const markerMatch = paragraphText.match(/^\[!([A-Z]+)\]\s*(\n([\s\S]*))?$/);
	if (!markerMatch) return null;

	const typeKey = markerMatch[1].toUpperCase();
	const variant = TYPE_MAP[typeKey];
	if (!variant) return null;

	const bodyText = markerMatch[3] ?? "";
	const rest = tokens.slice(1) as Tokens.Generic[];

	const bodyTokens: Tokens.Generic[] = bodyText
		? [
				{
					type: "paragraph",
					raw: bodyText,
					text: bodyText,
					tokens: [{ type: "text", raw: bodyText, text: bodyText }],
				} as Tokens.Generic,
			]
		: [];

	return { variant, bodyTokens: [...bodyTokens, ...rest] };
}

/**
 * Render a callout token to an HTML string with inline styles matching CalloutSection.
 */
function renderCallout(variant: CalloutVariant, bodyHtml: string): string {
	const style = VARIANT_STYLES[variant];
	const icon = DEFAULT_ICONS[variant];
	const label = variant.charAt(0).toUpperCase() + variant.slice(1);

	return (
		`<aside class="markdown-callout" ` +
		`style="display:flex;gap:12px;border-radius:var(--radius-lg);` +
		`border:1px solid ${style.border};background:${style.bg};` +
		`padding:12px 16px;margin:16px 0;" ` +
		`role="note" aria-label="${label}">` +
		`<div style="flex-shrink:0;color:${style.fg};font-weight:bold;">${icon}</div>` +
		`<div style="min-width:0;flex:1;color:var(--fg);">${bodyHtml}</div>` +
		`</aside>`
	);
}

/**
 * Register the callout extension with the given marked instance.
 * Call once at module load from markdown.ts.
 */
export function registerCalloutExtension(m: typeof marked): void {
	m.use({
		walkTokens(token: Tokens.Generic) {
			if (token.type !== "blockquote") return;
			const bq = token as Tokens.Blockquote;
			const parsed = parseCalloutMarker(bq);
			if (!parsed) return;

			const parser = (
				m as unknown as {
					parser: (tokens: Tokens.Generic[]) => string;
				}
			).parser;
			const bodyHtml = parser(parsed.bodyTokens);

			Object.assign(token, {
				type: "html",
				raw: bq.raw,
				text: renderCallout(parsed.variant, bodyHtml),
				pre: false,
				block: true,
			});
		},
	});
}
