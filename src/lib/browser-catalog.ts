import type { ServiceCatalogEntry } from "./types/catalog";

// where a service lives is for the server only; the browser reaches it through the proxy
export function forBrowser(
	services: ServiceCatalogEntry[],
): ServiceCatalogEntry[] {
	return services.map((service) => ({ ...service, baseUrl: "" }));
}
