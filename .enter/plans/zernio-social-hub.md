# Plan: Zernio Social Hub at /dashboard/social/calendar

## Summary

Transform `/dashboard/social/calendar` into a unified, two-tab **Social Hub**:
- **Calendar tab** — the existing month/week/list scheduler, wired to live Zernio post data
- **Accounts tab** — connect/disconnect social accounts for the active agency's Zernio profile (replaces the separate `/profiles` page)

---

## Current State Audit

| File | Status | Issue |
|------|--------|-------|
| `pages/social/calendar.tsx` | Exists | Posts from Supabase `posts` table, hard-coded `client_id: "citywide"`, no agency scoping |
| `pages/social/profiles.tsx` | Exists | Separate page, hard-coded, requires GBP-first restriction that blocks other platforms |
| `components/social/PostComposerDialog.tsx` | Exists | Uses `social_accounts` table (our DB), doesn't pass Zernio account IDs on publish → posts fail silently |
| `components/social/CalendarMonthView.tsx` | Exists | Fine, keep |
| `components/social/CalendarWeekView.tsx` | Exists | Fine, keep |
| `components/social/PostListView.tsx` | Exists | Fine, keep |
| `supabase/functions/social-rpc/index.ts` | Exists | Missing: live accounts list from Zernio, live post list from Zernio, proper post-create with accountIds, disconnect |

---

## Zernio API Key Facts

**Base:** `https://zernio.com/api/v1`  
**Auth:** `Authorization: Bearer {ZERNIO_API_KEY}`

| Action | Endpoint | Notes |
|--------|----------|-------|
| List profiles | `GET /v1/profiles` | Each "profile" = brand container |
| Create profile | `POST /v1/profiles` | `{ name, description }` |
| List accounts | `GET /v1/accounts?profileId=` | Returns `_id`, `platform`, `username`, `displayName`, `isActive` |
| Start OAuth | `GET /v1/connect/{platform}?profileId=&redirectUri=` | Returns `{ authUrl }` |
| Disconnect | `DELETE /v1/accounts/{id}` | |
| Create post | `POST /v1/posts` | `{ title, content, platforms: [{platform, accountId}], scheduledFor?, publishNow? }` |
| List posts | `GET /v1/posts?profileId=` | |

---

## Architecture Changes

### 1. Edge Function: `social-rpc` — 5 new actions

**`zernio.accounts.list`**  
→ `GET /v1/accounts?profileId={id}` from Zernio  
→ Returns live account status, no DB lookup needed

**`zernio.posts.list`**  
→ `GET /v1/posts?profileId={id}` from Zernio  
→ Maps to CalPost shape; also upserts into Supabase `posts` table for persistence

**`zernio.posts.create`**  
→ Accepts `{ profileId, content, title, accounts: [{platform, accountId}], scheduledFor?, publishNow? }`  
→ `POST /v1/posts` with correct structure  
→ Saves result to Supabase `posts` table

**`zernio.disconnect`**  
→ `DELETE /v1/accounts/{accountId}` on Zernio  
→ Also removes row from Supabase `social_accounts` if present

**`social.connect` fix**  
→ Remove the "GBP must be first" requirement — it was a temporary restriction that blocks all other platforms

---

### 2. New: `src/hooks/useZernioProfile.ts`
```ts
// Returns the Zernio profileId for the active agency.
// Calls zernio.profiles, finds/creates profile named after the agency slug.
// Memoized per agency slug.
export function useZernioProfile(agencySlug: string): { profileId: string | null; loading: boolean }
```

### 3. New: `src/hooks/useZernioAccounts.ts`
```ts
// Calls social-rpc zernio.accounts.list for the active agency's profile.
// Returns live connected accounts grouped by platform.
export function useZernioAccounts(profileId: string | null)
  : { accounts: ZernioAccount[]; loading: boolean; reload: () => void }
```

### 4. New: `src/components/social/AccountsPanel.tsx`
The new Accounts tab content:
- **Platform grid**: 15 platform tiles (Google Business, Instagram, LinkedIn, X, Facebook, YouTube, TikTok, Pinterest, Threads, Reddit, Bluesky, Telegram, Snapchat, WhatsApp, Discord)  
- Each tile shows: platform icon, name, connected accounts (username + status badge), Connect / Reconnect button
- **Connect flow**: calls `social.connect` → redirects to Zernio OAuth → returns to `?tab=accounts&connected={platform}` → auto-reload
- **Disconnect**: calls `zernio.disconnect` with account `_id`
- **OAuth return handler**: reads `?connected=` param on mount, shows toast, strips param from URL

### 5. Updated: `src/components/social/PostComposerDialog.tsx`
**Key fix**: Instead of fetching platforms from `social_accounts` table, fetch from `useZernioAccounts`. When posting, send the actual Zernio `accountId` values.

Changed fields:
- Platform selector → shows connected accounts with username; each is a toggleable chip
- On "Publish Now" → calls `zernio.posts.create` with `publishNow: true`
- On "Schedule" → calls `zernio.posts.create` with `scheduledFor: ISO string`
- On "Save Draft" → saves to Supabase `posts` only (no Zernio call)

### 6. Updated: `src/pages/dashboard/social/calendar.tsx`
Restructured layout:

```
ContentCalendar
├── TopBar: "Social" / subtitle: "{agency.name} · {N} accounts connected"
├── Tab bar: [Calendar] [Accounts]
│
├── if tab === "calendar":
│   ├── Toolbar (nav + view toggle + New Post button)
│   └── CalendarMonthView | CalendarWeekView | PostListView
│       (posts fetched from Zernio live via zernio.posts.list)
│
└── if tab === "accounts":
    └── AccountsPanel (connect/disconnect flow)
```

---

## Files to Create
1. `src/hooks/useZernioProfile.ts` — profile ID resolver
2. `src/hooks/useZernioAccounts.ts` — live account list
3. `src/components/social/AccountsPanel.tsx` — connection management UI

## Files to Modify
4. `supabase/functions/social-rpc/index.ts` — 5 new/fixed actions
5. `src/pages/dashboard/social/calendar.tsx` — tab layout + live posts
6. `src/components/social/PostComposerDialog.tsx` — use real Zernio account IDs

## Files NOT changing
- `CalendarMonthView.tsx` — works fine
- `CalendarWeekView.tsx` — works fine
- `PostListView.tsx` — works fine
- `profiles.tsx` — kept for now (its sidebar nav link stays); longer term it becomes a redirect

---

## Platform List (15 total)
```
google_business, instagram, linkedin, twitter, facebook, youtube,
tiktok, pinterest, threads, reddit, bluesky, telegram, snapchat,
whatsapp, discord
```

---

## OAuth Return URL Strategy
After connecting, Zernio redirects to:
```
/dashboard/social/calendar?tab=accounts&platform=instagram&connected=true
```
The `AccountsPanel` reads these params on mount, shows a success toast, reloads the accounts list, then strips the params from the URL.

---

## Agency Scoping
- Each agency gets its own Zernio profile: `"Profile for {agencySlug}"`
- `useZernioProfile(agencySlug)` finds/creates this profile via the edge function
- All post/account calls use this profile's `_id`
- Switching agencies in the sidebar instantly changes which Zernio profile is active

---

## DB Changes (none needed)
- The `social_accounts` table remains for caching, but the source of truth is Zernio
- The `posts` table remains for local persistence alongside Zernio
- No new migrations required
