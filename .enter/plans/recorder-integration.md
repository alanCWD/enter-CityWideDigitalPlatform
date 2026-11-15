# Customer Content Studio integration

Connect the CityWide dashboard to the Customer Content Studio recorder so that company profiles, locations, branding and campaigns flow from CWD into the recorder, and so the recorder can pull the same data on its own schedule.

CWD stays the source of truth for company assets, branding, locations and campaign setup. The recorder stays the source of truth for recordings, submissions, approvals and publishing. Nothing is ever deleted in the recorder, and no recorder submissions are imported into CWD.

## What staff will see

**Content Studio** becomes a real section of the dashboard, not just a server hook:

- A new **Content Studio** area under CRM lists every company that is sent to the recorder, with its location count, last sync result and a link to its customer page.
- Each company has an editor for its brand: trade, brand colour, public logo, and — for a network — the network logo, watermark image, watermark text, handle, credit line and default hashtags. A network can group several restaurant locations under one company id.
- Each company has a **Locations** list: name, address, neighbourhood, website, phone, its own logo and brand colour, optional headline, and the video/photos/wall switches. A single business gets one location created from its CRM record automatically.
- Each location has **Campaigns**: review or promo, label, headline, due date, dish name and concept for promos, enable switches, and exactly three scenes (label, prompt, hint, capture as video or photos). Ready-made templates cover a standard review and a Victoria Food Scene promo (Welcome / The concept / The dish with photos).
- Every sent location shows the returned **customer link, embed path, location slug and QR code**, so staff can open the customer page or download the QR without leaving CWD.
- A **Connection** panel shows whether the recorder address and intake key are configured (never their values), the read-only pull address to give the recorder, recent pushes with status and error messages, a **Push all active now** backfill button, and pull-token controls.
- The existing CRM client screen gains a **Content Studio** tab that summarises that client's recorder status and opens its editor.

Only active companies, locations and campaigns are sent. Archived or paused records are simply no longer pushed; the recorder is never asked to delete them.

## How the sync behaves

**Push.** Saves to a company, location, campaign or the client's branding queue a push automatically. One HTTPS request is sent per company-location pair, with the network company's branding repeated and a different location each time. Requests time out at 20 seconds, retry temporary failures with backoff, and record the recorder's response without storing any credential. A repeated push with the same stable ids updates the existing record instead of creating a duplicate, and fields CWD does not send are left untouched.

- Stable ids: the CRM client id for a client-linked company, a fixed generated id for a standalone network, and fixed ids for every location and campaign once created. Ids never change, including across rename, edit and resend.
- Only fields in the recorder's published contract are sent; no extra or invented fields.
- Optional network brand-kit fields are omitted for ordinary single businesses rather than sent blank.
- Promo campaigns always send `enable_video: true`; a promo using animated stills sends `enable_photos: false`. Promo dish name and concept are required before a campaign can be active.
- A campaign without a configured campaign is still pushed as a company-location with an empty campaign list.
- Every payload is checked before sending: company id and name, trade value, `#RRGGBB` colour, public HTTPS image addresses, exactly three valid scenes, and one request under 400 KB. A missing required value surfaces a clear error instead of a half-valid push.
- The nightly reconciliation re-pushes every active company and location. A manual backfill re-pushes existing ones on demand. Both reuse the same ids, so they never create a second recorder company.
- Temporary recorder failures are retried and then shown as failed on the company and in the connection log. A failed push never loses the CWD edit; the nightly run and the retry queue pick it up again.

**Pull.** CWD exposes a read-only HTTPS address (for example `GET .../companies`) that returns `{"companies":[...]}` using the same shape, mapper and stable ids as push. It returns all active companies with active locations and campaigns, one entry per company-location pair, in a single compact response. There is no pagination until the recorder team explicitly agrees to it. Authentication is `Authorization: Bearer <pull token>`; a missing, wrong or revoked token returns `401` with `{"error":"..."}`. Requests are rate limited, failures use the same error shape with a meaningful 4xx/5xx status, and nothing on this route can write, delete or read submissions. It is reachable without an interactive login, browser challenge or IP allowlist, and it tolerates both the function address and an `/api/recorder/...` prefix so the operator can point the recorder at either documented URL.

## Credentials and security

- The intake address and intake key are server-side secrets only. They are never in browser code, public config, logs or screenshots, and the dashboard never displays the intake key back.
- The operator enters the intake address and key through the secure secret prompt during setup. If either is missing, the Connection panel says so and pushes are held, not silently dropped.
- The pull token is generated server-side as a strong random value. Only its hash and a short prefix are stored; the plaintext is shown once, with copy, for the operator to paste into the recorder's **Admin → CityWide → Pull** settings. It can be rotated or revoked independently and never changes the intake key.
- The two credentials are kept separate in storage, code and UI; neither is ever used in place of the other.
- Content Studio data is readable and writable only by signed-in CWD staff. The pull route is token-only and read-only.
- No recorder data is ever deleted or written back into CWD.

## Images

Every logo and watermark address is a public HTTPS image that allows cross-origin loading, because the recorder draws them into a video canvas. Staff can upload location logos and a network watermark into the existing public brand-assets storage, or paste an approved HTTPS address; CWD validates the address and rejects non-HTTPS or private values. Uploaded images keep the public, cross-origin-readable headers the recorder needs. I will check the cross-origin header on a real uploaded image and report the result.

## Verification and limits

I will run an automated contract test suite against the same server-side code, using a mock recorder that behaves like the intake (stable-id updates, partial merge, generated links). It covers:

1. First push of a restaurant, with the returned customer link and QR.
2. Repeat push with a changed headline: updated content, same slug, no duplicate company.
3. Partial update: omitted fields remain set in the recorder.
4. Victoria Food Scene promo mapping: promo format, three scenes, third scene as photos, watermark and handle.
5. Two restaurants under one network company id with different locations.
6. Wrong or missing intake key returns 401.
7. Missing or invalid pull token returns 401.
8. A company with no campaign still pushes company and location.
9. Pull returns the same companies and ids as push.
10. Missing company id or name is rejected clearly.

After the real intake address and key are entered, I will run the live acceptance checks through the deployed backend: one restaurant push, repeat push with a changed headline, the VFS promo, two network restaurants, the connection test from the recorder side, and the pull endpoint with and without its token. I will report each result honestly, including anything the recorder's server or ours cannot reach. The recorder app itself is not modified.

Known limits to respect in this first delivery:

- Pull stays a single response with no pagination, as requested. If the active company set grows large enough to risk the recorder's 20-second limit, I will flag it rather than silently paginate.
- Optional `headline` and the network kit are only as complete as staff enter them; nothing is invented.
- QR download depends on the recorder returning a downloadable QR image; if it only returns an image URL, the UI opens it so staff can save it.
- The recorder remains responsible for what it does with a campaign; CWD only sends active setup data.

## Operator setup and runbook

A short operator document will ship with the integration covering:

- The two server secret names for the intake address and key, where to paste the values, and that they must never be put in code or shared in chat.
- Generating the pull token in the dashboard, pasting it into **Admin → CityWide → Pull**, and rotating it if it is exposed.
- Running the backfill for existing companies, what "active" means, and confirming links and QR codes for a sample restaurant.
- The nightly reconciliation schedule in Pacific business terms.
- What each failure message means and which ones resolve on the next nightly run versus needing a corrected CWD record.

## Assumptions

- A company linked to a CRM client uses that client's stable id; a standalone network (such as Victoria Food Scene) gets its own stable id, because it may not exist as a CRM client.
- Active means an active CRM client (or enabled standalone network) with at least one active location; active CRM clients are included by default and can be excluded from Content Studio.
- Trade is auto-suggested from the client's industry with a staff override, defaulting to `general`; brand colour defaults to the CityWide blue until staff set one.
- Company logos reuse the client's existing square brand asset unless a network logo is supplied.
- The recorder accepts a full endpoint address in its Admin → CityWide settings, and its server calls the pull address directly.
- The dashboard URL keeps working as today; this adds a new area and does not change existing CRM, billing, portal or marketing behaviour.

## Tasks

- [ ] Content Studio company editor exists for a CRM client and for a standalone network, with brand kit, trade, colour and public image validation.
- [ ] Locations can be created, edited and archived per company, with their own logo, colour, headline and video/photos/wall switches; a single business gets one location from its CRM record.
- [ ] Campaigns can be created per location with exactly three scenes and the review/promo rules enforced, including the VFS promo template.
- [ ] Saving anything sends a correctly mapped push automatically, and the UI shows the customer link, embed path, slug and QR.
- [ ] Repeating or changing a push updates the same recorder records and never creates duplicates; omitted fields are not cleared.
- [ ] Nightly reconciliation and manual backfill push every active company without duplicates, and a failed push is retried and visible.
- [ ] The pull endpoint returns the same active companies, locations and campaigns as push, with stable ids, in one response.
- [ ] Missing or wrong intake credentials and missing, wrong or revoked pull tokens are rejected with 401 and a readable error, and the token can be rotated without touching the intake key.
- [ ] Rate limiting and the `{"error":"..."}` error format apply to the pull and admin routes.
- [ ] Automated contract tests pass for the ten cases above, and live acceptance results against the real recorder are reported.
- [ ] An operator runbook documents the secret names, pull-token setup and rotation, backfill steps and nightly reconcile behaviour.
