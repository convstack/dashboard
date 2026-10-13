import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readSession } from "./auth";
import {
	getCachedCatalog,
	type ServiceTarget,
	serviceTarget,
} from "./service-proxy";
import type { ServiceCatalogEntry } from "./types/catalog";

// the token never leaves the server: loaders ask for a target and get a proof.
// The browser's catalog has no addresses, so the full entry comes from the server's own.
export const serverServiceTarget = createServerOnlyFn(
	async (
		service: Pick<ServiceCatalogEntry, "slug">,
	): Promise<ServiceTarget> => {
		const session = await readSession(getRequest());
		if (!session) return { baseUrl: "", authorization: null };
		try {
			const { services, fromCache } = await getCachedCatalog(
				session.user.id,
				session.accessToken,
			);
			let full = services.find((s) => s.slug === service.slug);
			// the cached list can predate a service registered or made visible since
			if (!full && fromCache) {
				const fresh = await getCachedCatalog(
					session.user.id,
					session.accessToken,
					true,
				);
				full = fresh.services.find((s) => s.slug === service.slug);
			}
			if (!full) {
				return { baseUrl: "", authorization: null, failure: "forbidden" };
			}
			return await serviceTarget(full, session.accessToken);
		} catch (err) {
			console.warn(
				"lanyard catalog failed:",
				err instanceof Error ? err.message : err,
			);
			return { baseUrl: "", authorization: null, failure: "unavailable" };
		}
	},
);
