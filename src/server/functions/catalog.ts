import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readSession } from "~/lib/auth";
import { forBrowser } from "~/lib/browser-catalog";
import { getShellCatalog } from "~/lib/service-proxy";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";

export const getServiceCatalogFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<ServiceCatalogEntry[]> => {
		const session = await readSession(getRequest());
		if (!session) return [];
		return forBrowser(
			await getShellCatalog(session.user.id, session.accessToken),
		);
	},
);
