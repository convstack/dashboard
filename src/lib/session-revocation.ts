// Process memory only: after a restart, or on another replica, a session
// still ends at its next refresh, which Authentik refuses for a
// deactivated or deleted user.
const revokedAt = new Map<string, number>();
const revokedSessions = new Map<string, number>();
// the session cookie's Max-Age; older cookies are gone anyway
const RETENTION_SECONDS = 86400;

function record(revocations: Map<string, number>, key: string, at: number) {
	for (const [other, time] of revocations) {
		if (at - time > RETENTION_SECONDS) revocations.delete(other);
	}
	const current = revocations.get(key);
	if (current === undefined || at > current) revocations.set(key, at);
}

export function revokeSubject(sub: string, at: number): void {
	record(revokedAt, sub, at);
}

export function revokeSession(sid: string, at: number): void {
	record(revokedSessions, sid, at);
}

export function isRevoked(
	sub: string,
	issuedAt: number,
	sid?: string,
): boolean {
	const at = revokedAt.get(sub);
	if (at !== undefined && issuedAt <= at) return true;
	if (sid === undefined) return false;
	// a logout does not always end the Authentik session, so a later sign-in
	// in the same browser can carry the same sid
	const sessionAt = revokedSessions.get(sid);
	return sessionAt !== undefined && issuedAt <= sessionAt;
}

export function __resetRevocations(): void {
	revokedAt.clear();
	revokedSessions.clear();
}
