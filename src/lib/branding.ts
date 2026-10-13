import { lanyardFetch } from "./lanyard-client";
import { isSafeImageSrc } from "./safe-url";

export type Tokens = Record<string, string>;

export interface BrandingView {
	name: string;
	logoUrl: string | null;
	lightLogoUrl: string | null;
	faviconUrl: string | null;
	dark: Tokens | null;
	light: Tokens | null;
}

export const DEFAULT_VIEW: BrandingView = {
	name: "ConvStack",
	logoUrl: null,
	lightLogoUrl: null,
	faviconUrl: null,
	dark: null,
	light: null,
};

const TOKEN_NAMES = new Set([
	"--bg",
	"--surface-1",
	"--surface-2",
	"--surface-3",
	"--border",
	"--border-strong",
	"--fg",
	"--fg-muted",
	"--fg-subtle",
	"--accent",
	"--accent-hover",
	"--accent-muted",
	"--accent-fg",
	"--accent-glow",
]);
const VALUE = /^(#[0-9a-f]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0?\.\d+\))$/i;

function block(selector: string, tokens: Tokens | null): string {
	if (!tokens) return "";
	const body = Object.entries(tokens)
		.filter(([name, value]) => TOKEN_NAMES.has(name) && VALUE.test(value))
		.map(([name, value]) => `${name}:${value};`)
		.join("");
	return body ? `${selector}{${body}}` : "";
}

export function brandingCss(view: BrandingView): string {
	return block(":root", view.dark) + block(":root:not(.dark)", view.light);
}

export function safeBrandImage(url: string | null): string | null {
	return url && isSafeImageSrc(url, "") ? url : null;
}

export function brandLogos(view: BrandingView): {
	main: string | null;
	light: string | null;
} {
	return {
		main: safeBrandImage(view.logoUrl),
		light: safeBrandImage(view.lightLogoUrl),
	};
}

function valid(data: unknown): data is BrandingView {
	if (!data || typeof data !== "object") return false;
	const v = data as Record<string, unknown>;
	const tokens = (t: unknown) =>
		t === null || (typeof t === "object" && t !== null);
	return (
		typeof v.name === "string" &&
		(v.logoUrl === null || typeof v.logoUrl === "string") &&
		(v.lightLogoUrl == null || typeof v.lightLogoUrl === "string") &&
		(v.faviconUrl === null || typeof v.faviconUrl === "string") &&
		tokens(v.dark) &&
		tokens(v.light)
	);
}

const MAX_AGE_MS = 60_000;
const FAILURE_MAX_AGE_MS = 5_000;
let answer: {
	askedAt: number;
	failed: boolean;
	view: Promise<BrandingView>;
} | null = null;

export function forgetBranding(): void {
	answer = null;
}

export function __resetBranding(): void {
	answer = null;
}

async function ask(): Promise<BrandingView> {
	const response = await lanyardFetch("/api/branding");
	if (!response.ok)
		throw new Error(`lanyard /api/branding answered ${response.status}`);
	const data: unknown = await response.json();
	if (!valid(data))
		throw new Error("lanyard /api/branding answered something unexpected");
	return { ...data, lightLogoUrl: data.lightLogoUrl ?? null };
}

export function getBranding(): Promise<BrandingView> {
	const now = Date.now();
	if (
		answer &&
		now - answer.askedAt >= (answer.failed ? FAILURE_MAX_AGE_MS : MAX_AGE_MS)
	) {
		answer = null;
	}
	if (!answer) {
		const entry = {
			askedAt: now,
			failed: false,
			view: ask().catch((err) => {
				console.warn(err instanceof Error ? err.message : err);
				entry.failed = true;
				return DEFAULT_VIEW;
			}),
		};
		answer = entry;
	}
	return answer.view;
}
