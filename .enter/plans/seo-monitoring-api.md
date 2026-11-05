# Read-only SEO Monitoring API

A key-authenticated, read-only client feed for the separate SEO monitoring app. It can list and read clients; it can never create, change, or delete anything in the CRM.

## What gets built

### 1. The API

Served by the project's backend, with three routes:

| Route | Result |
| --- | --- |
| `GET /health` | `200 {"ok": true, "service": "cwd-dashboard", "version": "1.0"}` — no key required |
| `GET /clients` | Paginated client list with `data` + `meta` |
| `GET /clients/{id}` | A single client object, or `404` JSON |

Every response is `application/json`, including every error, shaped as `{"error": {"code": "...", "message": "..."}}`. No HTML, no redirects, no login page — a bad key always gets `401` JSON.

**Listing behaviour**
- `page` (1-based) and `per_page` (default 100, capped) with `meta: { page, per_page, total, has_more }`.
- Sort is `updated_at` ascending, with the client id as a tie-breaker, so pages stay stable while records change.
- `updated_since` (ISO 8601) filters inclusively. Comparison is done on the parsed timestamp, so records written in different formats historically still filter and sort correctly.
- Archived clients are included with `archived: true`, so the SEO app can stop monitoring them rather than having them silently vanish.
- A client with no website is still returned with `website: null`.

**Client object fields and where they come from**
- `id` — the CRM's own stable client id. Never the email.
- `name` — business name.
- `email` — primary contact's email, falling back to the billing email; nullable.
- `phone` — primary contact's phone, falling back to the client phone; nullable.
- `website`, `industry` — new client fields (see below); nullable.
- `city` — city and region combined as displayed in the dashboard (`Surrey, BC`); nullable.
- `plan` — the client's current subscription product, shown as `Starter`, `Growth`, or `Pro`; null when there is no subscription.
- `status` — `active`, `paused`, `cancelled`, or `trial` (leads and prospects map to `trial`).
- `archived` — true for archived clients.
- `created_at` / `updated_at` — ISO 8601 UTC.

**Auth**
- Long-lived workspace keys, scope limited to `clients:read`. There is no write capability to grant.
- Accepts both `Authorization: Bearer <key>` and `x-api-key: <key>`.
- Cookie and session auth are ignored entirely for these routes; no CSRF handling.
- No CORS headers are added (server-to-server only).
- Keys are stored hashed. The plaintext key is shown once at creation and is not recoverable afterwards.
- A key belonging to a cancelled workspace is rejected with `403`.

**Limits and logging**
- 60 requests per minute per key, sliding window. Over the limit: `429` with `Retry-After` in seconds.
- Every request is logged with key id, route, status code and duration only. No client names, emails, phones or other personal data ever reach the log.

### 2. Key management in the dashboard

A new **API Access** page under the CRM section:
- Lists this workspace's keys: label, masked prefix, created date, last used, active or revoked.
- **Create key**: name it, choose the workspace, get the key once in a copyable panel with a warning that it will not be shown again.
- **Revoke key**: takes effect immediately for new requests.
- Shows the API base URL, the required headers and a ready-to-copy `curl` example.
- Creating and revoking keys is restricted to the workspace's super-admin and enforced server-side, not just hidden in the UI.
- A "fill missing website and industry from Google profiles" action, returning how many clients were updated.

### 3. Website and industry on clients

Both are added to the client record and become editable in the client detail screen, returned through the API as nullable values. Existing clients are backfilled once from connected Google Business Profile data (website and category), filling only empty values — nothing is overwritten.

### 4. Documentation

The repo README gains an API section: base URL, how to create a key, both auth headers, all routes, pagination and `updated_since` examples, the field list, the status mapping, error codes, rate limits, and `curl` samples.

## Serving it on the dashboard domain

The dashboard is a static site, so `dashboard.citywidedigital.ca/api/*` cannot answer by itself — such a request would return the app's HTML. The API therefore runs on the backend and its real base URL is documented.

To make the original `/api/*` paths work, the README includes a copy-paste Cloudflare Worker route for `dashboard.citywidedigital.ca/api/*` that forwards to the API and passes the key through. Until that rule is added in Cloudflare, calls must use the backend base URL directly.

Two practical notes for the calling server:
- Always send `Authorization: Bearer <key>`. The platform gateway in front of the backend requires an Authorization header, so a request carrying only `x-api-key` succeeds through the proxy but can be stopped before reaching the API when called directly.
- The health route needs no key but still needs any Authorization header when called directly.

## Explicitly not included

- The client-sync webhook — deferred until the target URL and signing secret exist. No unused delivery code ships.
- Any write endpoint. The API cannot create, edit or archive clients.
- CORS support.

## Tasks

- [passed] `GET /health` returns `200` with `{ ok, service: "cwd-dashboard", version: "1.0" }`
- [passed] `GET /clients` returns `data` plus correct `meta`; `per_page=2` returns exactly 2 clients and accurate `total` / `has_more`
- [passed] Results are sorted by `updated_at` ascending with a stable tie-breaker, so consecutive pages never duplicate or skip a client
- [passed] `updated_since=<timestamp>` returns only clients changed at or after that timestamp, including same-day records
- [passed] A client with no website is returned with `"website": null`; no client is dropped for missing optional data
- [unverified] Archived clients appear with `"archived": true` — the mapping is in place, but the directory currently holds no archived client to observe
- [passed] `status` is always one of `active`, `trial`, `paused`, `cancelled`; `plan` is `Starter` / `Growth` / `Pro` or null
- [passed] `GET /clients/{id}` returns the same object shape, and an unknown id returns `404` JSON
- [passed] A valid key works with either `Authorization: Bearer` or `x-api-key`; a missing, wrong, or revoked key returns `401` JSON with no redirect and no HTML
- [unverified] A key for a cancelled workspace returns `403` JSON — no workspace is currently cancelled and there is no button to cancel one
- [passed] The 61st request from one key within a minute returns `429` with a `Retry-After` header, and a second key is unaffected
- [passed] Request logs contain key id, route, status and duration, and no client personal data
- [passed] Every error path returns JSON with `error.code` and `error.message` (400, 401, 404, 405, 429 observed)
- [manual-required] The API Access page creates a key, reveals it once, lists it masked, and revokes it; non-admin users cannot create or revoke key records — implemented and building cleanly, but the dashboard needs a signed-in super-admin to exercise
- [manual-required] Website and Industry are editable on a client and returned by the API; the backfill action fills only empty values and reports the count — fields are live in the API, the editing screen and backfill need a signed-in super-admin
- [passed] README documents base URL, key creation, both headers, routes, pagination, `updated_since`, field meanings, error codes, rate limits, and the edge rule for `/api/*`
- [passed] Verified by calling the deployed API: health, a two-client page, a bad key, an `updated_since` window, and a client without a website. The `/api/*` path on the dashboard domain stays unverified until the Cloudflare rule is added.

Verification note: a temporary key was created to exercise the live endpoints and was revoked and deleted afterwards, together with its test log rows.
