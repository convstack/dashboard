import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { brandingCss, safeBrandImage } from "~/lib/branding";
import { getBrandingFn } from "~/server/functions/branding";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
	loader: () => getBrandingFn(),
	head: ({ loaderData }) => {
		const favicon = loaderData ? safeBrandImage(loaderData.faviconUrl) : null;
		return {
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "description", content: "Convention Dashboard" },
				{ title: loaderData?.name ?? "ConvStack" },
			],
			links: [
				{ rel: "stylesheet", href: appCss },
				favicon
					? { rel: "icon", href: favicon }
					: { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
			],
		};
	},
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
	const nonce = useRouter().options.ssr?.nonce;
	const css = brandingCss(Route.useLoaderData());

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				{css && (
					<style nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />
				)}
				<script
					nonce={nonce}
					suppressHydrationWarning
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
