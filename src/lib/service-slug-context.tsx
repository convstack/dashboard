import { createContext, useContext } from "react";

const ServiceSlugContext = createContext("");

export const ServiceSlugProvider = ServiceSlugContext.Provider;

export function useServiceSlug(): string {
	return useContext(ServiceSlugContext);
}
