# Diagnose & surface the GBP "403" connection error

## Context
"Connect with Google" / "Link Profile" for Google Business Profile (GBP) goes through:
`gbp-auth-url` (builds Google OAuth URL) → Google consent screen → `/gbp/callback` (`GbpCallback.tsx`) → `gbp-auth-callback` (exchanges code, calls Google My Business APIs, saves to `gbp_connections`) → later refreshed by `gbp-sync`.

A 403 in this flow can come from three very different places, and today the code only clearly distinguishes one of them:
1. **Google's OAuth consent screen itself** (before any of our code runs) — typically means the app is unverified for the restricted `business.manage` scope and the signing-in Google account isn't added as a Test User, or the OAuth client's redirect URI isn't registered.
2. **Google's My Business APIs** returning `403 PERMISSION_DENIED` — typically means the required APIs aren't enabled in the Google Cloud project, or the project hasn't been granted Business Profile API access (a manual Google approval, separate from just enabling the API).
3. A **bug/gap in our own error handling** masking the real cause.

Looking at the code, gap #3 is real: in `gbp-auth-callback/index.ts`, only the `v1/accounts` fallback branch (line 112-120) inspects `error.code === 403` and shows a helpful message. Every other Google call — `v4/accounts`, `v4/.../locations`, `v4/.../reviews`, `v4/.../localPosts` — never checks the HTTP status; a 403 there is logged to console but silently treated as "0 results", so the user gets a generic message instead of the real Google error. `gbp-sync/index.ts` is worse: none of its three fetches (`mybusinessbusinessinformation`, `mybusinessreviews`, `mybusiness` posts) check `res.ok` at all — a 403 response body just gets parsed as if it were data, silently overwriting NAP fields with empty/undefined values with no error shown.

Because we can't see the user's exact error text or which step it happens at, the fastest path is to close this gap first so the next attempt surfaces Google's *real* error message, then use that to point at the exact Google Cloud Console fix.

## Implementation checklist
- [ ] In `supabase/functions/gbp-auth-callback/index.ts`, after the `v4/accounts` call, if `v4AcctBody.error` is present with `code === 403`, return the same descriptive `ok({ success:false, error: ... })` treatment used for the v1 fallback (don't silently fall through to v1 when it's a real permission error).
- [ ] Extend `apiFetch` (or wrap each call site) so every Google call in this file — locations (`fetchLocationsV4`, wildcard fallbacks), reviews, posts — checks for a `403`/`error` body and, if found, returns immediately with `ok({ success:false, error: "<Google's error.status>: <error.message>" })` instead of treating it as empty data.
- [ ] In `supabase/functions/gbp-sync/index.ts`, check `res.ok`/`status` for all three fetches (business info, reviews, posts) and the token refresh call; on non-2xx, return `json({ success:false, error: "<endpoint> failed (<status>): <google error message>" })` instead of writing the response body into `gbp_connections` unconditionally.
- [ ] Keep the existing 429 (quota) and "0 locations" messages as-is — only add the missing 403/error-body checks around them.
- [ ] No frontend changes needed: `GbpCallback.tsx` and `LinkZernioProfileDialog.tsx`/`GBPIntegration.tsx`/`PortalConnect.tsx` already display `data.error` / `error.message` verbatim in their error banners.

## What to check once the real error text is visible
Use the newly-surfaced message to pick the fix:
- **"App is not verified" / "Error 403: access_denied" on Google's own screen (before reaching our callback)** → the OAuth consent screen is in "Testing" mode and the signing-in account isn't listed as a Test User, or the app needs Google verification because `business.manage` is a restricted scope. Fix: add the account as a Test User in Google Cloud Console → OAuth consent screen, or complete verification for production use.
- **`redirect_uri_mismatch`** → the exact URL `\<origin\>/gbp/callback` (for every origin the app is used on — preview URL and any custom domain) must be added under Google Cloud Console → Credentials → the OAuth 2.0 Client → Authorized redirect URIs.
- **`PERMISSION_DENIED` / 403 from `mybusinessaccountmanagement.googleapis.com`, `mybusinessbusinessinformation.googleapis.com`, or `mybusinessreviews.googleapis.com`** → those APIs must be individually enabled in Google Cloud Console → APIs & Services → Library, AND the Google Cloud project needs Business Profile API access granted by Google (this is a manual access request, separate from enabling the API — see Google's "Business Profile APIs" access request form). Without that grant, enabling the API alone still returns 403.
- **Google account has 0 GBP locations** → sign in with the Google account that actually owns/manages the listing (already handled with a clear message today).

## Verification checklist
- [ ] Trigger "Connect with Google" from the CRM client dialog and from the client portal (`PortalConnect.tsx`) and confirm the flow either succeeds or now shows a specific Google error message (endpoint + status + Google's own message) instead of a bare "403".
- [ ] Confirm a expired/invalid-scope token on an existing connection surfaces a clear error from `gbp-sync` instead of silently blanking out NAP fields.
- [ ] Confirm the happy path (valid Google account with a verified GBP listing) still connects and syncs reviews/posts exactly as before — no regression to the success path.
- [ ] Share the exact new error text with the user so the correct Google Cloud Console fix (test user / redirect URI / API access grant) can be applied.
