> **Warning**
> This project is under active development and not yet ready for production use. APIs, features, and the manifest schema may change without notice.

# Dashboard

Dashboard is an auto-discovering UI shell for the Convention platform, inspired by OpenStack's Horizon. It authenticates users via Lanyard's OIDC flow, queries the service catalog, and dynamically renders all UI based on JSON manifests provided by registered services.

## What it does

- **Dynamic UI Rendering** — Services register JSON manifests describing their navigation, pages, widgets, and sections. Dashboard builds the entire interface from these manifests — no service-specific code in Dashboard itself.
- **OIDC Authentication** — Authenticates users via Lanyard's OpenID Connect flow (PKCE authorization code grant) and manages encrypted session cookies.
- **API Proxy** — All requests from the browser to backend services go through Dashboard's proxy, which adds authentication headers and enforces CSRF protection. The browser never contacts backend services directly.
- **Section Types** — Renders data tables, detail views, forms (with file upload), action bars, two-factor setup, and passkey management from declarative manifest configs.

## Architecture

Dashboard has no database. It's a stateless UI layer that gets everything from the service catalog.

```
Browser → Dashboard (UI + Proxy)
              ↓ OIDC auth
           Lanyard (Identity + Catalog)
              ↓ API proxy
           Backend Services (REST APIs with manifests)
```

When a new service registers with Lanyard and provides a UI manifest, it automatically appears in Dashboard's sidebar — no deployment or code changes needed.

## Tech Stack

- **Runtime:** Bun
- **Framework:** TanStack React Start (Vite + React 19)
- **Styling:** Tailwind CSS v4 with oklch CSS variables
- **Icons:** Lucide React (dynamically resolved by name from manifests)
- **Auth:** OIDC PKCE flow with AES-GCM encrypted session cookies
- **Linting:** Biome

## Getting Started

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env — set LANYARD_URL, DASHBOARD_CLIENT_ID, DASHBOARD_CLIENT_SECRET, SESSION_SECRET

# Start development server (requires Lanyard running on port 3000)
bun run dev
```

## Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start dev server (port 4000) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | Biome linting |
| `bun run test` | Run tests |

## Manifest System

Services describe their UI with a JSON manifest:

```json
{
  "name": "My Service",
  "icon": "box",
  "navigation": [
    { "label": "Users", "path": "/users", "icon": "users" }
  ],
  "pages": [
    {
      "path": "/users",
      "title": "Users",
      "sections": [
        { "type": "data-table", "endpoint": "/api/users", "config": {} }
      ]
    }
  ]
}
```

### Supported Section Types

| Type | Description |
|---|---|
| `data-table` | Table with columns, row links, row actions |
| `detail` | Key-value field display |
| `form` | Input form with file upload support |
| `action-bar` | Dynamic action buttons fetched from endpoint |
| `widget-grid` | Widget cards (stat, chart, table, list, progress) |
| `two-factor` | 2FA enable/disable/verify flow |
| `passkey-manager` | WebAuthn passkey registration and management |
