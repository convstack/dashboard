import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { decryptSession, getSessionCookie } from "~/lib/auth";
import { lanyardFetch } from "~/lib/lanyard-client";
import type { ServiceCatalogEntry } from "~/lib/types/catalog";

export const getServiceCatalogFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<ServiceCatalogEntry[]> => {
		const request = getRequest();
		const cookie = getSessionCookie(request);
		if (!cookie) return [];

		const session = await decryptSession(cookie);
		if (!session) return [];

		const response = await lanyardFetch("/api/services/catalog", {
			accessToken: session.accessToken,
		});

		if (!response.ok) return [];
		return response.json();
	},
);
