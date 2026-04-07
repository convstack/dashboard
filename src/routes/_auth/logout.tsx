import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { LANYARD_URL } from "~/lib/lanyard-client";

const getLogoutConfigFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:4000";
		const clientId = process.env.DASHBOARD_CLIENT_ID || "dashboard";
		return {
			endSessionUrl: `${LANYARD_URL}/api/auth/oauth2/end-session?client_id=${encodeURIComponent(clientId)}&post_logout_redirect_uri=${encodeURIComponent(`${dashboardUrl}/login`)}`,
		};
	},
);

export const Route = createFileRoute("/_auth/logout")({
	loader: () => getLogoutConfigFn(),
	component: LogoutPage,
});

function LogoutPage() {
	const { endSessionUrl } = Route.useLoaderData();

	useEffect(() => {
		async function logout() {
			// 1. Clear Dashboard session cookie
			await fetch("/api/auth/logout", { method: "POST" });
			// 2. Redirect to Lanyard's end_session to clear Lanyard session
			//    This is a top-level navigation so Lanyard's cookies are sent
			window.location.href = endSessionUrl;
		}
		logout();
	}, [endSessionUrl]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-sm text-(--muted-foreground)">Signing out...</p>
		</div>
	);
}
