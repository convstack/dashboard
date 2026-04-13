import type { TopBarContribution } from "@convstack/service-sdk/types";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

interface TopBarContextValue {
	envelope: TopBarContribution | null;
	set: (envelope: TopBarContribution | null) => void;
}

const TopBarContext = createContext<TopBarContextValue | null>(null);

export function TopBarProvider({ children }: { children: ReactNode }) {
	const [envelope, setEnvelope] = useState<TopBarContribution | null>(null);

	const set = useCallback((next: TopBarContribution | null) => {
		setEnvelope(next);
	}, []);

	return (
		<TopBarContext.Provider value={{ envelope, set }}>
			{children}
		</TopBarContext.Provider>
	);
}

export function useTopBarContext(): TopBarContextValue {
	const ctx = useContext(TopBarContext);
	if (!ctx) {
		// Outside the provider (unusual): return a no-op so callers don't crash
		return { envelope: null, set: () => {} };
	}
	return ctx;
}
