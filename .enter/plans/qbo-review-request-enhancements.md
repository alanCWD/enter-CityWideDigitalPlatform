# QuickBooks Review Request Enhancements

## Context

`qbo-poll-invoices` (added last turn) runs once daily, checks each connected
QuickBooks company for recently-paid invoices, and immediately emails a
"leave us a review" request. Four gaps need fixing before this is safe to run
unattended long-term:

1. No configurable delay — a request fires the same day an invoice is paid,
   for every client, with no way to tune it per company.
2. No per-customer dedup — the current check is per-invoice
   (`qbo_invoice_id`), so a repeat customer who pays a second invoice gets a
   second review request forever.
3. Only one hardcoded review platform (Google, via `review_link`) — no
   Facebook, BBB, or Yelp support.
4. No branding — the email is fixed HTML with generic copy and no client
   logo, and the client's brand assets (square/rectangle logo, light/dark
   variants, tagline) don't exist anywhere in the schema yet.

## Approach

### 1. Delay in days (per QuickBooks connection)

- Add `review_delay_days integer NOT NULL DEFAULT 7` to `quickbooks_connections`.
- In `qbo-poll-invoices`, QuickBooks doesn't give us a clean "date this invoice
  became fully paid" field directly, so we approximate it with
  `invoice.MetaData.LastUpdatedTime` (the query already filters/returns this
  from the Intuit API) — timestamped the moment `Balance` last changed to 0.
- Only send if `now - lastUpdatedTime >= review_delay_days`. Invoices not yet
  old enough are simply left alone — they'll be picked up on a later day's
  poll once the delay has elapsed (the existing 2-day lookback overlap is
  widened to look back `review_delay_days + 2` days so nothing is missed).
- UI: add a numeric input ("Send review request X days after invoice is
  paid", 1–60, default 7) next to Sender Name / Google Review Link in
  `QuickBooksPanel.tsx`, saved via the existing `saveSettings` handler.

### 2. One review request per customer, ever

- Add a unique index on `review_requests (crm_client_id, customer_email)`
  where email is lower-cased for comparison — one client's customer gets at
  most one row ever, regardless of how many invoices they pay.
- Before sending in `qbo-poll-invoices`, change the existing
  `qbo_invoice_id`-based lookup to check by `(crm_client_id, lower(customer_email))`
  instead. If a row already exists for that customer, skip (still counts as
  `skipped`), regardless of which invoice triggered it.
- Keep `qbo_invoice_id` as a normal column (drop its old standalone UNIQUE
  constraint) so we can still see which invoice triggered the one email sent.

### 3. Configurable review platforms (Google, Facebook, BBB, Yelp)

- Replace the single `review_link` text field with a small structured set.
  Add to `quickbooks_connections`:
  `review_platforms jsonb NOT NULL DEFAULT '[]'`
  Each entry: `{ "platform": "google" | "facebook" | "bbb" | "yelp", "url": string, "enabled": boolean }`.
- Keep the existing `review_link` column as-is for backward compatibility (no
  destructive migration) but stop writing to it going forward; the panel and
  email template read from `review_platforms` when present, falling back to
  `review_link` as a single "google" entry if `review_platforms` is empty
  (so existing connections don't lose their current link on upgrade).
- UI in `QuickBooksPanel.tsx`: replace the single "Google Review Link" field
  with 4 fixed rows (Google, Facebook, BBB, Yelp), each with an on/off toggle
  and a URL input. Use existing lucide icons: `Globe` (Google, no brand icon
  available in lucide-react), `Facebook`, `Building2` (BBB placeholder),
  `Star` (Yelp placeholder) — all generic placeholders per the request.
- Email template (both `qbo-poll-invoices/index.ts` and the preview builder
  in `QuickBooksPanel.tsx`) renders one button per *enabled* platform with a
  non-empty URL, stacked vertically, each using its platform's icon/color.

### 4. Branding: per-client logo asset set + editable email text

- New table `client_brand_assets` (one row per `crm_client_id`):
  `logo_square_url text, logo_rect_url text, logo_square_dark_url text,
  logo_rect_dark_url text, tagline text, updated_at timestamptz`.
- Reuse the existing private `vault` storage bucket and the established
  `vault.files.uploadUrl` / signed-URL pattern from `bunny-rpc` (see
  `case "vault.files.uploadUrl"` in `supabase/functions/bunny-rpc/index.ts`)
  for the actual upload mechanics, but store the 4 resulting URLs directly on
  `client_brand_assets` (as public URLs via a new public `brand-assets`
  bucket, mirroring the existing `post-media` public-bucket pattern) rather
  than as generic vault file rows — this lets the email template embed them
  directly as `<img src>` without needing a signed-URL round trip at send
  time.
- New RPC actions in `bunny-rpc/index.ts`: `brand.get`, `brand.uploadUrl`,
  `brand.save` (mirrors the vault.files.* pattern, scoped to the
  `brand-assets` public bucket instead of the private `vault` bucket).
- Add `email_subject text`, `email_intro text` to `quickbooks_connections`
  (per-connection override; NULL falls back to the existing hardcoded
  defaults). UI: two more fields in the Settings grid — Subject line, Intro
  paragraph (textarea) — editable, with the thank-you/footer text staying
  fixed as before.
- Email template changes (`qbo-poll-invoices/index.ts` +
  `buildReviewEmailHtml` in `QuickBooksPanel.tsx`, kept in sync):
  header now shows the client's rectangle logo (light variant) if set, above
  the (editable) subject-derived heading and (editable) intro paragraph;
  falls back to today's plain text header when no logo is uploaded.

## Files to change

- `supabase/migrations/<new>` — schema changes:
  `quickbooks_connections.review_delay_days`,
  `quickbooks_connections.review_platforms`,
  `quickbooks_connections.email_subject`, `quickbooks_connections.email_intro`,
  new `client_brand_assets` table + RLS, new public `brand-assets` storage
  bucket + policies (mirroring `migration_20260518_201254000` /
  `_201300000`), unique index on `review_requests(crm_client_id, lower(customer_email))`,
  drop old unique constraint on `review_requests.qbo_invoice_id`.
- `supabase/functions/qbo-poll-invoices/index.ts` — delay check using
  `MetaData.LastUpdatedTime`, per-customer dedup query, multi-platform button
  rendering, logo/subject/intro substitution in the email HTML.
- `src/hooks/useQuickbooks.ts` — extend `QboConnection` type with the new
  fields; add `useClientBrandAssets(clientId)` hook (mirrors
  `useQboConnection`).
- `src/lib/vault.ts` or new `src/lib/brand.ts` — thin wrappers for
  `brand.get` / `brand.uploadUrl` / `brand.save`, following the exact
  `requestUploadUrl` / `uploadToSignedUrl` / `confirmUpload` pattern already
  used for vault files.
- `src/components/crm/quickbooks/QuickBooksPanel.tsx` — delay-days input,
  4-platform settings block replacing the single review-link field, subject
  + intro textarea fields, logo previews wired to the new brand-assets
  uploader, `buildReviewEmailHtml` updated to match the backend template
  exactly (logo, subject, intro, multi-platform buttons).
- New small component `src/components/crm/quickbooks/BrandAssetsUploader.tsx`
  — 4 upload slots (square/rect × light/dark) + tagline field, reusing the
  drag/drop + progress pattern from `FilesSection.tsx`.

## Implementation checklist

- [ ] `quickbooks_connections` gets `review_delay_days` (default 7),
      `review_platforms` (jsonb, default `[]`), `email_subject`,
      `email_intro` columns.
- [ ] New `client_brand_assets` table with RLS scoped like
      `quickbooks_connections` (`authenticated` can select/update own
      agency's rows).
- [ ] New public `brand-assets` storage bucket + public-read /
      insert / delete policies, mirroring `post-media`.
- [ ] `review_requests` dedup key changes from `qbo_invoice_id` UNIQUE to
      a unique index on `(crm_client_id, lower(customer_email))`;
      `qbo_invoice_id` keeps its column but loses its own UNIQUE constraint.
- [ ] `qbo-poll-invoices`: invoices younger than `review_delay_days` (based
      on `MetaData.LastUpdatedTime`) are left for a later run, not skipped
      permanently.
- [ ] `qbo-poll-invoices`: lookback window widens to
      `review_delay_days + 2` days instead of the fixed 2-day buffer.
- [ ] `qbo-poll-invoices`: pre-send check queries
      `(crm_client_id, lower(customer_email))` instead of `qbo_invoice_id`
      for dedup.
- [ ] `qbo-poll-invoices`: email renders one button per enabled
      `review_platforms` entry with a non-empty URL; falls back to a single
      Google button from legacy `review_link` when `review_platforms` is
      empty.
- [ ] `qbo-poll-invoices`: email header uses `client_brand_assets` logo
      (rect, light) when present; subject/intro use
      `email_subject`/`email_intro` when set, else current defaults.
- [ ] `bunny-rpc`: new `brand.get` / `brand.uploadUrl` / `brand.save`
      actions following the existing `vault.files.*` pattern.
- [ ] `useQuickbooks.ts`: `QboConnection` type includes new fields; new
      `useClientBrandAssets` hook added.
- [ ] `QuickBooksPanel.tsx`: delay-days input wired to `saveSettings`.
- [ ] `QuickBooksPanel.tsx`: 4 fixed platform rows (Google/Facebook/BBB/Yelp)
      with toggle + URL, replacing the single review-link field.
- [ ] `QuickBooksPanel.tsx`: subject + intro textarea fields wired to
      `saveSettings`.
- [ ] New `BrandAssetsUploader.tsx` with 4 logo slots + tagline, wired to
      `brand.uploadUrl`/`brand.save`.
- [ ] `buildReviewEmailHtml` (frontend preview) updated to match the backend
      template's logo/subject/intro/multi-platform rendering exactly.

## Verification checklist

- [ ] Existing connection with only legacy `review_link` set still shows a
      working Google button in the preview and in a live-sent email
      (fallback path).
- [ ] Setting `review_delay_days = 3` and manually invoking
      `qbo-poll-invoices` does not email a customer whose invoice was paid
      today (0 days elapsed).
- [ ] Same setup, but simulate an invoice paid 4+ days ago — email is sent.
- [ ] A customer who already has a `review_requests` row (from any prior
      invoice) is skipped even when a brand-new invoice for them is now
      paid.
- [ ] Two different customers with different emails on the same paid-invoice
      batch both receive their own email (dedup is per-customer, not
      per-connection).
- [ ] Enabling Facebook + BBB with URLs, leaving Google/Yelp off, produces
      an email with exactly 2 buttons in the correct order.
- [ ] Uploading a rectangle-light logo shows it in both the in-app preview
      and the actual sent email.
- [ ] Editing Subject/Intro and saving changes the actual email sent on the
      next poll run.
- [ ] `pnpm run build` and lint pass with no new errors.
