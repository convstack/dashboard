import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { decryptSession, getSessionCookie, type SessionData } from "~/lib/auth";

export const getSessionFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<SessionData | null> => {
		const request = getRequest();
		const cookie = getSessionCookie(request);
		if (!cookie) return null;

		const session = await decryptSession(cookie);
		if (!session) return null;

		// If token expired and no way to refresh server-side, return null
		// The client-side refresh mechanism (via /api/auth/refresh) handles cookie updates
		if (session.expiresAt < Date.now() / 1000) {
			return null;
		}

		return session;
	},
);
