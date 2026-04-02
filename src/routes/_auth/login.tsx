import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	buildAuthorizationUrl,
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
} from "~/lib/auth";
import { ensureDashboardRegistered } from "~/server/functions/auto-register";

const initiateLoginFn = createServerFn({ method: "GET" }).handler(async () => {
	// Ensure dashboard is registered with Lanyard on first use
	await ensureDashboardRegistered();

	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);
	const authUrl = buildAuthorizationUrl(state, codeChallenge);

	return { authUrl, state, codeVerifier };
});

export const Route = createFileRoute("/_auth/login")({
	loader: async () => {
		const { authUrl, state, codeVerifier } = await initiateLoginFn();
		return { authUrl, state, codeVerifier };
	},
	component: LoginPage,
});

function LoginPage() {
	const { authUrl, state, codeVerifier } = Route.useLoaderData();

	const handleLogin = () => {
		// Store PKCE state in sessionStorage for the callback
		sessionStorage.setItem("oauth_state", state);
		sessionStorage.setItem("oauth_code_verifier", codeVerifier);
		window.location.href = authUrl;
	};

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="w-full max-w-sm space-y-6 rounded-lg border border-(--border) bg-(--card) p-8 text-center">
				<div>
					<h1 className="text-2xl font-bold">Convention Dashboard</h1>
					<p className="mt-2 text-sm text-(--muted-foreground)">
						Sign in with your Lanyard account to continue.
					</p>
				</div>
				<button
					type="button"
					onClick={handleLogin}
					className="w-full rounded-md bg-(--primary) px-4 py-2.5 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
				>
					Sign in with Lanyard
				</button>
			</div>
		</div>
	);
}
