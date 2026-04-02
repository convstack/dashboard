import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	buildAuthorizationUrl,
	generateCodeChallenge,
	generateCodeVerifier,
	generateState,
} from "~/lib/auth";
import { LANYARD_URL } from "~/lib/lanyard-client";
import { ensureDashboardRegistered } from "~/server/functions/auto-register";

const initiateLoginFn = createServerFn({ method: "GET" }).handler(async () => {
	try {
		// Check if Lanyard is reachable
		const healthCheck = await fetch(`${LANYARD_URL}/api/health`, {
			signal: AbortSignal.timeout(5000),
		}).catch(() => null);

		if (!healthCheck || !healthCheck.ok) {
			return { error: "unreachable" as const };
		}

		// Ensure dashboard is registered with Lanyard on first use
		await ensureDashboardRegistered();

		const state = generateState();
		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		const authUrl = buildAuthorizationUrl(state, codeChallenge);

		return { authUrl, state, codeVerifier };
	} catch {
		return { error: "unreachable" as const };
	}
});

export const Route = createFileRoute("/_auth/login")({
	loader: async () => {
		return await initiateLoginFn();
	},
	component: LoginPage,
});

function LoginPage() {
	const data = Route.useLoaderData();

	if ("error" in data) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="w-full max-w-md space-y-6 rounded-lg border border-(--border) bg-(--card) p-8 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
						<svg
							className="h-8 w-8 text-red-600 dark:text-red-400"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							role="img"
							aria-label="Warning"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
							/>
						</svg>
					</div>
					<div>
						<h1 className="text-xl font-bold">Unable to Connect to Lanyard</h1>
						<p className="mt-2 text-sm text-(--muted-foreground)">
							The identity provider is not reachable. This could mean Lanyard is
							not running or the Dashboard is misconfigured.
						</p>
					</div>
					<div className="rounded-md bg-(--muted) p-4 text-left text-xs font-mono text-(--muted-foreground) space-y-1">
						<p>
							<span className="font-semibold text-(--foreground)">
								Lanyard URL:
							</span>{" "}
							{typeof window !== "undefined" ? "configured server-side" : "—"}
						</p>
						<p>
							<span className="font-semibold text-(--foreground)">Status:</span>{" "}
							Connection refused
						</p>
					</div>
					<div className="text-left text-sm text-(--muted-foreground) space-y-2">
						<p className="font-medium text-(--foreground)">Things to check:</p>
						<ul className="list-disc pl-5 space-y-1">
							<li>Lanyard is running and accessible</li>
							<li>
								<code className="rounded bg-(--muted) px-1 py-0.5 text-xs">
									LANYARD_URL
								</code>{" "}
								environment variable is set correctly
							</li>
							<li>Network connectivity between Dashboard and Lanyard</li>
						</ul>
					</div>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="w-full rounded-md border border-(--border) px-4 py-2.5 text-sm font-medium hover:bg-(--accent)"
					>
						Retry Connection
					</button>
				</div>
			</div>
		);
	}

	const { authUrl, state, codeVerifier } = data;

	const handleLogin = () => {
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
