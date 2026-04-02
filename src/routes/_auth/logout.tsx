import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_auth/logout")({
	component: LogoutPage,
});

function LogoutPage() {
	useEffect(() => {
		async function logout() {
			await fetch("/api/auth/logout", { method: "POST" });
			window.location.href = "/login";
		}
		logout();
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-sm text-(--muted-foreground)">Signing out...</p>
		</div>
	);
}
