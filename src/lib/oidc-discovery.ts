const IDP_URL = process.env.IDP_URL || "http://localhost:9000";
const IDP_INTERNAL_URL = process.env.IDP_INTERNAL_URL || "";
const IDP_APP_SLUG = process.env.IDP_APP_SLUG || "convstack";

export interface OidcEndpoints {
	issuer: string;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
	jwksUri: string;
	endSessionEndpoint?: string;
}

let cached: OidcEndpoints | null = null;

export function parseDiscovery(doc: Record<string, unknown>): OidcEndpoints {
	const required = [
		"issuer",
		"authorization_endpoint",
		"token_endpoint",
		"userinfo_endpoint",
		"jwks_uri",
	] as const;
	for (const key of required) {
		if (typeof doc[key] !== "string") {
			throw new Error(`OIDC discovery document is missing ${key}`);
		}
	}
	return {
		issuer: doc.issuer as string,
		authorizationEndpoint: doc.authorization_endpoint as string,
		tokenEndpoint: doc.token_endpoint as string,
		userinfoEndpoint: doc.userinfo_endpoint as string,
		jwksUri: doc.jwks_uri as string,
		endSessionEndpoint:
			typeof doc.end_session_endpoint === "string"
				? doc.end_session_endpoint
				: undefined,
	};
}

// Authentik bakes whatever Host header the discovery request used into
// every URL it returns. IDP_INTERNAL_URL is a container-only address the
// browser can't resolve, so the endpoints the browser gets sent to - and
// the issuer, which Authentik takes from the Host of the token
// request - get swapped to the public IDP_URL. token/userinfo/jwks
// stay on the fetched origin: the dashboard server calls those itself, and
// IDP_INTERNAL_URL is the only origin it can actually reach.
export function toPublicEndpoints(
	endpoints: OidcEndpoints,
	internalUrl: string,
	publicUrl: string,
): OidcEndpoints {
	const internalOrigin = new URL(internalUrl).origin;
	const rewrite = (url: string): string => {
		const parsed = new URL(url);
		if (parsed.origin !== internalOrigin) {
			throw new Error(
				`OIDC discovery endpoint ${url} is not on the expected origin ${internalOrigin}`,
			);
		}
		return publicUrl + parsed.href.slice(parsed.origin.length);
	};
	return {
		...endpoints,
		issuer: rewrite(endpoints.issuer),
		authorizationEndpoint: rewrite(endpoints.authorizationEndpoint),
		endSessionEndpoint: endpoints.endSessionEndpoint
			? rewrite(endpoints.endSessionEndpoint)
			: undefined,
	};
}

export function discoveryUrl(): string {
	const origin = IDP_INTERNAL_URL || IDP_URL;
	return `${origin}/application/o/${IDP_APP_SLUG}/.well-known/openid-configuration`;
}

// Authentik names a token's issuer after the Host of the token request, so
// requests sent to the internal address carry the public one. Bun's fetch
// sends a custom Host while Node's drops it, and the Docker image runs Bun
export function publicHostHeaders(): Record<string, string> {
	if (!IDP_INTERNAL_URL) return {};
	const publicUrl = new URL(IDP_URL);
	return {
		Host: publicUrl.host,
		"X-Forwarded-Proto": publicUrl.protocol.slice(0, -1),
	};
}

export async function discoverOidc(): Promise<OidcEndpoints> {
	if (cached) return cached;
	const res = await fetch(discoveryUrl());
	if (!res.ok) {
		throw new Error(`OIDC discovery failed: ${res.status}`);
	}
	const endpoints = parseDiscovery(await res.json());
	cached = IDP_INTERNAL_URL
		? toPublicEndpoints(endpoints, IDP_INTERNAL_URL, IDP_URL)
		: endpoints;
	return cached;
}

export function __resetDiscoveryCache(): void {
	cached = null;
}
