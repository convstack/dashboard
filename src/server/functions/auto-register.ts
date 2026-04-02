import { DASHBOARD_URL, LANYARD_URL } from "~/lib/auth";

let registered = false;

export async function ensureDashboardRegistered(): Promise<{
	clientId: string;
	clientSecret: string;
} | null> {
	if (registered) return null;

	// If we already have a client secret configured, skip auto-registration
	if (process.env.DASHBOARD_CLIENT_SECRET) {
		registered = true;
		return null;
	}

	try {
		// Try to register as OIDC client via Lanyard's OAuth2 dynamic client registration
		const response = await fetch(`${LANYARD_URL}/api/auth/oauth2/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				client_name: "Convention Dashboard",
				redirect_uris: [`${DASHBOARD_URL}/callback`],
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				token_endpoint_auth_method: "client_secret_post",
			}),
		});

		if (response.ok) {
			const data = await response.json();
			registered = true;
			console.log("Dashboard auto-registered with Lanyard:");
			console.log(`  Client ID: ${data.client_id}`);
			console.log("  Client Secret: (set DASHBOARD_CLIENT_SECRET env var)");
			return {
				clientId: data.client_id,
				clientSecret: data.client_secret,
			};
		}

		// If registration fails (e.g., already exists), that's fine
		const errorText = await response.text();
		console.warn(
			`Dashboard auto-registration returned ${response.status}: ${errorText}`,
		);
		registered = true;
		return null;
	} catch (error) {
		console.warn("Failed to auto-register dashboard with Lanyard:", error);
		return null;
	}
}
