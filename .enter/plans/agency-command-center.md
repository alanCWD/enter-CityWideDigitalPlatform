# Client Dashboard: Social Sync Pro + Digital CRM

## Context
The existing `/portal/*` client portal needs three major upgrades:
1. **Sector-aware Overview** — widget layout adapts to GBP category (Restaurant / Retailer / Service Provider)
2. **Social Sync Pro** — replace the current iframe placeholder with a full native UI backed by Zernio; includes post composer, queue manager, and platform account management
3. **Digital CRM** — new portal tab for clients to view incoming leads/contacts and add follow-up notes

The `social-rpc` edge function already handles Zernio `connect`, `sync`, and `post` actions. The `ZERNIO_API_KEY` secret is configured. A `social_accounts` table already exists.

---

## Database Migrations (2 new tables)

### `scheduled_posts`
```sql
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  platforms JSONB NOT NULL DEFAULT '[]',
  scheduled_at TIMESTAMPTZ,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',     -- draft | queued | published | failed | cancelled
  platform_states JSONB NOT NULL DEFAULT '{}',
  zernio_post_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON scheduled_posts USING (true);
```

### `client_leads`
```sql
CREATE TABLE IF NOT EXISTS client_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'manual',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',    -- new | contacted | qualified | closed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON client_leads USING (true);
```

---

## Edge Function: `social-rpc` additions

Add these actions to `/workspace/thread/supabase/functions/social-rpc/index.ts`:

| Action | What it does |
|---|---|
| `posts.create` | Insert to `scheduled_posts`; if platforms include GBP post immediately via Zernio; schedule others with `delay_minutes` offset |
| `posts.list` | SELECT from `scheduled_posts` WHERE `client_id = ?` ORDER BY `created_at DESC` |
| `posts.cancel` | UPDATE `status = 'cancelled'` WHERE `id = ?` |
| `accounts.list` | SELECT from `social_accounts` WHERE `client_id = ?` |
| `accounts.disconnect` | DELETE from `social_accounts` WHERE `id = ?` AND `client_id = ?` |

**GBP-first workflow in `posts.create`:**
1. Post to GBP via Zernio immediately
2. For each other platform: compute `scheduled_at + delay_minutes` and pass that timestamp to Zernio's `scheduled_at` field in `POST /api/v1/posts`
3. Store `zernio_post_id` + per-platform state in `platform_states` JSONB

---

## New Components

### `src/components/portal/PostComposer.tsx`
- Textarea for post content (280 char counter for Twitter)
- Platform toggle row: **GBP** (always first, locked on), then Facebook / Twitter / LinkedIn toggles
- "Schedule" vs "Post Now" toggle → date-time picker when scheduling
- Per-platform delay sliders (0–60 min) shown in expanded "Advanced" section
- Submit button calls `social-rpc` `posts.create`

### `src/components/portal/QueueManager.tsx`
- Table/card list of `scheduled_posts` for this client
- Columns: content preview, platforms (badge row), scheduled time, status chip per platform
- Cancel button on queued items
- Auto-refreshes every 30s

### `src/components/portal/ConnectedAccounts.tsx`
- Grid of platform cards (GBP, Facebook, Twitter, LinkedIn)
- Each shows: connected / not connected, connect button (triggers `social.connect`)
- Disconnect button on connected platforms

### `src/components/portal/SectorOverview.tsx`
- Receives `sector: 'restaurant' | 'retail' | 'service' | 'generic'`
- **Restaurant**: review score, covers estimate, top dishes CTA, reservation link
- **Retail**: star rating, inventory sync CTA, promo post CTA
- **Service**: star rating, booking link, response rate, review reply CTA
- **Generic**: existing 4-card layout (rating, reviews, last sync, category)

---

## Modified Files

### `src/pages/portal/Overview.tsx`
- Import `SectorOverview`
- Add `getSector(category: string | null)` util: maps GBP category string → `'restaurant' | 'retail' | 'service' | 'generic'`
- Replace hardcoded cards grid with `<SectorOverview sector={getSector(connection.category)} connection={connection} />`
- Keep the quick-action links row below

### `src/pages/portal/PortalSocial.tsx`
- Remove `SocialSyncEmbed` import
- Add local tab state: `'compose' | 'queue' | 'accounts'`
- Render `<PostComposer>`, `<QueueManager>`, `<ConnectedAccounts>` based on active tab

### `src/components/portal/PortalTopBar.tsx`
- Add `{ name: "CRM", path: "crm", icon: Users, end: false }` to `TABS` array

### `src/router.tsx`
- Add `/portal/:clientId/crm` route → `PortalCrm` page

---

## New Pages

### `src/pages/portal/PortalCrm.tsx`
- Uses `PortalLayout` render-prop pattern (matches all other portal pages)
- Fetches `client_leads` via Supabase where `connection_id = connection.id`
- **Lead list view**: card per lead showing name, email/phone, source badge, status chip, date
- **Lead detail panel**: slide-in or expand showing full message + notes textarea
- Status dropdown: new → contacted → qualified → closed
- "Add Lead" button: small form modal (name, email, phone, source, message)
- All DB ops go directly via `supabase.from('client_leads')`

---

## Implementation Order
1. DB migrations (scheduled_posts + client_leads)
2. Update `social-rpc` edge function (posts.create, posts.list, posts.cancel, accounts.list, accounts.disconnect)
3. Build `SectorOverview.tsx` + update `Overview.tsx`
4. Build `ConnectedAccounts.tsx` + `PostComposer.tsx` + `QueueManager.tsx`
5. Rewrite `PortalSocial.tsx` with native tabs
6. Build `PortalCrm.tsx`
7. Update `PortalTopBar.tsx` (add CRM tab) + `router.tsx` (add CRM route)

---

## Verification
- Connect a GBP account → Overview shows sector-specific widgets
- Social tab: Compose → Post Now → appears in Queue with status
- Social tab: Accounts → Connect Facebook → OAuth redirect via Zernio
- CRM tab: Add lead → appears in list → change status → add notes
