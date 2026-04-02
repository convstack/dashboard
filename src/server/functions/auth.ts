import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
	decryptSession,
	fetchUserInfo,
	getSessionCookie,
	refreshAccessToken,
	type SessionData,
} from "~/lib/auth";

export const getSessionFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<SessionData | null> => {
		const request = getRequest();
		const cookie = getSessionCookie(request);
		if (!cookie) return null;

		const session = await decryptSession(cookie);
		if (!session) return null;

		// Check if token is expired (with 60s buffer)
		if (session.expiresAt < Date.now() / 1000 + 60) {
			// Try to refresh
			const tokens = await refreshAccessToken(session.refreshToken);
			if (!tokens) return null;

			const user = await fetchUserInfo(tokens.access_token);
			if (!user) return null;

			// Return refreshed session (cookie will be updated on next navigation)
			return {
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
				expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
				user,
			};
		}

		return session;
	},
);
