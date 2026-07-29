# Fix: QuickBooks tab — logo upload & tagline save not working

## Context
On `/dashboard/crm/clients` → client detail → QuickBooks tab, the brand assets
uploader (`BrandAssetsUploader.tsx`) lets a user upload logo images and save a
tagline. Both actions call the `bunny-rpc` backend function via
`src/lib/brand.ts` (`brand.uploadUrl`, `brand.save`, `brand.get`).

**Root cause found during investigation:** the `brand.get` / `brand.uploadUrl`
/ `brand.save` cases already exist in the source file
`supabase/functions/bunny-rpc/index.ts` (added in commit `fa749282`), and the
supporting infrastructure is already correctly in place:
- `client_brand_assets` table exists with RLS enabled and working policies.
- `brand-assets` storage bucket exists, public, with insert/select/update/delete
  policies scoped to that bucket.

However, the **deployed** backend function is stale — it does not actually
contain these cases yet. Calling `brand.uploadUrl` against the live function
returns `{"error":"unknown action: brand.uploadUrl"}}` even though the source
file on disk has the handler. This happened because the function code was
edited in a prior commit but never redeployed afterward. Since the frontend
(`BrandAssetsUploader.tsx`, `src/lib/brand.ts`) is calling actions that don't
exist on the live function, every upload and every tagline save fails
immediately with "unknown action: ...".

No frontend or table/policy changes are needed — this is purely a stale
deployment issue.

## Fix
Redeploy `supabase/functions/bunny-rpc/index.ts` as-is (no code changes) using
the backend function deploy tool, so the live function matches the source file
that already contains `brand.get`, `brand.uploadUrl`, and `brand.save`.

## Implementation checklist
- [passed] Redeploy `bunny-rpc` backend function using the current, unmodified
      contents of `supabase/functions/bunny-rpc/index.ts`.
- [passed] Confirm no other backend functions reference brand assets and are
      similarly stale (checked: only `bunny-rpc` owns these actions;
      `qbo-poll-invoices` only reads `logo_rect_url` for outbound emails and
      is unaffected).

## Verification checklist
- [manual-required] Open a client's QuickBooks tab and upload a logo image to each of the
      4 slots (rect light/dark, square light/dark) — each upload succeeds and
      the preview image renders immediately.
- [manual-required] Type a tagline and click "Save Tagline" — save succeeds with no error
      shown, and the value persists after a page reload.
- [manual-required] Remove a previously uploaded logo (trash icon) — removal succeeds and
      the slot reverts to the empty placeholder.
- [manual-required] Confirm `brand.get` still correctly returns `null` assets for a client
      that has never had brand assets set (no false errors on first load).
- [manual-required] Confirm cross-agency access is still blocked (`assertClientAccess`
      still throws for a client belonging to another agency) — no regression
      from the redeploy.
