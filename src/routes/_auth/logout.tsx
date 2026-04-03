import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { LANYARD_URL } from "~/lib/lanyard-client";

const getLogoutUrlFn = createServerFn({ method: "GET" }).handler(async () => {
	const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:4000";
	return {
		lanyardEndSession: `${LANYARD_URL}/api/auth/oauth2/endsession?post_logout_redirect_uri=${encodeURIComponent(`${dashboardUrl}/login`)}`,
	};
});

export const Route = createFileRoute("/_auth/logout")({
	loader: async () => {
		return await getLogoutUrlFn();
	},
	component: LogoutPage,
});

function LogoutPage() {
	const { lanyardEndSession } = Route.useLoaderData();

	useEffect(() => {
		async function logout() {
			// Clear Dashboard session cookie
			await fetch("/api/auth/logout", { method: "POST" });
			// Redirect to Lanyard's end_session which revokes the session
			// and redirects back to Dashboard's login page
			window.location.href = lanyardEndSession;
		}
		logout();
	}, [lanyardEndSession]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-sm text-(--muted-foreground)">Signing out...</p>
		</div>
	);
}
