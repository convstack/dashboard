declare module "*/server.js" {
	const app: { fetch: (request: Request) => Response | Promise<Response> };
	export default app;
}

// Fontsource CSS-only packages have no type declarations; allow bare-specifier
// side-effect imports like `import "@fontsource-variable/inter"` to typecheck.
declare module "@fontsource/*" {}
declare module "@fontsource-variable/*" {}
