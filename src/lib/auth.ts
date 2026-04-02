import { LANYARD_URL } from "./lanyard-client";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:4000";
const CLIENT_ID = process.env.DASHBOARD_CLIENT_ID || "dashboard";
const CLIENT_SECRET = process.env.DASHBOARD_CLIENT_SECRET || "";
const SESSION_SECRET =
	process.env.SESSION_SECRET ||
	"change-me-to-a-random-string-at-least-32-chars";

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
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(SESSION_SECRET.padEnd(32, "0").slice(0, 32)),
		"AES-GCM",
		false,
		["encrypt", "decrypt"],
	);
	return keyMaterial;
}

export async function encryptSession(data: SessionData): Promise<string> {
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

export async function decryptSession(
	token: string,
): Promise<SessionData | null> {
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
	};
}

export interface OAuthState {
	state: string;
	codeVerifier: string;
}

export function buildAuthorizationUrl(
	state: string,
	codeChallenge: string,
): string {
	const params = new URLSearchParams({
		client_id: CLIENT_ID,
		redirect_uri: `${DASHBOARD_URL}/callback`,
		response_type: "code",
		scope: "openid profile email offline_access",
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
	});
	return `${LANYARD_URL}/api/auth/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
	code: string,
	codeVerifier: string,
): Promise<{
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
} | null> {
	const response = await fetch(`${LANYARD_URL}/api/auth/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: `${DASHBOARD_URL}/callback`,
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
			code_verifier: codeVerifier,
		}).toString(),
	});

	if (!response.ok) return null;
	return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
	access_token: string;
	refresh_token: string;
	expires_in: number;
} | null> {
	const response = await fetch(`${LANYARD_URL}/api/auth/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET,
		}).toString(),
	});

	if (!response.ok) return null;
	return response.json();
}

export async function fetchUserInfo(
	accessToken: string,
): Promise<SessionData["user"] | null> {
	// Use the OIDC userinfo endpoint — the access token is an OAuth2 token,
	// not a Better Auth session token, so /api/auth/get-session won't work.
	const response = await fetch(`${LANYARD_URL}/api/auth/oauth2/userinfo`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!response.ok) return null;
	const data = await response.json();
	if (!data?.sub) return null;

	return {
		id: data.sub,
		name: data.name ?? "",
		email: data.email ?? "",
		image: data.picture && data.picture !== "—" ? data.picture : undefined,
		role: data.role ?? "user",
	};
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

export {
	CLIENT_ID,
	CLIENT_SECRET,
	DASHBOARD_URL,
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
	LANYARD_URL,
};
