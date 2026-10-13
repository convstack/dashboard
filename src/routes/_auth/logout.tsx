import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/logout")({
	component: LogoutPage,
});

function LogoutPage() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<form
				method="post"
				action="/api/auth/logout"
				className="w-full max-w-sm space-y-6 rounded-lg border border-(--border) bg-(--card) p-8 text-center"
			>
				<h1 className="text-2xl font-bold">Sign out</h1>
				<p className="text-sm text-(--muted-foreground)">
					You will be signed out of the dashboard and your sign-in session.
				</p>
				<button
					type="submit"
					className="w-full rounded-md bg-(--primary) px-4 py-2.5 text-sm font-medium text-(--primary-foreground) hover:opacity-90"
				>
					Sign out
				</button>
			</form>
		</div>
	);
}
