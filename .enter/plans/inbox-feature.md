# Plan: Unified Inbox (+ Inbox Pro)

## Context
The dashboard has a stub `/dashboard/social/inbox` page. This plan replaces it with a fully-featured, WhatsApp-style unified inbox powered by the Zernio API, added as a **top-level sidebar item** for all agencies. Paid "Inbox Pro" features (Broadcasts, Sequences, Automations) are gated with a visual lock overlay + CTA; no real enforcement yet.

---

## What Changes

### 1. Routes (`src/router.tsx`)
- Add `/dashboard/inbox` → `<InboxPage />`

### 2. Sidebar nav (`src/lib/agencies.ts`)
- Add `{ name: "Inbox", path: "/dashboard/inbox", icon: Inbox }` to **all four** agency `navItems` arrays (citywide, legacy_leaf, foodiio, oneprofile).

### 3. New pages

| File | Purpose |
|---|---|
| `src/pages/dashboard/inbox/InboxPage.tsx` | Shell with Tabs: Conversations · Broadcasts (Pro) · Sequences (Pro) · Automations (Pro) |

### 4. New components (`src/components/inbox/`)

| File | Purpose |
|---|---|
| `PlatformBadge.tsx` | Small coloured icon for WhatsApp / Instagram / Messenger / Telegram / X / Reddit / Bluesky |
| `ConversationList.tsx` | Left pane — search input, platform filter chips, scrollable conversation rows, 10 s polling |
| `ConversationItem.tsx` | Single row: avatar, platform badge, sender name, snippet, unread dot, timestamp |
| `MessageThread.tsx` | Right pane — message history, compose box (text + send), 5 s polling |
| `MessageBubble.tsx` | Outgoing (right) vs incoming (left) bubble with read-receipt ticks |
| `ProGate.tsx` | Reusable semi-transparent lock overlay: "Inbox Pro" badge, feature description, "Upgrade" button → `/dashboard/crm/catalog` |
| `BroadcastsPanel.tsx` | List of broadcasts with create/send controls (rendered inside ProGate) |
| `SequencesPanel.tsx` | List of sequences + enroll CTA (rendered inside ProGate) |
| `AutomationsPanel.tsx` | List of comment-to-DM automations (rendered inside ProGate) |

### 5. New hooks (`src/hooks/`)

| File | What it does |
|---|---|
| `useInboxConversations.ts` | Polls `inbox.conversations.list` every 10 s; accepts `platform` filter + search query |
| `useInboxMessages.ts` | Polls `inbox.messages.list` every 5 s for the active conversation ID |

### 6. Edge Function additions (`supabase/functions/social-rpc/index.ts`)
Add new `case` blocks for the following actions (all proxy to Zernio API with `zernioKey`):

| Action | Zernio Endpoint |
|---|---|
| `inbox.conversations.list` | `GET /api/v1/inbox/conversations?profileId=&platform=&limit=50` |
| `inbox.messages.list` | `GET /api/v1/inbox/conversations/:id/messages` |
| `inbox.message.send` | `POST /api/v1/inbox/conversations/:id/send` (body: `{ message }`) |
| `inbox.conversation.markread` | `POST /api/v1/inbox/conversations/:id/read` |
| `inbox.broadcasts.list` | `GET /api/v1/broadcasts?profileId=` |
| `inbox.broadcasts.create` | `POST /api/v1/broadcasts` |
| `inbox.broadcasts.send` | `POST /api/v1/broadcasts/:id/send` |
| `inbox.sequences.list` | `GET /api/v1/sequences?profileId=` |
| `inbox.automations.list` | `GET /api/v1/automations?profileId=` |
| `inbox.automations.create` | `POST /api/v1/automations` |

All new cases follow the existing pattern: authenticate with `zernioKey`, forward, return `{ ok, data }`.

---

## UI Layout: InboxPage

```
┌──────────────────────────────────────────────────────────┐
│  TopBar: "Inbox"  subtitle: "All your DMs, one place."   │
├──────────────────────────────────────────────────────────┤
│ Tabs: [Conversations]  [Broadcasts ✦Pro]  [Sequences ✦Pro]  [Automations ✦Pro] │
├─────────────────┬────────────────────────────────────────┤
│  CONVERSATION   │  MESSAGE THREAD                         │
│  LIST           │                                         │
│  [Search...]    │  (select a conversation to start)       │
│  [All][WA][IG]  │                                         │
│  ─────────────  │                                         │
│  Conv row 1     │                                         │
│  Conv row 2     │                                         │
│  ...            │  [──── compose ─────────────] [Send]   │
└─────────────────┴────────────────────────────────────────┘
```

Pro tabs render the panel content behind `ProGate` (blur + lock + CTA button to `/dashboard/crm/catalog`).

---

## Design Tokens / Style Notes
- Use `ResizablePanelGroup` (already in `src/components/ui/resizable.tsx`) for the two-pane split
- Platform filter chips: small `Badge` variants coloured per platform
- Unread dot: `bg-primary` small circle
- Outgoing bubble: `bg-primary text-primary-foreground` rounded-br-sm
- Incoming bubble: `bg-muted` rounded-bl-sm
- ProGate: `backdrop-blur-sm bg-background/60` overlay, `Crown` icon (lucide), `Badge` with "Pro" label

---

## Files Modified
- `src/lib/agencies.ts` — add Inbox nav item to all 4 agencies
- `src/router.tsx` — add `/dashboard/inbox` route
- `supabase/functions/social-rpc/index.ts` — add 10 new `inbox.*` action cases

## Files Created
- `src/pages/dashboard/inbox/InboxPage.tsx`
- `src/components/inbox/PlatformBadge.tsx`
- `src/components/inbox/ConversationList.tsx`
- `src/components/inbox/ConversationItem.tsx`
- `src/components/inbox/MessageThread.tsx`
- `src/components/inbox/MessageBubble.tsx`
- `src/components/inbox/ProGate.tsx`
- `src/components/inbox/BroadcastsPanel.tsx`
- `src/components/inbox/SequencesPanel.tsx`
- `src/components/inbox/AutomationsPanel.tsx`
- `src/hooks/useInboxConversations.ts`
- `src/hooks/useInboxMessages.ts`

## Files NOT Changed
- `src/pages/dashboard/social/inbox.tsx` — kept as-is (router will redirect traffic to the new route)
- Any portal, CRM, GBP, or billing files

---

## Verification
1. "Inbox" appears in the sidebar for all 4 agencies
2. `/dashboard/inbox` loads the two-pane layout
3. Platform filter chips filter the conversation list
4. Clicking a conversation opens the message thread on the right
5. Sending a message calls `inbox.message.send` and optimistically appends to the thread
6. Broadcasts / Sequences / Automations tabs show the Pro gate overlay with a working "Upgrade" link
