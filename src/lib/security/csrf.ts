const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:4000";

export function validateOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) return true; // Same-origin requests may not have origin header

	const allowedOrigins = [dashboardUrl, "http://localhost:4000"];

	return allowedOrigins.some((allowed) => origin === allowed);
}
