import { decodeJwt, type JWTPayload } from "jose";
import { LANYARD_URL } from "./lanyard-client";
import { discoverOidc, publicHostHeaders } from "./oidc-discovery";
import { isSafeImageSrc } from "./safe-url";
import { isRevoked } from "./session-revocation";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:4000";
const CLIENT_ID = process.env.DASHBOARD_CLIENT_ID || "dashboard";
const CLIENT_SECRET = process.env.DASHBOARD_CLIENT_SECRET || "";
const EXAMPLE_SESSION_SECRETS = new Set([
	"change-me-to-a-random-string-at-least-32-chars",
	"CHANGEMEPLEASE_dashboard_session_secret_at_least_32_chars",
]);
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";

// PKCE helpers
function generateCodeVerifier(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
	let str = "";
	for (const byte of buffer) {
		str += String.fromCharCode(byte);
	}
	return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateState(): string {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return base64UrlEncode(array);
}

// Session encryption using Web Crypto
async function getEncryptionKey(): Promise<CryptoKey> {
	// checked here, not at import: the login route pulls this module into the browser bundle
	if (
		SESSION_SECRET.length < 32 ||
		EXAMPLE_SESSION_SECRETS.has(SESSION_SECRET)
	) {
		throw new Error(
			"SESSION_SECRET must be at least 32 random characters and not an example value, for example from `openssl rand -base64 48`",
		);
	}
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(SESSION_SECRET),
		"HKDF",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: new Uint8Array(),
			info: encoder.encode("convstack dashboard session"),
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

export async function encryptJson<T>(data: T): Promise<string> {
	const key = await getEncryptionKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoder = new TextEncoder();
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoder.encode(JSON.stringify(data)),
	);
	const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
	combined.set(iv);
	combined.set(new Uint8Array(encrypted), iv.length);
	return base64UrlEncode(combined);
}

export async function decryptJson<T>(token: string): Promise<T | null> {
	try {
		const key = await getEncryptionKey();
		// Decode base64url
		const raw = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) {
			bytes[i] = raw.charCodeAt(i);
		}
		const iv = bytes.slice(0, 12);
		const data = bytes.slice(12);
		const decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv },
			key,
			data,
		);
		const decoder = new TextDecoder();
		return JSON.parse(decoder.decode(decrypted));
	} catch {
		return null;
	}
}

export async function encryptSession(data: SessionData): Promise<string> {
	return encryptJson(data);
}

export async function decryptSession(
	token: string,
): Promise<SessionData | null> {
	return decryptJson<SessionData>(token);
}

export function isSessionRevoked(session: SessionData): boolean {
	let claims: JWTPayload;
	try {
		claims = decodeJwt(session.accessToken);
	} catch {
		return true;
	}
	if (typeof claims.iat !== "number") return true;
	const sid = typeof claims.sid === "string" ? claims.sid : undefined;
	return isRevoked(session.user.id, claims.iat, sid);
}

export async function readSession(
	request: Request,
): Promise<SessionData | null> {
	const cookie = getSessionCookie(request);
	if (!cookie) return null;
	const session = await decryptSession(cookie);
	if (!session) return null;
	if (session.expiresAt <= Date.now() / 1000) return null;
	if (isSessionRevoked(session)) return null;
	return session;
}

export interface SessionData {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	user: {
		id: string;
		name: string;
		email: string;
		image?: string;
		role: string;
		deletionPending?: boolean;
	};
}

export interface OAuthState {
	state: string;
	codeVerifier: string;
}

export async function buildAuthorizationUrl(
	state: string,
	codeChallenge: string,
): Promise<string> {
	const { authorizationEndpoint } = await discoverOidc();
	const params = new URLSearchParams({
		client_id: CLIENT_ID,
		redirect_uri: `${DASHBOARD_URL}/callback`,
		response_type: "code",
		scope: "openid profile email offline_access",
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});
	return `${authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
	code: string,
	codeVerifier: string,
): Promise<{
	access_token: string;
	refresh_token: string;
	id_token?: string;
	expires_in: number;
	token_type: string;
} | null> {
	const { tokenEndpoint } = await discoverOidc();
	const response = await fetch(tokenEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			...publicHostHeaders(),
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: `${DASHBOARD_URL}/callback`,
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			code_verifier: codeVerifier,
		}).toString(),
	});

	if (!response.ok) {
		const err = await response.text().catch(() => "");
		console.error(
			`[auth] exchangeCodeForTokens failed: ${response.status} ${err}`,
		);
		return null;
	}
	return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
	access_token: string;
	refresh_token: string;
	id_token?: string;
	expires_in: number;
} | null> {
	const { tokenEndpoint } = await discoverOidc();
	const response = await fetch(tokenEndpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			...publicHostHeaders(),
		},
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
		}).toString(),
	});

	if (!response.ok) {
		const err = await response.text().catch(() => "");
		console.error(`[auth] Token exchange failed: ${response.status} ${err}`);
		return null;
	}
	return response.json();
}

export async function fetchUserInfo(
	accessToken: string,
): Promise<SessionData["user"] | null> {
	// Use the OIDC userinfo endpoint - the access token is an OAuth2 token,
	// not a Better Auth session token, so /api/auth/get-session won't work.
	const { userinfoEndpoint } = await discoverOidc();
	const response = await fetch(userinfoEndpoint, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!response.ok) return null;
	const data = await response.json();
	if (!data?.sub) return null;

	// lanyard-owned profile fields (role, deletionPending) aren't issued by
	// Authentik - they're ConvStack-owned, not identity attributes.
	const local = await fetchLanyardUserFields(accessToken);

	// picture can be a data: URI (e.g. a generated initials avatar) when the
	// IdP has no real image for the user - those run to hundreds of bytes and
	// don't belong in a cookie, so only keep it when it's an actual URL.
	// Also excludes Authentik's own relative-path default avatar (served from
	// its own origin, e.g. under AUTHENTIK_AVATARS=none), which 404s if used
	// as-is from the dashboard's origin.
	const image =
		data.picture &&
		data.picture !== "—" &&
		!data.picture.startsWith("data:") &&
		isSafeImageSrc(data.picture, "")
			? data.picture
			: undefined;

	return {
		id: data.sub,
		name: data.name ?? "",
		email: data.email ?? "",
		image,
		role: local.role,
		// omit rather than serialize the common default/empty case - every
		// byte here rides in the encrypted cookie alongside two Authentik JWTs
		deletionPending: local.deletionPending || undefined,
	};
}

async function fetchLanyardUserFields(
	accessToken: string,
): Promise<{ role: string; deletionPending: boolean }> {
	try {
		const res = await fetch(`${LANYARD_URL}/api/user/profile`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!res.ok) {
			console.warn(`lanyard /api/user/profile answered ${res.status}`);
			return { role: "user", deletionPending: false };
		}
		const data = (await res.json()) as {
			role?: string;
			deletionPending?: boolean;
		};
		return {
			role: data.role ?? "user",
			deletionPending: data.deletionPending ?? false,
		};
	} catch (err) {
		console.warn(
			"lanyard /api/user/profile failed:",
			err instanceof Error ? err.message : err,
		);
		return { role: "user", deletionPending: false };
	}
}

export function createSessionCookie(value: string, maxAge = 86400): string {
	const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
	return `dashboard_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
	return "dashboard_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export function getSessionCookie(request: Request): string | null {
	const cookies = request.headers.get("cookie") || "";
	const match = cookies.match(/dashboard_session=([^;]+)/);
	return match ? match[1] : null;
}

// The id token is only needed as id_token_hint at logout. It's kept out of
// dashboard_session and in its own cookie because Authentik's access and id
// tokens are JWTs carrying full profile claims - both already close to the
// 4KB cookie limit on their own, so the session cookie can't afford to also
// carry the id token.
export function createIdTokenCookie(value: string, maxAge = 86400): string {
	const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
	return `dashboard_id_token=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearIdTokenCookie(): string {
	return "dashboard_id_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export function getIdTokenCookie(request: Request): string | null {
	const cookies = request.headers.get("cookie") || "";
	const match = cookies.match(/dashboard_id_token=([^;]+)/);
	return match ? match[1] : null;
}

export {
	CLIENT_ID,
	DASHBOARD_URL,
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
	LANYARD_URL,
};
