import { createMiddleware, createStart } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { applySecurityHeaders } from "~/lib/security/apply";
import { parseSources } from "~/lib/security/csp";
import { nonceFor } from "~/lib/security/nonce";

const imgSources = parseSources(
	"DASHBOARD_CSP_IMG_SRC",
	process.env.DASHBOARD_CSP_IMG_SRC,
);
const connectSources = parseSources(
	"DASHBOARD_CSP_CONNECT_SRC",
	process.env.DASHBOARD_CSP_CONNECT_SRC,
);

// sign-out is a form post that the browser follows to the identity provider
const idpOrigin = new URL(process.env.IDP_URL || "http://localhost:9000")
	.origin;

const securityHeaders = createMiddleware().server(async ({ next }) => {
	const request = getRequest();
	const nonce = nonceFor(request);
	const result = await next();
	return {
		...result,
		response: applySecurityHeaders(result.response, {
			nonce,
			pathname: new URL(request.url).pathname,
			production: process.env.NODE_ENV === "production",
			imgSources,
			connectSources,
			formActionSources: [idpOrigin],
			noStorePrefixes: ["/_serverFn/", "/api/"],
		}),
	};
});

export const startInstance = createStart(() => ({
	requestMiddleware: [securityHeaders],
}));
