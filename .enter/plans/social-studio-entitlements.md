# Social Studio entitlements endpoint

Build the one read-only, server-to-server endpoint the CityWide Social Studio polls for a workspace's account, plan, entitlements and staff. CED stays the source of truth; the studio can never write anything back.

## The workspace and its account

`ws_citywide` is mapped to a CED client record named **CityWide Digital**, with the billing email set and a **Growth** subscription on the existing $397/month plan. That record is the account, so:

- Plan, price, billing period, cancel-at-period-end and subscription status are read live from that record — not copied.
- A plan change made anywhere in CED (client page, plan catalogue, or a Stripe subscription event) is visible on the very next poll. Nothing is cached.
- The sandbox subscription is created inside CED without a Stripe link, so it must be kept current by staff or by connecting Stripe later. It will show as "not linked to Stripe" in CED exactly like any manually created subscription.

Two clearly named sandbox accounts are created: **CityWide Digital** (Growth) for the main workspace, and a separate Starter workspace to prove the Starter behaviour. Both appear in the client list and can be edited or removed by staff afterwards.

## What the studio receives

One `200` response per request containing the complete snapshot — all fields on every response, no deltas:

- **account** — name, status (`active` / `suspended` / `closed`), billing email, timezone and currency, read from the client record.
- **subscription** — plan id (`starter` / `growth` / `pro`), the plan's original name, status, pre-tax price, GST as a fraction, period end (or `null` where there is no committed period), and the cancel flag.
- **entitlements** — whether the studio is included at all, the channel ceiling, white-label and the monthly AI drafting cap.
- **members** — the complete list of people who can act on the workspace, each with a stable id that survives name and email changes, a mapped role (`owner` / `approver` / `viewer`), status (`active` / `invited` / `disabled`) and last-changed time.
- **schemaVersion, syncedAt, etag** — contract version, snapshot build time, and a content fingerprint.

If any required part cannot be produced, the response is an error, never a partial or placeholder snapshot.

## Members and roles

CED has no approver/viewer concept, so members come from who can actually act on that client today, with roles mapped from CED's existing roles: super admins and the client's own owner become owners; agency staff and client admins become approvers; client users and everyone else with access become viewers. Invited-but-never-signed-in people are `invited`; blocked accounts are `disabled`. A person removed in CED disappears on the next poll.

Staff names come from the CED profile when set, otherwise from the email address. If a person who must be listed has no email at all, the snapshot is incomplete and the endpoint refuses rather than silently dropping them.

## Plan entitlements used

| Plan | Studio included | Channels | White-label | AI cap (USD/month) |
| --- | --- | --- | --- | --- |
| Starter | No | 0 | No | 0 |
| Growth | Yes | 4 | No | 40 |
| Pro | Yes | 4 | Yes | 120 |

Growth's 40 and Starter being excluded come from the brief. Starter's zero cap and Pro's 120 are a proposed default; Pro being the white-label tier follows the current pricing page. These values live in CED as editable per-plan settings, so they can be changed without a deploy.

## Access, privacy and safety

- One bearer token per workspace, hashed at rest, never in a URL, never logged, and never placed in this chat or the repository. A super admin issues it on the existing API Access screen, sees the plaintext once, and hands it over out of band.
- Tokens rotate by issuing a replacement while the old one stays valid for at least a day, so the studio never needs an emergency deploy.
- No browser access and no CORS. Only `GET` (and `HEAD`) are answered.
- The payload is exactly the agreed schema: no payment method data, card details, invoice files, addresses, phone numbers or notes.
- Every error carries a `requestId` that is also written server-side. Request logs hold the workspace, status, duration and id only — never the payload, and emails are redacted wherever they appear.

## Caching, limits and errors

- A content fingerprint is returned as `ETag`, and a repeat request with the previous one gets `304` with no body. The fingerprint ignores the snapshot timestamp so unchanged data really does return `304`.
- Responses are marked private and uncacheable so no proxy holds a workspace snapshot.
- Rate limit of 30 requests per hour per workspace — comfortably above the studio's four polls an hour — with `Retry-After` on `429`.
- One error envelope everywhere: `400` malformed request, `401` missing or invalid token, `403` token not allowed for that workspace, `404` unknown workspace, `429` rate limited, `503` when a complete snapshot cannot be built, `5xx` for unexpected failures. A suspended account still gets `200` with `suspended`, so the studio can explain why posting is blocked.

## Where this differs from the brief

- **URL prefix.** The sandbox host exposes the endpoint below a fixed function path, not at the apex `/api/v1`. It accepts `/api/v1/workspaces/{id}/entitlements` and `/v1/workspaces/{id}/entitlements` after that base, so a proxy on the studio's side can expose the exact agreed path. The OpenAPI document states the real sandbox base and this difference.
- **Timezone.** CED stores no timezone anywhere, so it is held once per workspace in CED and seeded to `America/Toronto`.
- **GST rate.** CED hardcodes 5% in checkout and never stores a rate, so the fraction is held in the same per-workspace settings and returned as `0.05`.
- **Plan mapping is strict.** Plans are recognised from their name. An unrecognised plan returns `503` rather than a "nearest guess", because a wrong plan would silently change what the studio allows.
- **The two-staff example.** The only real CED staff account is Alan, so the Growth example also includes one clearly labelled invited sandbox approver (never a login, marked as sandbox in the handoff). The live workspace lists real people only.
- **Latency at 50 staff.** The endpoint builds the snapshot in one pass, but the 50-staff p95 cannot be measured against a workspace that has one real member; measured latency and that limitation will be reported honestly rather than claimed.

## Deliverables

- [ ] The deployed read-only endpoint on the sandbox host, plus a workspace token issued through the CED screen and delivered out of band (shown once, never in chat or the repo).
- [ ] `docs/ced-handoff/openapi.yaml` — OpenAPI 3.1 for the endpoint, the error envelope, the two token-rotation states and the real sandbox base, with the path difference from the brief called out.
- [ ] `docs/ced-handoff/examples/growth.json` and `starter.json` — captured from real sandbox calls, the Growth one containing at least two members.
- [ ] A note in the same handoff folder explaining where each field comes from in CED, how a plan change reaches the studio, and what counts as breaking in a `schemaVersion` (removals, renames, type or enum changes, changed meanings, auth or caching changes) together with how a new major is introduced alongside the old field set.
- [ ] A CED screen, visible to super admins only, that lists registered workspaces and their tokens, issues and reveals a token once, revokes one, and shows the sandbox base URL.

## Outcomes

- [ ] `GET` returns `200` with every required field for the Growth workspace: account, subscription (plan `growth`, $397 CAD, GST `0.05`, period end, cancel flag), entitlements (`socialStudio` true, 4 channels, no white-label, $40 AI cap) and the member list.
- [ ] The Starter workspace returns `200` with `socialStudio: false` and `maxChannels: 0`, with no error and no missing field.
- [ ] Removing a member in CED removes them from the next snapshot, and changing the plan in CED is visible within 60 seconds.
- [ ] A repeat request with the previous fingerprint returns `304` with no body, and every response carries the private, uncacheable header.
- [ ] Missing token returns `401`, a token for another workspace returns `403`, an unknown workspace returns `404`, and each error carries the envelope with a `requestId` that appears in the server log.
- [ ] A suspended sandbox account still returns `200` with `suspended` (verified by temporarily suspending the Starter sandbox account and restoring it), and a workspace with no usable plan returns `503` rather than a partial snapshot.
- [ ] Rate limiting returns `429` with `Retry-After` once the per-workspace ceiling is exceeded.
- [ ] Two identical requests return the same snapshot apart from the timestamp, with no state changed by either.
- [ ] Nothing in any response contains payment data, card details, invoice links, addresses, phone numbers or notes, and no log line contains an email address or the payload.

## Assumptions to correct if wrong

- Starter's AI cap is 0 and Pro's is 120; both are editable in CED.
- A second sandbox workspace on the Starter plan may be created so the Starter behaviour is demonstrated against live data.
- The two sample accounts staying visible in the CRM client list is acceptable.
- One labelled invited sandbox approver is acceptable for the two-staff example.
