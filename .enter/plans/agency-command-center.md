# Client Portal — CityWide Digital

## Context

Today CityWide is an **agency-facing** Command Center: every screen assumes the user is a CityWide employee managing many client businesses. We now need a **client-facing dashboard** so each business owner can log in, see only THEIR business, and use the embedded tools (Social Sync, GSO Coach, etc.) without being exposed to other clients' data or to the agency's internal tooling.

User decisions so far:
- Auth model: **email/password (Enter Cloud auth)**.
- Portal sections: **GBP data (read-only)**, **Social Sync (iframe)**, **Analytics scoped to client**, **Google Coach (GSO app integration)**.
- Layout: **new top-level `/portal/:clientId` route with its own dedicated layout (no agency sidebar)**.

## Approach

### Data model

Add two new tables and link clients to auth users:

1. **`portal_users`** — maps a Enter Cloud `auth.users` row to one or more `gbp_connections` rows (so a single business owner can have multiple locations under one login).
   - `user_id uuid REFERENCES auth.users` (PK component)
   - `connection_id uuid REFERENCES gbp_connections` (PK component)
   - `role text DEFAULT 'owner'`
   - `created_at timestamptz`
   - RLS: a user can `SELECT` only rows where `user_id = auth.uid()`.

2. **`portal_invites`** — agency creates an invite per client (email + connection_id). When the client signs up with that email, a Enter Cloud trigger creates the `portal_users` link automatically.
   - `id uuid PK`
   - `email text NOT NULL`
   - `connection_id uuid REFERENCES gbp_connections`
   - `accepted_at timestamptz`
   - `created_at timestamptz`
   - RLS: agency can manage; clients cannot read.

3. **Tighten existing RLS** on `gbp_connections`, `gbp_reviews`, `gbp_posts`:
   - Replace the current `Allow all for now` policies with policies that allow access if either:
     - the request is from the **agency** (use a `service_role` claim or a simple `is_agency()` security definer function checking against an allowlist of agency emails), OR
     - the request is from a **portal user** linked via `portal_users`.

### Auth

- Enable email/password sign-in in Enter Cloud (auto-confirm email = ON for testing).
- Create a `useAuth()` hook in `src/hooks/useAuth.ts` that wraps `supabase.auth`:
  - Sets up `onAuthStateChange` listener BEFORE checking session (per the Enter Cloud rules already documented).
  - Stores `{ user, session }` in state.
  - Exposes `signIn(email, password)`, `signUp(email, password)`, `signOut()`.
- Create login + signup pages: `src/pages/portal/Login.tsx`, `src/pages/portal/Signup.tsx`.
- Create `<RequirePortalAuth>` wrapper that redirects to `/portal/login` if no session.

### Routing

Add to `src/router.tsx`:
- `/portal/login` → `Login`
- `/portal/signup` → `Signup`
- `/portal` → redirects to first connection the user has access to (or "no business linked" message)
- `/portal/:clientId` → `ClientPortal` (wrapped in `<RequirePortalAuth>`); inside it validates that `clientId` is in the user's `portal_users` rows; otherwise redirects.

### Portal layout

`src/components/portal/PortalLayout.tsx` — clean, client-friendly layout (no agency sidebar):
- Top bar with: client business logo/name (from `gbp_connections.business_name`), tab navigation, account menu (sign out).
- Tabs: **Overview** | **GBP** | **Social** | **Coach** | **Analytics**.
- Light gradient background — same brand palette but lighter than the agency dashboard so it feels distinct.

### Portal pages (under `src/pages/portal/`)

1. **`Overview.tsx`** — At-a-glance card grid: review count, rating, posts count, last sync timestamp, next-best-action prompts.
2. **`PortalGBP.tsx`** — Read-only version of GBP data for THIS client only. Reuses the existing review / post / NAP rendering blocks extracted from `GBPIntegration.tsx`. No "Connect / Sync / Disconnect" buttons.
3. **`PortalSocial.tsx`** — Renders the existing `<SocialSyncEmbed clientId={clientId} clientName={...} />` full-bleed.
4. **`PortalCoach.tsx`** — Iframe embed of the GSO Coach app (placeholder URL constant, mirrors the SocialSyncEmbed pattern). Pass `?clientId=` so the coach app can scope content per client.
5. **`PortalAnalytics.tsx`** — Renders client-scoped analytics (reuses the existing chart components from `Analytics.tsx` filtered by `connection_id`). For now, simple KPI cards driven by `gbp_reviews` / `gbp_posts` aggregates if there are no real analytics events yet.

### Reusable extraction

Refactor the agency `GBPIntegration.tsx` review/post/NAP rendering into shared components in `src/components/portal/`:
- `ReviewsList.tsx`
- `PostsList.tsx`
- `NapDetails.tsx`

Both the agency expanded-card view AND the client portal will import these so we don't duplicate UI.

### Agency-side additions

In the existing `ConnectionCard` (agency view), add an **"Invite client"** action that:
- Opens a small dialog asking for the client's email.
- Inserts a row into `portal_invites` with `email + connection_id`.
- Copies the portal URL to clipboard: `<origin>/portal/signup?email=<email>` (signup form pre-fills email).
- After client signs up, a Postgres trigger on `auth.users` insert checks `portal_invites` by email and creates the matching `portal_users` row + marks invite accepted.

### Reused code / patterns

- `supabase` client from `src/integrations/supabase/client.ts`.
- Tab pattern from `GBPIntegration.tsx` `ConnectionCard`.
- `motion` / `AnimatePresence` styling already established.
- `cn()` from `src/lib/utils`.
- `SocialSyncEmbed` placeholder pattern → mirror it for the GSO Coach embed.

## Files to be created

- `src/pages/portal/Login.tsx`
- `src/pages/portal/Signup.tsx`
- `src/pages/portal/ClientPortal.tsx` (parent that loads connection + renders tab content)
- `src/pages/portal/Overview.tsx`
- `src/pages/portal/PortalGBP.tsx`
- `src/pages/portal/PortalSocial.tsx`
- `src/pages/portal/PortalCoach.tsx`
- `src/pages/portal/PortalAnalytics.tsx`
- `src/components/portal/PortalLayout.tsx`
- `src/components/portal/PortalTopBar.tsx`
- `src/components/portal/RequirePortalAuth.tsx`
- `src/components/portal/ReviewsList.tsx`
- `src/components/portal/PostsList.tsx`
- `src/components/portal/NapDetails.tsx`
- `src/components/portal/CoachEmbed.tsx` (mirrors `SocialSyncEmbed` pattern)
- `src/components/portal/InviteClientDialog.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/usePortalConnection.ts` (loads + validates the `clientId` against the signed-in user)

## Files to be modified

- `src/router.tsx` — add `/portal/*` routes.
- `src/pages/dashboard/GBPIntegration.tsx` — add "Invite client" button to `ConnectionCard`; refactor reviews/posts/NAP to use shared components.

## Database migration

```sql
-- 1. portal_users
create table portal_users (
  user_id uuid references auth.users(id) on delete cascade,
  connection_id uuid references gbp_connections(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (user_id, connection_id)
);
alter table portal_users enable row level security;
create policy "users see own links" on portal_users for select using (user_id = auth.uid());

-- 2. portal_invites
create table portal_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  connection_id uuid not null references gbp_connections(id) on delete cascade,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index portal_invites_email_idx on portal_invites (lower(email));
alter table portal_invites enable row level security;
-- (Agency-only access via service role; no client-side policies.)

-- 3. Auto-link user on signup
create or replace function link_portal_user_from_invite()
returns trigger language plpgsql security definer as $$
begin
  insert into portal_users (user_id, connection_id)
  select new.id, connection_id
  from portal_invites
  where lower(email) = lower(new.email) and accepted_at is null;
  update portal_invites
  set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure link_portal_user_from_invite();

-- 4. Tighten gbp_* RLS so portal users only see their own
drop policy if exists "Allow all for now" on gbp_connections;
drop policy if exists "Allow all for now" on gbp_reviews;
drop policy if exists "Allow all for now" on gbp_posts;

create policy "portal users see linked" on gbp_connections for select using (
  exists (select 1 from portal_users pu where pu.user_id = auth.uid() and pu.connection_id = id)
  or auth.role() = 'service_role'
);
create policy "agency manages all" on gbp_connections for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "portal users see linked reviews" on gbp_reviews for select using (
  exists (select 1 from portal_users pu where pu.user_id = auth.uid() and pu.connection_id = gbp_reviews.connection_id)
  or auth.role() = 'service_role'
);
create policy "agency manages reviews" on gbp_reviews for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "portal users see linked posts" on gbp_posts for select using (
  exists (select 1 from portal_users pu where pu.user_id = auth.uid() and pu.connection_id = gbp_posts.connection_id)
  or auth.role() = 'service_role'
);
create policy "agency manages posts" on gbp_posts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
```

> Note on RLS: the existing **agency dashboard** currently uses the publishable anon key from the browser. To preserve agency access to all clients without leaking data to portal users, the agency dashboard pages will be moved behind a simple "agency" allow-list (env-driven email check) — but that's a follow-up. For this MVP we'll keep agency-side reads working by also adding an "agency_emails" allowlist policy if needed during implementation.

## Verification

1. **Migration** runs cleanly; tables and policies appear in the schema.
2. As an agency admin (existing flow), open a connected client card → click **Invite client** → enter `test@client.com` → invite link copied.
3. Open the copied link in an incognito window → see signup form with email pre-filled → submit password → redirected to `/portal/<their-connection-id>`.
4. Portal shows ONLY that client's business name, GBP data, Social Sync iframe, Coach iframe, and analytics. Agency sidebar is NOT visible.
5. Trying to navigate to `/portal/<some-other-connection-id>` → redirected away with a "not authorized" message.
6. From the portal, click **Sign out** → returns to `/portal/login`.
7. Sign in again → lands on the same portal automatically.
8. The agency `/dashboard`, `/gbp`, etc. continue to work for the CityWide team and still see ALL clients.
