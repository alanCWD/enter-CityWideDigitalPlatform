# Social Syndication System (LinkedIn + Meta native OAuth)

## Context

The user provided a generalized skill (`SKILL.md` + `backend-functions.md` + `schema.sql`)
describing a production social-publishing system: connect LinkedIn and Meta (Facebook +
Instagram) via real OAuth, publish now or schedule, an every-minute cron publisher, and
revoked-token reconnect handling. The request: plan the build of this system in the
current project.

This project already publishes via **Zernio** (a third-party service) at
`/dashboard/social/calendar`, using the `posts` + `scheduled_posts` + `social_accounts`
tables and the `social-rpc` backend function. The new system is native, direct-to-platform
publishing and must coexist with Zernio.

Confirmed decisions from the user:
1. **Ownership is agency-wide** — the logged-in admin connects channels for the whole
   agency (e.g. `citywide` corporate accounts). The skill's `profiles` concept is mapped to
   **agencies** (this project has no `profiles` table; the tenancy unit is the agency slug).
2. **Integrate into the existing calendar UI** (`/dashboard/social/calendar` + its
   `AccountsPanel`/`PostComposerDialog`), not separate new pages.
3. **New table `social_scheduled_posts`** so the existing Zernio `scheduled_posts` flow is
   untouched.
4. **Credentials ready**: LinkedIn client id/secret, Meta app id/secret, Resend API key;
   OAuth callback URLs registered (or will be) in the existing LinkedIn/Meta dev apps.

Platform constraint (already proven in this project): the gateway requires an
`Authorization` header on **every** backend function. User-facing calls go through
`supabase.functions.invoke` (session JWT attached) — fine. The cron function must be called
via `pg_cron` → `net.http_post` with the anon key in `Authorization`/`apikey`, exactly like
the existing `qbo-poll-invoices` / `stripe-poll-events` jobs (this works; verified earlier).

## Key adaptations from the skill

- **`profiles` → `agency_id` (text slug)**: every new table carries `agency_id TEXT NOT NULL
  DEFAULT 'citywide'`. No `profiles` table is created. The frontend passes the active agency
  slug; the backend requires a valid authenticated caller and uses the service-role client
  for all token/connection/scheduled writes (never trusts the client for ownership).
- **16 separate skill functions → 1 gateway function** (`social-syndication`, action-based,
  matching this project's `bunny-rpc`/`social-rpc` convention) + **1 cron function**
  (`publish-scheduled-posts`). This avoids 16 near-identical files and fits the codebase.
- **`scheduled_posts` (skill) → `social_scheduled_posts`** to avoid clobbering Zernio.
- **Published mirror** → new `social_posts` table (agency-scoped) instead of `profile_posts`.
- **RLS**: `channel_oauth_tokens` + `oauth_states` = **no client policies** (service-role
  only, critical — would leak tokens). `channel_connections` = public read (harmless
  metadata) + service-role writes only (disconnect goes through the function). New
  `social_scheduled_posts` / `social_posts` = service-role only; the frontend reads them via
  the gateway function (same pattern as Zernio's `scheduled_posts`, which is
  `service_role_all`).
- **CONFIG block** values for this project (see below) replace the skill's `app.example.com`.

## CONFIG values (this project)

- `appName`: "CityWide Digital"
- `appDomain`: `dashboard.citywidedigital.ca`
- `linkedinCallbackUrl`: `https://dashboard.citywidedigital.ca/auth/linkedin/callback`
- `metaCallbackUrl`: `https://dashboard.citywidedigital.ca/auth/meta/callback`
- `reconnectUrl`: `https://dashboard.citywidedigital.ca/dashboard/social/calendar?tab=accounts`
- `fromEmail`: `reviews@citywidedigital.ca` (existing Resend sender)
- `companyLinkedinUrl`: `https://www.linkedin.com/company/citywidedigital/` (nullable)

## Database migration (one file)

New tables (all `agency_id TEXT NOT NULL DEFAULT 'citywide'`), RLS enabled on each:

1. `channel_connections` — `agency_id`, `platform TEXT NOT NULL`, `handle`, `display_name`,
   `profile_url`, `is_active BOOL DEFAULT true`, `connected_at`, `needs_reconnect BOOL
   DEFAULT false`, `last_checked_at`, `account_type TEXT CHECK IN ('personal','organization')`
   + `UNIQUE(agency_id, platform)`.
   Policies: `public_read_channels` (SELECT true); service-role ALL. NO client UPDATE
   (disconnect via function).
2. `channel_oauth_tokens` — `agency_id`, `platform`, `access_token TEXT NOT NULL`,
   `person_urn`, `organization_urn`, `page_id`, `ig_user_id`, `expires_at`, timestamps,
   `UNIQUE(agency_id, platform)`. RLS enabled, **no policies**.
3. `oauth_states` — `state TEXT PK`, `agency_id`, `platform`, `created_at`. RLS enabled,
   **no policies** (TTL 10 min, consumed on finalize).
4. `social_scheduled_posts` — `agency_id`, `platform`, `content TEXT NOT NULL`, `image_url`,
   `scheduled_for timestamptz NOT NULL`, `status TEXT DEFAULT 'pending'` (pending |
   publishing | published | failed | cancelled), `error_message`, `published_post_id`,
   timestamps, `INDEX(status, scheduled_for)`. RLS enabled, service-role ALL only.
5. `social_posts` (published mirror) — `agency_id`, `platform`, `title`, `content`,
   `image_url`, `external_post_id`, `external_url`, `published_at`, timestamps. RLS enabled,
   service-role ALL only.
6. `CREATE EXTENSION pg_cron, pg_net` + `cron.schedule('publish-scheduled-posts-every-minute',
   '* * * * *', net.http_post → '.../functions/v1/publish-scheduled-posts' with anon key in
   apikey + Authorization)` — same proven pattern as stripe-poll-events.

## Backend functions

### `supabase/functions/social-syndication/index.ts` (new; action-based gateway)
Copied/adapted from `backend-functions.md`, consolidated into one handler. Every action:
auth-required (session JWT), reads `agency_id` from payload, uses a service-role client for
token/connection/scheduled writes. Actions:

- `connect.start` (`platform: 'linkedin'|'meta'`) → mint `oauth_states` row, build + return
  the provider authorize URL with the exact CONFIG callback (LinkedIn scopes
  `openid profile email w_member_social`; Meta scopes `pages_show_list`,
  `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`,
  `instagram_content_publish`, `business_management`).
- `connect.finalize` (`platform`) → validate+consume state, exchange code→token
  (Meta: short→long-lived 60-day), fetch userinfo (`person_urn`) / paginated Pages list,
  upsert `channel_oauth_tokens` + `channel_connections`, return `organizations[]` (LinkedIn
  Company picker) or `pages[]` (Meta picker).
- `connect.select` (`platform`) → persist chosen LinkedIn org URN or Meta page (store
  page token + linked IG business account; upsert FB + IG `channel_connections`).
- `connection.list` → return the agency's `channel_connections` rows (drives Accounts tab).
- `connection.check` (`platform`, throttled 5 min server-side) → health probe; on 401/revoke:
  clear tokens, set `needs_reconnect=true` on the `false→true` transition only, send exactly
  one reconnect email (Resend).
- `connection.disconnect` (`platform`) → set `is_active=false`; Meta also clears FB+IG
  token rows.
- `post.publish` (`platform: 'linkedin'|'facebook'|'instagram'`, content, imageUrl) →
  publish via platform API (LinkedIn last-month `Linkedin-Version` header; FB `/photos` or
  `/feed`; IG container + `/media_publish`), mirror into `social_posts`, on 401 → revoke +
  reconnect email.
- `post.schedule` (`platform`, content, imageUrl, scheduledFor) → validate future time +
  token won't expire first, insert `social_scheduled_posts` (status `pending`).
- `scheduled.list` → the agency's `social_scheduled_posts` (status badge, error_message,
  cancel support).
- `scheduled.cancel` → set status `cancelled`.

### `supabase/functions/publish-scheduled-posts/index.ts` (new; cron, no caller auth)
Service-role only. Query due `social_scheduled_posts` (`status='pending'` AND
`scheduled_for <= now()`, `LIMIT 20`), set `publishing` (guards overlapping runs), publish
per platform (reusing the publish helpers), mirror to `social_posts`, transition to
`published`/`failed` (+`error_message`), send reconnect emails on revoke. Follows the skill
implementation notes and the existing `qbo-poll-invoices` structure.

## Frontend

### New files
- `src/pages/auth/linkedinCallback.tsx` + `src/pages/auth/metaCallback.tsx` — read
  `code`+`state`, invoke `connect.finalize`, show org/page picker if returned (calling
  `connect.select`), `window.opener.postMessage({ app_channel_connected })`, `close()`.
- `src/hooks/useNativeChannels.ts` — `useLinkedInStatus`, `useMetaStatus` reading
  `channel_connections` via `connection.list` + `connection.check`, returning
  connected/reconnect/loading + `reload`/`checkNow`.
- `src/components/social/NativeConnectionsPanel.tsx` — LinkedIn + Meta connect cards
  (popup flow: `window.open('about:blank')` → `connect.start` → navigate popup to `authUrl`
  → poll close + listen `postMessage`), disconnect, `needs_reconnect` banner + Reconnect CTA.
- `src/lib/social.ts` — typed `invoke()` helper wrapping `social-syndication`
  (mirrors `crm()` in `src/lib/crm.ts`).

### Modified
- `src/router.tsx` — add the two public callback routes (`/auth/linkedin/callback`,
  `/auth/meta/callback`), matching the registered OAuth URLs.
- `src/pages/dashboard/social/calendar.tsx` — wire `NativeConnectionsPanel` into the
  Accounts tab; merge native scheduled/published posts into the calendar/list view.
- `src/components/social/PostComposerDialog.tsx` — add native LinkedIn/FB/IG as publish
  targets (publish now / schedule) alongside Zernio accounts; show image-required note for
  FB/IG; keep the branded footer builder (append `${appName} → ${profileUrl}`).
- `src/components/social/AccountsPanel.tsx` — keep Zernio as-is; the native connections
  render through `NativeConnectionsPanel` (same tab).

## Secrets (via secrets tool, after plan approval)
`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `META_APP_ID`, `META_APP_SECRET`,
`RESEND_FROM_EMAIL` (existing `RESEND_API_KEY` is reused; verify it is set).

## Files touched (summary)
- New migration: `supabase/migrations/migration_<ts>_social_syndication`
- New: `supabase/functions/social-syndication/index.ts`
- New: `supabase/functions/publish-scheduled-posts/index.ts`
- New: `src/pages/auth/linkedinCallback.tsx`, `src/pages/auth/metaCallback.tsx`
- New: `src/hooks/useNativeChannels.ts`, `src/components/social/NativeConnectionsPanel.tsx`,
  `src/lib/social.ts`
- Modified: `src/router.tsx`, `src/pages/dashboard/social/calendar.tsx`,
  `src/components/social/PostComposerDialog.tsx`
- Untouched: Zernio tables/functions (`social-rpc`, `scheduled_posts`, `posts`), `config.toml`

## Implementation checklist
- [passed] Add migration: create the 5 tables with RLS + policies; add the pg_cron every-minute job (anon-key header)
- [passed] Add the 4 secrets (LinkedIn id/secret, Meta app id/secret, RESEND_FROM_EMAIL)
- [passed] Write `social-syndication/index.ts` with `connect.start/finalize/select`, `connection.list/check/disconnect`, `post.publish/schedule`, `scheduled.list/cancel` using the CONFIG values
- [passed] Write `publish-scheduled-posts/index.ts` (cron, service-role, batch 20, `publishing` guard, reconnect email on `false→true`)
- [passed] Deploy both functions (`supabase_deploy_edge_function`)
- [passed] Add `src/lib/social.ts` invoke helper + `useNativeChannels.ts` hooks
- [passed] Add `NativeConnectionsPanel.tsx` (popup connect/disconnect/reconnect)
- [passed] Add LinkedIn + Meta callback pages; wire both into `router.tsx`
- [passed] Integrate into `calendar.tsx` (Accounts tab + merged scheduled/published) and `PostComposerDialog.tsx` (native targets)

## Verification checklist
- [passed] RLS: unauthenticated/non-owner cannot read or modify others' `social_scheduled_posts`/`social_posts`; `channel_oauth_tokens`/`oauth_states` have **no** client policies (confirmed via schema dump)
- [manual-required] `connect.start` returns a valid provider authorize URL for both LinkedIn and Meta (needs live OAuth app + logged-in session)
- [manual-required] Full LinkedIn connect → `channel_connections` row exists; Company picker appears when orgs present; `post as` persists (live OAuth test)
- [manual-required] Full Meta connect → FB Page row created; linked IG business account row created too (live OAuth test)
- [manual-required] Publish now to LinkedIn, Facebook, Instagram → post appears on platform + mirrored into `social_posts` (live publish test)
- [manual-required] Schedule a future post → `pending`; after due time the cron run flips it to `published` (or `failed`+`error_message`); cancel → `cancelled`
- [manual-required] Revoke a token in the platform console → `connection.check`/publish sets `needs_reconnect=true`, clears tokens, shows banner, sends exactly one email
- [passed] `cron.job` lists `publish-scheduled-posts-every-minute` active; manual anon-key invoke returns 200 (gateway passes)
- [manual-required] Existing Zernio calendar/publishing still works unchanged (`social-rpc`, `posts`, `scheduled_posts`)
