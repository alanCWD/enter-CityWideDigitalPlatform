# Welcome to your Enter project

[![Built with enter.pro](https://img.shields.io/badge/Build%20with-Enter.pro-FC5776?style=for-the-badge&labelColor=1F1F1F)](https://enter.pro)

*Automatically synced with your [enter.pro](https://enter.pro) workspace* 

---

## Overview

This repository is automatically linked to your app on [enter.pro](https://enter.pro).  
Every change you make in Enter will be reflected here — and any updates you push to this repo will sync back seamlessly.  

Enter.pro helps you **build, edit, and deploy full-stack web apps by prompting**.  
Just describe what you want — Enter turns ideas into production-ready code.

---

## Project URLs

**Live app:** https://5831877fc23c4834938c8f0f2295f49b-latest.preview.enter.pro  
**Edit & build in Enter:** https://enter.pro/project/5831877fc23c4834938c8f0f2295f49b


---

## Continue building

Keep developing your app directly in [Enter.pro](https://enter.pro/project/5831877fc23c4834938c8f0f2295f49b).  
Prompt new features, refine the UI, or connect integrations — all changes are versioned and synced automatically to GitHub.

---

## SEO Monitoring API (read-only)

A key-authenticated, read-only client feed for the SEO monitoring app. It can list and read clients; it cannot create, change, archive or delete anything in the CRM.

**Base URL**

```
https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/seo-api
```

### Create a key

1. Sign in to the dashboard → **CRM** → **API Access**.
2. Enter a name (e.g. `SEO monitoring`), then **Create key**.
3. Copy the key immediately — it is shown once and stored hashed. If it is lost, revoke it and create a new one.
4. **Revoke** works instantly and only affects that key.

Each key is scoped to `clients:read` and belongs to one workspace. Only the workspace super-admin can create or revoke keys; server-side checks enforce this, not just the UI. If a workspace is cancelled, its keys return `403`.

### Authentication

Send either header — never a cookie or session:

```
Authorization: Bearer <key>
x-api-key: <key>
```

These routes are server-to-server: no CORS headers are emitted and no CSRF token is required.

> When calling the backend URL directly, always send `Authorization`. The platform gateway requires that header, so a request carrying only `x-api-key` can be rejected before it reaches the API. The `/api/*` edge rule below forwards either header.

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe, no key required |
| `GET` | `/clients` | Paginated client list |
| `GET` | `/clients/{id}` | One client, or `404` JSON |

```
GET /health
200 {"ok": true, "service": "cwd-dashboard", "version": "1.0"}
```

```
GET /clients?page=1&per_page=100&updated_since=2026-01-01T00:00:00Z
200 {
  "data": [
    {
      "id": "cl_8f2c1a",
      "name": "Coastline Landscaping",
      "email": "jordan@coastline.ca",
      "phone": "+16045550132",
      "website": "https://coastlinelandscaping.ca",
      "industry": "Landscaping",
      "city": "Surrey, BC",
      "plan": "Growth",
      "status": "active",
      "archived": false,
      "created_at": "2025-03-04T15:02:11.000Z",
      "updated_at": "2026-11-04T09:12:00.000Z"
    }
  ],
  "meta": { "page": 1, "per_page": 100, "total": 42, "has_more": false }
}
```

Query parameters

| Name | Default | Notes |
| --- | --- | --- |
| `page` | `1` | 1-based |
| `per_page` | `100` | Capped at `500` |
| `updated_since` | — | ISO 8601, inclusive. Only clients updated at or after this moment |

Results are ordered by `updated_at` ascending, with the client id as a tie-breaker, so paging stays stable while records change. Archived clients are included so monitoring can be stopped rather than silently dropped. A client without a website is still returned with `"website": null`.

Field meanings

| Field | Source |
| --- | --- |
| `id` | Stable CRM client id — never the email |
| `email` / `phone` | Primary contact, falling back to the client's billing email / phone |
| `city` | City and region as displayed in the dashboard (`Surrey, BC`) |
| `plan` | Current subscription product: `Starter`, `Growth`, `Pro`, or `null` |
| `status` | `active`, `trial` (leads and prospects), `paused`, `cancelled` (churned or archived) |
| `archived` | `true` for archived clients |

### Errors

Every response is `application/json`, including failures. There is no redirect to a login page.

```json
{ "error": { "code": "unauthorized", "message": "Invalid API key" } }
```

| Status | `code` | When |
| --- | --- | --- |
| `401` | `unauthorized` | Missing, wrong or revoked key |
| `403` | `forbidden` | Key belongs to a cancelled workspace |
| `404` | `not_found` | Unknown route or unknown client id |
| `405` | `method_not_allowed` | Anything other than `GET` |
| `400` | `invalid_parameter` | Malformed `page`, `per_page` or `updated_since` |
| `429` | `rate_limited` | More than 60 requests in a minute — see `Retry-After` |
| `500` | `internal_error` | Unexpected server failure |

### Rate limiting and logging

60 requests per minute per key over a sliding window. Over the limit the API returns `429` with a `Retry-After` header in seconds. Limits are per key, so a second key is unaffected.

Every request is logged with the key id, route, status and duration. Client names, emails, phones and other personal data are never logged.

### Samples

```bash
# Health
curl -H "Authorization: Bearer $KEY" \
  "https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/seo-api/health"

# Two clients
curl -H "Authorization: Bearer $KEY" \
  "https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/seo-api/clients?per_page=2"

# Incremental sync since yesterday
curl -H "x-api-key: $KEY" \
  "https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/seo-api/clients?updated_since=$(date -u -d yesterday +%Y-%m-%dT%H:%M:%SZ)"

# One client
curl -H "Authorization: Bearer $KEY" \
  "https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/seo-api/clients/cl_8f2c1a"
```

### Exposing it at `dashboard.citywidedigital.ca/api/*`

The dashboard is a static site, so `/api/*` on that domain cannot be answered by the app itself — it would return the app's HTML. The API therefore runs on the backend base URL above.

To make the original paths work, add a Cloudflare Worker with the route `dashboard.citywidedigital.ca/api/*`:

```js
const API_BASE = "https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/seo-api";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
    const headers = new Headers(request.headers);
    // The backend gateway always needs Authorization; accept x-api-key callers.
    if (!headers.has("Authorization") && headers.has("x-api-key")) {
      headers.set("Authorization", `Bearer ${headers.get("x-api-key")}`);
    }
    const target = `${API_BASE}${url.pathname.slice(4)}${url.search}`;
    return fetch(new Request(target, { method: request.method, headers }));
  },
};
```

Once that route is live, `https://dashboard.citywidedigital.ca/api/clients?per_page=2` behaves exactly like the samples above. Until then, call the base URL directly.

## Local development

Prefer to work locally? You can clone this repo and start developing right away:

```bash
# Step 1: Clone your project repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate into the project folder
cd <YOUR_PROJECT_NAME>

# Step 3: Install all dependencies
npm install

# Step 4: Start the local development server
npm run dev
```

Push your commits — Enter.pro will automatically detect and sync your latest changes.

---

## Tech stack

This project uses:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

---

## Deployment

To deploy, open your Enter.pro project and click "Publish"

Your app will automatically build and go live at your production URL.

---

✨ Keep prompting, keep building — Enter.pro handles the rest.