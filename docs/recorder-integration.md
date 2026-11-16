# Customer Content Studio integration

The dashboard is the source of truth for company assets, branding, locations and
campaign setup. The Customer Content Studio recorder is the source of truth for
recordings, submissions, approvals and publishing.

Two flows connect them:

- **Push** — CWD sends one HTTPS POST per company-location pair when a company,
  location or campaign changes, plus a nightly reconciliation.
- **Pull** — the recorder reads the same data from a read-only token endpoint on
  its own schedule.

CWD never deletes recorder data and never imports recorder submissions.

## Where it lives

- Dashboard → CRM → **Content Studio**: companies, brand kit, locations,
  campaigns and per-location customer links / QR codes.
- Dashboard → CRM → Content Studio → **Connection & pull token**: configuration
  status, pull endpoint, pull tokens, backfill and recent pushes.
- CRM → client → **Content Studio** tab: that client's sync summary.

## Server secrets

Set these as backend secrets. Never put them in browser code, public config,
logs or screenshots.

| Name | Purpose |
| --- | --- |
| `RECORDER_INTAKE_URL` | The intake address shown in the recorder's Admin → CityWide page. Must be a full `https://` address. |
| `RECORDER_INTAKE_KEY` | The inbound connection key created there. Sent only in the `x-cwd-key` header. |
| `RECORDER_STUDIO_URL` | Public HTTPS base URL of the studio, for example the recorder domain. Used only to build the SSO link. |
| `RECORDER_SSO_SECRET` | Shared HS256 signing secret for studio SSO. Server-side only; never sent to the browser. |

The intake key is **not** the pull token. They are separate credentials with
separate purposes.

The scheduler secret used by the nightly job lives in the database
(`recorder_internal`), is readable only by the service role, and is not a
customer-facing credential.

## Open Content Studio (SSO)

The **Open Content Studio** action on a CWD company opens the recorder's admin in
a new tab without a second password. It is available for CWD-managed client
companies; influencer/network owners continue to use the studio's `/signin`.

1. The backend verifies the signed-in user is CWD staff and belongs to the same
   workspace as the company. For a client-linked company it also checks the CRM
   client's agency. Super-admins can open any company.
2. It requires at least one successful push for that company, because the studio
   returns 404 for a company it has never received.
3. It signs a 60-second HS256 JWT with `RECORDER_SSO_SECRET`:
   `iss: citywide-dashboard`, `aud: content-studio`, the user id/email/name,
   `company_id` (the stable recorder company id), `role: owner`, `iat`, `exp`
   and a fresh random `jti`.
4. The browser opens `${RECORDER_STUDIO_URL}/sso#token=<jwt>` in a new tab. The
   secret never reaches the browser, and every click produces a new jti and
   token. The studio consumes each token once; reusing one returns 409.

The studio then lands the user in `/admin` scoped to that company. If the action
is disabled, confirm both SSO secrets are configured on the Connection page and
that the company has been pushed.

## Pull token

Generate the token in **Content Studio → Connection & pull token → New token**.
The plaintext is shown once; only a SHA-256 hash and a short prefix are stored.
Paste it into the recorder's **Admin → CityWide → Pull settings**.

The pull endpoint is the address shown on that page:

```
GET <pull endpoint>
Authorization: Bearer <pull token>
```

It returns `{"companies":[...]}` with the same shape and stable ids as push, one
entry per active company-location pair, in a single response. A missing, wrong
or revoked token returns `401` with `{"error":"..."}`. Requests are limited to 60
per minute per token.

The token is read-only and can be rotated without changing the intake key.
Rotation revokes every existing pull token immediately.

## Backfill

1. Confirm both server secrets are configured (the Connection page shows
   `Configured` for the address and key).
2. Open **Connection & pull token** and choose **Backfill active companies**.
3. CWD creates a Content Studio profile and one location for each active CRM
   client, then queues one push per location. Existing profiles keep their
   settings; ids never change, so a repeat never duplicates a recorder company.
4. Open a company to check its returned customer link and QR. Failed pushes show
   the recorder's error on that company and in the recent push log.

A nightly job reconciles every active company at 08:00 UTC (midnight Pacific).
The queue worker runs every minute, retrying temporary recorder failures with
backoff (1 minute, 5 minutes, 20 minutes, 1 hour; four attempts per job).

## Intake URL or key wrong

- The Connection page shows **Not a valid HTTPS address** when
  `RECORDER_INTAKE_URL` is missing its scheme. Re-enter the exact intake address
  from the recorder.
- A `401` from the recorder means the intake key is wrong or was rotated. Replace
  `RECORDER_INTAKE_KEY`.
- A `400` means CWD sent a field the recorder rejected. The error is shown on the
  company; correct the CWD record and push again. A partial push never clears a
  field that was omitted.

## Image requirements

`logo_url` and `watermark_url` must be public HTTPS images that allow
cross-origin reads, because the recorder draws them into a video canvas.
Uploads go to the public `brand-assets` storage bucket, which returns
`access-control-allow-origin: *`. Test with:

```js
const img = new Image();
img.crossOrigin = "anonymous";
img.onload = () => console.log("CORS image OK", img.naturalWidth);
img.onerror = () => console.log("CORS image FAILED");
img.src = "<logo or watermark URL>";
```

## Contract mapping

- Company id is the CRM client id for a client-linked company, or a fixed
  generated `net_…` id for a standalone network. It never changes.
- A single business has one location; a network has one location per restaurant.
- Only active records are sent. Archived locations/campaigns stop syncing but
  recorder data is untouched.
- Campaigns always have exactly three scenes. Promo campaigns always enable
  video and require a dish name and concept; a promo using animated stills sets
  `enable_photos: false`.
- Optional fields are omitted, not sent empty, when CWD has no value.
- Network brand-kit fields are omitted for ordinary single businesses.
- Every request is checked for the 400 KB intake limit before it is sent.

## Rotation

- **Pull token:** create a new one, paste it into the recorder, then revoke the
  old one (or use **Rotate**, which revokes all and issues a new token). The
  intake key is unaffected.
- **Intake key:** rotate it in the recorder's Admin → CityWide page, then update
  the `RECORDER_INTAKE_KEY` secret. Pushes retry on the next queue pass or
  nightly reconciliation.

## Tests

```bash
node --experimental-strip-types --test tests/recorder/*.test.ts
```

The suite covers first push, repeat push without duplicates, partial update
preserving omitted fields, the Victoria Food Scene promo mapping, two locations
under one network, missing/invalid intake key, a company with no campaign, a
missing company id/name, retries on temporary failures, the 400 KB limit, and
pull-token parsing/hashing (missing and malformed Authorization headers).

## Verification results — 15 November 2026

Automated suite: **21 of 21 passing** (`pnpm run test:recorder`), including the SSO header, payload, signature, expiry and fresh-jti checks.

Live checks against the recorder at the intake address supplied by the operator:

| Check | Result |
| --- | --- |
| Push a restaurant (Pho Breeze, under the Victoria Food Scene network) | `200`, one campaign accepted, slug `pho-breeze-aa6253` |
| Push a second restaurant under the same network id | `200`, same recorder company id, second location created |
| Repeat push with a changed headline | `200`, same recorder company id and location id, same slug, new headline in CWD and pull |
| Push a VFS promo (`format: promo`, dish, three scenes, scene 3 photos) | `200`; pull shows `enable_video: true`, `enable_photos: false`, captures `video / video / photos` |
| Push a single business with no campaign (The Foam Zone) | `200`, `campaigns: 0`, brand-asset logo sent |
| Wrong intake key | `401 "That connection key is not valid."` from the recorder, no retry |
| Missing intake key/address | clear validation failure before any request |
| Missing pull token | `401 {"error":"Missing or invalid pull token."}` |
| Wrong pull token | `401` |
| Revoked pull token | `401` |
| Pull with a valid token | `200` with the same stable ids, two VFS locations and the single business |
| Backend → recorder intake | reachable; live pushes returned `200` |
| Public logo CORS | logo returned `200`, `content-type: image/png`, `access-control-allow-origin: *` |
| Customer page returned by push | `200` |
| SSO secrets configured | studio URL valid and SSO secret present (reported without exposing values) |
| SSO action without a user session | `401`; scheduler credential cannot run it (`403`) |

Not verified from this environment:

- The recorder's own **Admin → CityWide → Test connection** and **Sync now**. The pull endpoint is public and answers correctly with a token, but the recorder-side screens must be exercised by the operator with a token created in the dashboard.
- The SSO click-through and the studio's `/admin` scoping could not be exercised without a signed-in dashboard session. The token shape, signature and 60-second expiry are covered by automated tests; the operator should click the action once against the real studio.
- Visual rendering of the customer page (name, logo, colour, three scenes) in a browser, and the recorder's watermark drawing. The returned page is a client-rendered app; its HTML loaded with `200` but the visual content was not inspected.
- A distinct QR image: the recorder deployment used for testing returned the customer page URL in `links.qr` (the same value as `links.url`) and a `qr-…` campaign code. CWD stores and surfaces whatever the recorder returns, so the UI opens that address.
- The live test hit the recorder deployment whose intake address was supplied (it resolves to a live-preview recorder host, not the production `review-engine` domain). Links stored from these pushes point at that deployment until the production address is configured and the records are re-pushed.

Test records created with real CWD clients: the standalone Victoria Food Scene network with Pho Breeze and Storied Wines & Spirits as locations, and a single-business profile for The Foam Zone. The operator can edit or archive them in Content Studio; archiving stops CWD pushes but does not delete anything in the recorder.
