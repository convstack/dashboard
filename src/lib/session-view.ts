import type { SessionData } from "./auth";

export interface ClientSession {
	expiresAt: number;
	user: SessionData["user"];
}

export function toClientSession(session: SessionData): ClientSession {
	return { expiresAt: session.expiresAt, user: session.user };
}
