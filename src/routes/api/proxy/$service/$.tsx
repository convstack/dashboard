import { createFileRoute } from "@tanstack/react-router";
import { validateOrigin } from "~/lib/security/csrf";
import { proxyRequest } from "~/lib/service-proxy";

async function handleProxy({
	request,
	params,
}: {
	request: Request;
	params: { service: string; "*": string };
}) {
	// CSRF check for state-changing methods
	if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
		if (!validateOrigin(request)) {
			return new Response(JSON.stringify({ error: "Invalid origin" }), {
				status: 403,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	return proxyRequest(request, params.service, params["*"] || "");
}

export const Route = createFileRoute("/api/proxy/$service/$")({
	server: {
		handlers: {
			GET: handleProxy,
			POST: handleProxy,
			PUT: handleProxy,
			DELETE: handleProxy,
			PATCH: handleProxy,
		},
	},
});
