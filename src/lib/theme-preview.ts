const COLOUR_KEY = /^(dark|light)(Background|Panel|Text|Muted|Border|Accent)$/;
const VALUE = /^(#[0-9a-f]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0?\.\d+\))$/i;

export function safeHex(value: string, fallback: string): string {
	return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function previewBody(
	values: Record<string, string>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(values).filter(([key]) => COLOUR_KEY.test(key)),
	);
}

export function mockStyle(
	tokens: Record<string, string>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(tokens).filter(
			([key, value]) => key.startsWith("--") && VALUE.test(value),
		),
	);
}

export function previewLogo(
	values: Record<string, string>,
	theme: "dark" | "light",
): string {
	if (theme === "light" && values.lightLogoUrl) return values.lightLogoUrl;
	return values.logoUrl ?? "";
}
