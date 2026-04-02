import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { clearSessionCookie } from "~/lib/auth";

const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
	return { cookie: clearSessionCookie() };
});

export const Route = createFileRoute("/_auth/logout")({
	component: LogoutPage,
});

function LogoutPage() {
	const handleLogout = async () => {
		const result = await logoutFn();
		// biome-ignore lint/suspicious/noDocumentCookie: clearing session cookie requires direct assignment
		document.cookie = result.cookie;
		window.location.href = "/login";
	};

	if (typeof window !== "undefined") {
		setTimeout(handleLogout, 0);
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-sm text-(--muted-foreground)">Signing out...</p>
		</div>
	);
}
