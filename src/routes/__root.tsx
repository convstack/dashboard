import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "description", content: "Convention Dashboard" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	component: RootComponent,
	notFoundComponent: () => (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-center space-y-2">
				<h1 className="text-2xl font-bold">404</h1>
				<p className="text-sm text-(--fg-muted)">Page not found.</p>
			</div>
		</div>
	),
});

function RootComponent() {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<title>Dashboard</title>
				<script
					dangerouslySetInnerHTML={{
						__html: `
              (function() {
                var theme = localStorage.getItem('dashboard-theme') || 'system';
                if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
					}}
				/>
			</head>
			<body className="min-h-screen antialiased">
				<Outlet />
				<Scripts />
			</body>
		</html>
	);
}
