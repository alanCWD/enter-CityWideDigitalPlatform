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

The intake key is **not** the pull token. They are separate credentials with
separate purposes.

The scheduler secret used by the nightly job lives in the database
(`recorder_internal`), is readable only by the service role, and is not a
customer-facing credential.

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
node --experimental-strip-types --test tests/recorder/contract.test.ts
```

The suite covers first push, repeat push without duplicates, partial update
preserving omitted fields, the Victoria Food Scene promo mapping, two locations
under one network, missing/invalid intake key, a company with no campaign, a
missing company id/name, retries on temporary failures and the 400 KB limit.
