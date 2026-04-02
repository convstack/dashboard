import { join } from "node:path";
import app from "./dist/server/server.js";

const DIST_CLIENT = join(import.meta.dir, "dist", "client");

const MIME_TYPES: Record<string, string> = {
	".js": "application/javascript",
	".css": "text/css",
	".html": "text/html",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".eot": "application/vnd.ms-fontobject",
	".webp": "image/webp",
	".avif": "image/avif",
	".map": "application/json",
	".txt": "text/plain",
	".xml": "application/xml",
	".webmanifest": "application/manifest+json",
};

function getMimeType(path: string): string {
	const ext = path.slice(path.lastIndexOf("."));
	return MIME_TYPES[ext] || "application/octet-stream";
}

const port = Number(process.env.PORT) || 4000;

Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// Serve static files from dist/client
		if (pathname.startsWith("/assets/")) {
			const filePath = join(DIST_CLIENT, pathname);
			const file = Bun.file(filePath);
			if (await file.exists()) {
				return new Response(file, {
					headers: {
						"Content-Type": getMimeType(pathname),
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			}
		}

		// Forward everything else to TanStack Start handler
		return app.fetch(request);
	},
});

console.log(`Dashboard server listening on http://localhost:${port}`);
