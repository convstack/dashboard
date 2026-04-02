const LANYARD_URL = process.env.LANYARD_URL || "http://localhost:3000";

export async function lanyardFetch(
	path: string,
	options: RequestInit & { accessToken?: string } = {},
) {
	const { accessToken, ...fetchOptions } = options;
	const headers = new Headers(fetchOptions.headers);

	if (accessToken) {
		headers.set("Authorization", `Bearer ${accessToken}`);
	}
	if (!headers.has("Content-Type") && fetchOptions.body) {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetch(`${LANYARD_URL}${path}`, {
		...fetchOptions,
		headers,
	});

	return response;
}

export { LANYARD_URL };
