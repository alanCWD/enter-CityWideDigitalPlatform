# Social Studio entitlement handoff (CED producer)

Read-only, server-to-server endpoint the CityWide Social Studio polls to mirror one workspace's plan, entitlements and staff. CED remains the source of truth; the studio never writes.

```
GET https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/studio-entitlements/v1/workspaces/{workspaceId}/entitlements
Authorization: Bearer <workspace token>
Accept: application/json
If-None-Match: <etag>          (optional)
```

The canonical `/api/v1/...` path differs only by the host's function base: this endpoint also accepts a leading `/api`, so a proxy exposing `/api/v1/workspaces/...` reaches the same handler. `openapi.yaml` states the real sandbox base.

## Workspaces on the sandbox

| Workspace | CED client | Plan | Studio |
| --- | --- | --- | --- |
| `ws_citywide` | CityWide Digital | Growth, $397 CAD/mo | included, 4 channels, $40 AI cap |
| `ws_citywide_starter` | CityWide Digital — Starter (sandbox) | Starter, $197 CAD/mo | not included, 0 channels |

Both are ordinary CED client records with a CED-managed subscription (no Stripe link). They appear in the CRM client list like any other client; edit or remove them there.

## Getting a token

Dashboard → CRM → **API Access** → **Social Studio access**. A super admin issues one token per workspace, sees the plaintext exactly once, and hands it to the studio out of band. No token is stored in this repository or in this document. Only its SHA-256 hash is stored.

Rotate by issuing a new token, switching the studio, then revoking the old one. Revocation takes effect on the next request; the studio never needs a redeploy.

## Where each field comes from

`account` comes from the mapped CED client record (name, status, billing email), plus the per-workspace timezone and the plan currency. `subscription` comes from that client's subscription joined to its plan product: the plan id is mapped from the product name (Starter/Growth/Pro), the name is the product name unchanged, the price is the product's pre-tax amount, status is the subscription's state mapped onto the five contract values, and the period end and cancel flag are the subscription's own. `entitlements` come from CED's per-plan entitlement table, keyed by the mapped plan id. `members` are derived live from CED access data: agency staff, people bound to the client, client portal users when the client has a Google Business Profile connection, and studio staff CED has invited who have no login yet. `syncedAt` is when the snapshot was assembled, and `etag` is a fingerprint of everything above except `syncedAt`.

**Plan changes propagate immediately.** Every request re-reads the CRM; nothing is cached, not even for a fraction of a second, and no proxy may keep the response. Editing the client's subscription or plan in CED (or a Stripe subscription event landing in CED) is visible on the very next poll, well inside the 60-second requirement. The same is true for staff: remove someone in CED and they are gone from the next snapshot. Verified live by removing and restoring a member and watching both the member list and the fingerprint change.

## Versioning statement

`schemaVersion` is `2026-11-01`. Additive fields are not breaking and keep the same version; the studio must ignore unknown fields. **Breaking** means removing or renaming a field, changing a field's type, changing an enum's allowed values, changing what a field means (for example redefining `maxChannels`), changing auth or caching semantics, or changing the plan-id mapping. A breaking change ships as a new major (`2027-…`) served by this endpoint alongside the old field set, announced before the old major is retired; the studio rejects any other major, so both sides can deploy independently.

## Deliberate differences and honest gaps

- **Latency.** Measured p95 is about 0.8 s on the sandbox host, above the 500 ms target. The CED CRM read alone costs roughly 0.5–0.7 s from this host (the existing SEO API, which does the same reads, measures ~1.5 s). The endpoint makes two sequential calls: one database call for auth, rate limit and logging, then the CRM read and member read in parallel. Latency at 50 staff was not measured — the sandbox workspace has two members — so the 500 ms target is reported unmet rather than claimed.
- **Timezone.** CED stores no timezone anywhere. It is held once per workspace in CED and seeded to `America/Toronto`.
- **GST.** CED hardcodes 5% in checkout and stores no rate. The fraction is held per workspace and returned as `0.05`.
- **AI caps.** Growth's $40 comes from the brief; Starter's 0 and Pro's 120 are proposed defaults. All three live in an editable per-plan table, so changing them needs no deploy.
- **Plan mapping is strict.** Plans are recognised by name. An unrecognised plan returns `503` rather than a nearest guess, because a wrong plan silently changes what the studio allows.
- **Pending client-portal invites are not listed.** Real logged-in portal users are included as approvers when the client has a Google Business Profile connection; someone who has only been invited to a review portal is not studio staff.
- **CORS.** The function emits no CORS headers. The hosting gateway adds `access-control-allow-origin: *` to every function response; that is platform behaviour, not an invitation for browser use, and every route still requires a workspace token.
- **OpenAPI source.** The studio's own copy of `openapi.yaml` is not in this repository, so ours was written from the brief at `docs/ced-handoff/openapi.yaml`; diff it against the studio's copy. The only structural difference is the documented server base described above.
- **Superseded deployments.** The host does not apply a second deployment to an existing function name, so these names still exist: `ced-api` and `ced-entitlements` (both reject every request), `workspace-entitlements` (always fails its CRM query), `social-studio-entitlements` (a working duplicate kept for comparison), and `entitlements-staging` (the staging twin that surfaces failure detail; not for the studio). `studio-entitlements` is the supported endpoint.
- **One-off setup functions.** `studio-seed-once` created the two sandbox accounts; `sandbox-status-once` toggles one sandbox client's status. Both are guarded by one-off secrets that have been deleted, which makes them inert. Remove them from the platform when convenient.

## Verification performed

| Check | Result |
| --- | --- |
| Growth snapshot, all fields present | Pass — `examples/growth.json` |
| Starter snapshot, `socialStudio: false`, `maxChannels: 0` | Pass — `examples/starter.json` |
| Member removal reflected in the next snapshot | Pass — member list and ETag both changed |
| Suspended account still `200` with `suspended` | Pass — `examples/starter-suspended.json` |
| Repeat request with previous ETag | Pass — `304`, zero-byte body, `ETag` and `Cache-Control` present |
| No token / token for another workspace / unknown workspace | Pass — `401`, `403`, `404` with the error envelope and a logged `requestId` |
| Incomplete snapshot | Pass — `503 snapshot_unavailable`, never a partial body |
| Rate limit | Pass — `429` with `Retry-After` after 30 requests in the hour |
| Idempotent, stable fingerprint | Pass — two requests identical apart from `syncedAt`, same `etag` |
| No payment data in the payload | Pass — only the agreed fields are emitted |
| Plan change within 60 s | Not exercised live (no plan-write path was available); the status change proved the same live-read path |
| Response under 500 ms p95 at 50 staff | Not met / not measured — see Latency above |
