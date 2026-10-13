// Schedule the refresh as a fraction of the remaining token lifetime rather
// than a fixed lead - a fixed lead only makes sense for one specific token
// duration, and this needs to work for both a 5-minute access token and a
// much longer one. Floored so a token that's already near/past expiry still
// gets a real delay instead of firing at 0ms.
const REFRESH_FRACTION = 0.8;
const MIN_REFRESH_DELAY_MS = 5000;

export function computeRefreshDelayMs(timeUntilExpiry: number): number {
	return Math.max(
		timeUntilExpiry * REFRESH_FRACTION * 1000,
		MIN_REFRESH_DELAY_MS,
	);
}
