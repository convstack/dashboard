import { createRouter } from "@tanstack/react-router";
import { RouteError } from "~/components/layout/route-error";
import { getServerNonce } from "~/lib/security/server-nonce";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: false,
		defaultErrorComponent: RouteError,
		ssr: { nonce: import.meta.env.SSR ? getServerNonce() : undefined },
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
