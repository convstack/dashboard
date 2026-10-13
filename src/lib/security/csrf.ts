export function dashboardOrigin(): string {
	return new URL(process.env.DASHBOARD_URL || "http://localhost:4000").origin;
}

export function validateOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (origin !== null) return origin === dashboardOrigin();
	return request.headers.get("sec-fetch-site") === "same-origin";
}
