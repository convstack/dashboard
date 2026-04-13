// dashboard/src/lib/schedule/use-tz-preference.ts
import { useCallback, useEffect, useState } from "react";
import type { TzMode } from "./format-time";

const STORAGE_KEY = "convstack.schedule.tz-pref";
const DEFAULT: TzMode = "viewer";

function read(): TzMode {
	if (typeof window === "undefined") return DEFAULT;
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (raw === "event" || raw === "viewer" || raw === "both") return raw;
	return DEFAULT;
}

export function useTzPreference(): {
	mode: TzMode;
	setMode: (next: TzMode) => void;
} {
	const [mode, setModeState] = useState<TzMode>(DEFAULT);

	// Read on mount (avoids SSR mismatch — server always renders DEFAULT,
	// client hydrates with whatever's in localStorage).
	useEffect(() => {
		setModeState(read());
	}, []);

	// Cross-tab sync via the storage event.
	useEffect(() => {
		function handler(e: StorageEvent) {
			if (e.key !== STORAGE_KEY) return;
			setModeState(read());
		}
		window.addEventListener("storage", handler);
		return () => window.removeEventListener("storage", handler);
	}, []);

	const setMode = useCallback((next: TzMode) => {
		window.localStorage.setItem(STORAGE_KEY, next);
		setModeState(next);
	}, []);

	return { mode, setMode };
}
