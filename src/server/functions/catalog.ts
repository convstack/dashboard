import { createServerFn } from "@tanstack/react-start";
import { lanyardFetch } from "~/lib/lanyard-client";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";

export const getServiceCatalogFn = createServerFn({ method: "GET" })
	.inputValidator((input: { accessToken: string }) => input)
	.handler(async ({ data }): Promise<ServiceCatalogEntry[]> => {
		const response = await lanyardFetch("/api/services/catalog", {
			accessToken: data.accessToken,
		});

		if (!response.ok) return [];
		return response.json();
	});
