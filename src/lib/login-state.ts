import { decryptJson, encryptJson } from "./auth";

const MAX_AGE_SECONDS = 600;

export interface LoginState {
	state: string;
	codeVerifier: string;
}

interface StoredLogin extends LoginState {
	createdAt: number;
}

export async function createLoginCookie(login: LoginState): Promise<string> {
	const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
	const value = await encryptJson<StoredLogin>({
		...login,
		createdAt: Date.now(),
	});
	return `dashboard_login=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function clearLoginCookie(): string {
	return "dashboard_login=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export async function readLoginState(
	request: Request,
	maxAgeMs = MAX_AGE_SECONDS * 1000,
): Promise<LoginState | null> {
	const match = (request.headers.get("cookie") || "").match(
		/(?:^|;\s*)dashboard_login=([^;]+)/,
	);
	if (!match) return null;
	const stored = await decryptJson<StoredLogin>(match[1]);
	if (
		!stored ||
		typeof stored.state !== "string" ||
		typeof stored.codeVerifier !== "string" ||
		typeof stored.createdAt !== "number" ||
		Date.now() - stored.createdAt > maxAgeMs
	) {
		return null;
	}
	return { state: stored.state, codeVerifier: stored.codeVerifier };
}
