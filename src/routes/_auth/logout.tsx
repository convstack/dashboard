import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { LANYARD_URL } from "~/lib/lanyard-client";

const getLogoutConfigFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:4000";
		const clientId = process.env.DASHBOARD_CLIENT_ID || "dashboard";
		return {
			lanyardUrl: LANYARD_URL,
			clientId,
			dashboardUrl,
		};
	},
);

export const Route = createFileRoute("/_auth/logout")({
	loader: () => getLogoutConfigFn(),
	component: LogoutPage,
});

function LogoutPage() {
	const { lanyardUrl, clientId, dashboardUrl } = Route.useLoaderData();

	useEffect(() => {
		async function logout() {
			// 1. Clear Dashboard session cookie and get the ID token
			const res = await fetch("/api/auth/logout", { method: "POST" });
			const data = await res.json().catch(() => ({}));

			// 2. Redirect to Lanyard's end-session with id_token_hint
			const params = new URLSearchParams({
				client_id: clientId,
				post_logout_redirect_uri: `${dashboardUrl}/login`,
			});
			if (data.idToken) {
				params.set("id_token_hint", data.idToken);
			}
			window.location.href = `${lanyardUrl}/api/auth/oauth2/end-session?${params.toString()}`;
		}
		logout();
	}, [lanyardUrl, clientId, dashboardUrl]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-sm text-(--muted-foreground)">Signing out...</p>
		</div>
	);
}
