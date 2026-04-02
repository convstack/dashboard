import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/_auth/callback")({
	component: CallbackPage,
});

function CallbackPage() {
	const [status, setStatus] = useState("Completing sign in...");
	const ran = useRef(false);

	useEffect(() => {
		if (ran.current) return;
		ran.current = true;

		async function handleCallback() {
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

			const savedState = sessionStorage.getItem("oauth_state");
			const codeVerifier = sessionStorage.getItem("oauth_code_verifier");

			if (state !== savedState || !codeVerifier) {
				setStatus("Invalid state parameter. Please try again.");
				return;
			}

			sessionStorage.removeItem("oauth_state");
			sessionStorage.removeItem("oauth_code_verifier");

			try {
				const response = await fetch("/api/auth/callback", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ code, codeVerifier }),
					credentials: "same-origin",
				});

				const result = await response.json();

				if (!response.ok || result.error) {
					setStatus(result.error || "Authentication failed");
					return;
				}

				window.location.href = "/home";
			} catch {
				setStatus("Failed to complete authentication");
			}
		}

		handleCallback();
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center space-y-4">
				<div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-(--primary) border-t-transparent" />
				<p className="text-sm text-(--muted-foreground)">{status}</p>
			</div>
		</div>
	);
}
