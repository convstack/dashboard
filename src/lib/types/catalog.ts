import type { UIManifest } from "./manifest";

export interface ServiceCatalogEntry {
	id: string;
	name: string;
	slug: string;
	type: string;
	description: string | null;
	version: string | null;
	baseUrl: string;
	uiManifest: UIManifest | null;
	status: string;
	lastHealthCheck: string | null;
	lastHealthStatus: string | null;
}
