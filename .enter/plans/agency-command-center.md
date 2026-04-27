# GBP OAuth Integration — Full Build Plan

## Context
The `/gbp` page is currently fully static/mocked. We're building a real Google Business Profile
OAuth integration so agency staff can connect any client's GBP account, sync live data
(reviews, posts, hours, NAP), and display it in the dashboard.

---

## How the OAuth Flow Works

```
1. Staff clicks "Connect GBP" in the dashboard
2. Frontend calls edge fn → gets a Google OAuth URL
3. Browser opens Google consent screen (user signs in with the client's Google account)
4. Google redirects to: https://[supabase-project]/functions/v1/gbp-auth-callback?code=...
5. Edge fn exchanges code for tokens, fetches business info, saves everything to DB
6. Redirects back to /gbp — page now shows live business data
```

---

## Google Cloud Setup (User Must Do First — Instructions in Plan)

1. **Enable APIs** in Google Cloud Console:
   - "My Business Account Management API"
   - "My Business Business Information API"
   
   (Reviews, posts, and hours are served via the legacy v4 endpoint — no separate API needed)

2. **OAuth Consent Screen** (APIs & Services → OAuth consent screen):
   - User Type: External
   - App name: "CityWide Digital"
   - Scopes: `https://www.googleapis.com/auth/business.manage`
   - Add test users (your own Google account for testing)

3. **Create OAuth 2.0 Client ID** (APIs & Services → Credentials → + Create Credentials):
   - Application type: **Web application**
   - Authorized redirect URI: `https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/gbp-auth-callback`

4. **Store secrets** (two secrets to add):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

---

## Database

### Table: `gbp_connections`
```sql
id uuid PK
client_label text          -- "Acme Plumbing" (agency-assigned nickname)
google_account_id text     -- GBP account ID from API
location_id text           -- GBP location resource name
business_name text         -- synced from GBP
address text
phone text
website text
category text
rating numeric
review_count int
access_token text
refresh_token text
token_expires_at timestamptz
last_synced_at timestamptz
created_at timestamptz
```
Enable RLS + realtime.

### Table: `gbp_reviews`
```sql
id uuid PK
connection_id uuid FK → gbp_connections.id
review_id text
reviewer_name text
rating int
comment text
reply text
review_time timestamptz
```

### Table: `gbp_posts`
```sql
id uuid PK
connection_id uuid FK → gbp_connections.id
post_id text
summary text
topic_type text   -- STANDARD | OFFER | EVENT
media_url text
create_time timestamptz
```

---

## Edge Functions

### 1. `gbp-auth-url`
- Input: `{ clientLabel, redirectTo }`
- Builds Google OAuth URL with scope `business.manage`, encodes `state` (clientLabel + redirectTo)
- Returns: `{ url: "https://accounts.google.com/o/oauth2/auth?..." }`

### 2. `gbp-auth-callback`
- Receives: `?code=...&state=...` from Google redirect
- Exchanges code for `access_token` + `refresh_token`
- Calls GBP API to get accounts list → locations list → business details
- Saves to `gbp_connections` table
- HTTP 302 redirect → `/gbp?connected=true`

### 3. `gbp-sync`
- Input: `{ connectionId }`
- Checks if access token is expired → refreshes if needed
- Fetches: business info, recent reviews, recent posts
- Upserts into `gbp_reviews` and `gbp_posts` tables
- Updates `last_synced_at` on the connection record
- Returns: `{ success: true, reviewCount, postCount }`

---

## Frontend

### New: `src/pages/dashboard/GbpCallback.tsx`
- Route: `/gbp/callback` (handles the OAuth redirect from Google)
- Shows loading spinner while redirect happens, falls back to navigating to `/gbp`

### Rewrite: `src/pages/dashboard/GBPIntegration.tsx`
Two states:

**State A — No connections:**
- Empty state card with "Connect a Business Profile" button
- Calls `gbp-auth-url` → opens Google OAuth in same tab

**State B — Has connections (list):**
- Connection cards (one per client) showing: status badge, business name, address, rating
- "Sync Now" button calls `gbp-sync`
- "+ Connect Another" button
- Expandable detail panel per card:
  - Reviews tab (latest 5 reviews from `gbp_reviews`)
  - Posts tab (latest 5 posts from `gbp_posts`)
  - NAP tab (name, address, phone, hours from `gbp_connections`)

### Updated: `src/router.tsx`
Add `/gbp/callback` route.

---

## Files to Create/Modify
```
supabase/functions/gbp-auth-url/index.ts      NEW
supabase/functions/gbp-auth-callback/index.ts NEW
supabase/functions/gbp-sync/index.ts          NEW
src/pages/dashboard/GBPIntegration.tsx        REWRITE
src/pages/dashboard/GbpCallback.tsx           NEW
src/router.tsx                                ADD /gbp/callback route
```
Database migration: creates 3 tables with RLS.

---

## Secrets Needed (prompt user to add)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

## Verification
1. Add secrets → click "Connect GBP" → Google consent screen opens
2. After approval → redirected to `/gbp?connected=true`
3. Business info appears on the page
4. "Sync Now" fetches live reviews + posts
