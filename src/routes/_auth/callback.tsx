import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	createSessionCookie,
	encryptSession,
	exchangeCodeForTokens,
	fetchUserInfo,
} from "~/lib/auth";

const exchangeCodeFn = createServerFn({ method: "POST" })
	.inputValidator((input: { code: string; codeVerifier: string }) => input)
	.handler(async ({ data }) => {
		const tokens = await exchangeCodeForTokens(data.code, data.codeVerifier);
		if (!tokens) {
			return { error: "Failed to exchange authorization code" };
		}

		const user = await fetchUserInfo(tokens.access_token);
		if (!user) {
			return { error: "Failed to fetch user information" };
		}

		const session = {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
			user,
		};

		const encrypted = await encryptSession(session);
		const cookie = createSessionCookie(encrypted);

		return { cookie, user };
	});

export const Route = createFileRoute("/_auth/callback")({
	component: CallbackPage,
});

function setStatus(text: string) {
	const el = document.getElementById("status");
	if (el) el.textContent = text;
}

function CallbackPage() {
	const handleCallback = async () => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get("code");
		const state = params.get("state");
		const error = params.get("error");

		if (error) {
			setStatus(`Authentication error: ${error}`);
			return;
		}

		if (!code || !state) {
			setStatus("Missing authorization code or state");
			return;
		}

		// Verify state
		const savedState = sessionStorage.getItem("oauth_state");
		const codeVerifier = sessionStorage.getItem("oauth_code_verifier");

		if (state !== savedState || !codeVerifier) {
			setStatus("Invalid state parameter. Please try again.");
			return;
		}

		// Clean up
		sessionStorage.removeItem("oauth_state");
		sessionStorage.removeItem("oauth_code_verifier");

		try {
			const result = await exchangeCodeFn({
				data: { code, codeVerifier },
			});

			if ("error" in result && result.error) {
				setStatus(result.error);
				return;
			}

			// Set the session cookie
			if (result.cookie) {
				// biome-ignore lint/suspicious/noDocumentCookie: setting session cookie requires direct assignment
				document.cookie = result.cookie;
			}

			window.location.href = "/home";
		} catch {
			setStatus("Failed to complete authentication");
		}
	};

	// Run callback on mount
	if (typeof window !== "undefined") {
		setTimeout(handleCallback, 0);
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center space-y-4">
				<div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-(--primary) border-t-transparent" />
				<p id="status" className="text-sm text-(--muted-foreground)">
					Completing sign in...
				</p>
			</div>
		</div>
	);
}
