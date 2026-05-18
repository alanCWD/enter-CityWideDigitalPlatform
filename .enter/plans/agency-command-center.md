# Content Calendar Module — Implementation Plan

## Context
The Content Calendar is the core scheduling module of the Agency Command Center SaaS. It allows the agency (CityWide Digital) and eventually its clients to compose, schedule, and track social media posts across all connected platforms via Zernio. The existing `calendar.tsx` is a stub. The `posts` table exists in the DB but needs to be upgraded to support multi-platform cross-posting, statuses, and scheduling. The `social-rpc` edge function will be extended to handle post publishing via Zernio.

---

## Decisions
- **Views:** Month + Week
- **Cross-posting:** Yes — one compose window, multiple platform targets
- **Statuses:** `draft`, `scheduled`, `published`
- **History:** New posts only (no Zernio history sync)

---

## 1. Database Migration

Migrate `posts` table to support the calendar properly:

```sql
-- Drop old simple posts table and create a richer one
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_id text NOT NULL DEFAULT 'citywide';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS agency_id text NOT NULL DEFAULT 'citywide';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS published_at text;

-- Update status default/constraint
-- (status already exists as text with default 'draft')
-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_for_now" ON posts FOR ALL USING (true) WITH CHECK (true);
```

---

## 2. New Files to Create

### `src/pages/dashboard/social/calendar.tsx` (full rewrite)
- Month and Week view toggle
- Fetches posts from `posts` table filtered by `client_id = 'citywide'`
- Each day cell shows colored chips per post status
- Click on a day → opens `PostComposerDialog`
- Click on an existing post chip → opens `PostComposerDialog` in edit mode
- Status color coding: `draft` = muted, `scheduled` = primary/blue, `published` = green

### `src/components/social/PostComposerDialog.tsx` (new component)
- Dialog/sheet containing the full compose interface
- Fields:
  - **Title** (short label for calendar display)
  - **Content** (textarea, 2200 char limit)
  - **Platform selector** — multi-select checkboxes showing only connected platforms (fetched from `social_accounts` where `client_id = 'citywide'`)
  - **Schedule date + time** picker
  - **Status** (auto: saving = draft, scheduling = scheduled)
- Actions: **Save as Draft** | **Schedule Post** | **Publish Now**
- On Schedule/Publish: calls `social-rpc` with `action: "social.post"`

### `src/components/social/CalendarMonthView.tsx` (sub-component)
- Renders a grid of days for the current month
- Shows post chips with truncated title + status color

### `src/components/social/CalendarWeekView.tsx` (sub-component)
- Renders 7 columns (Mon–Sun) for the current week
- Shows posts in hourly time slots

---

## 3. Edge Function Update: `social-rpc`

Extend the `social.post` action to:
1. Accept `{ title, content, platforms[], scheduled_at, client_id, post_id? }`
2. If `scheduled_at` is in the future → save to DB with `status: 'scheduled'`, do NOT yet call Zernio
3. If publishing now → call Zernio `POST /api/v1/posts` for each platform, then save with `status: 'published'`
4. Return `{ ok: true, post_id }`

---

## 4. Files Modified

| File | Change |
|------|--------|
| `src/pages/dashboard/social/calendar.tsx` | Full rewrite — functional calendar with month/week views |
| `supabase/functions/social-rpc/index.ts` | Extend `social.post` action |
| `src/components/social/PostComposerDialog.tsx` | New — compose/edit dialog |
| `src/components/social/CalendarMonthView.tsx` | New — month grid sub-component |
| `src/components/social/CalendarWeekView.tsx` | New — week timeline sub-component |

---

## 5. Verification
1. Navigate to `/dashboard/social/calendar`
2. Month view loads with current month grid
3. Switch to Week view — shows current week
4. Click a day → PostComposerDialog opens
5. Select connected platform(s), write content, pick a schedule time → click Schedule
6. Post chip appears on the calendar on the scheduled date with "Scheduled" color
7. Open chip → edit dialog opens with existing data pre-filled
8. DB row visible in `posts` table with correct `platforms[]`, `scheduled_at`, and `status`
