const SOURCE =
	/^(?:[a-z][a-z0-9+.-]*:|(?:[a-z][a-z0-9+.-]*:\/\/)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d{1,5}|\*))?(?:\/[^\s;,'"]*)?)$/i;

export function parseSources(
	name: string,
	value: string | undefined,
): string[] {
	const trimmed = value?.trim();
	if (!trimmed) return [];
	const sources = trimmed.split(/\s+/);
	for (const source of sources) {
		if (!SOURCE.test(source)) {
			throw new Error(
				`${name} has an invalid source "${source}". Use space-separated hosts, schemes or origins, for example "https://cdn.example.com".`,
			);
		}
	}
	return sources;
}

export interface CspOptions {
	nonce: string;
	imgSources?: string[];
	connectSources?: string[];
	scriptSources?: string[];
	styleSources?: string[];
	formActionSources?: string[];
}

export function buildCsp({
	nonce,
	imgSources = [],
	connectSources = [],
	scriptSources = [],
	styleSources = [],
	formActionSources = [],
}: CspOptions): string {
	return [
		"default-src 'self'",
		`script-src ${["'self'", `'nonce-${nonce}'`, ...scriptSources].join(" ")}`,
		`style-src ${["'self'", "'unsafe-inline'", ...styleSources].join(" ")}`,
		`img-src ${["'self'", "data:", "https:", ...imgSources].join(" ")}`,
		"font-src 'self' data:",
		`connect-src ${["'self'", ...connectSources].join(" ")}`,
		"object-src 'none'",
		"base-uri 'self'",
		`form-action ${["'self'", ...formActionSources].join(" ")}`,
		"frame-ancestors 'none'",
	].join("; ");
}

export const PROXIED_CSP =
	"sandbox; default-src 'none'; frame-ancestors 'none'";
