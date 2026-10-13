import { createServerFn } from "@tanstack/react-start";
import { type BrandingView, getBranding } from "~/lib/branding";

export const getBrandingFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<BrandingView> => getBranding(),
);
