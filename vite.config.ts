/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 4000,
    // Authentik's worker posts back-channel logouts through host.docker.internal,
    // which Docker Desktop delivers on IPv4 and Vite rejects as a host by default
    host: "127.0.0.1",
    allowedHosts: ["host.docker.internal"],
  },
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    // rrule v2 ships an ESM build whose internal imports are extensionless
    // (`import './rrule'` instead of `import './rrule.js'`), which Node's
    // native ESM resolver (used by TanStack Start's SSR path) rejects.
    // Forcing Vite to bundle rrule for SSR runs its interop and fixes the
    // extensionless imports. Same concept as `optimizeDeps.include` but for
    // the server bundle.
    noExternal: ["rrule"],
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
  ],
  test: {
    env: {
      SESSION_SECRET: "vitest-session-secret-0123456789abcdef",
      DASHBOARD_CLIENT_SECRET: "vitest-client-secret",
      DASHBOARD_URL: "http://dashboard.test",
    },
  },
});
