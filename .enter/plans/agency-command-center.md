# Agency Command Center — Build Plan

## Context
The Agency Command Center is the internal operations hub for CityWide Digital agency staff and white-label partners. It was prototyped in Google AI Studio (Gemini-powered) and needs to be rebuilt/ported as a proper React dashboard within the existing CityWide Digital app.

Based on the original blueprint + GSO Coach app (which analyzes GMB profiles with AI), the Command Center combines:
- **Client management** — view all SMB clients, their subscriptions, GMB health
- **AI-powered analysis** — Gemini-based insights per client (GMB score, social engagement, listing accuracy)
- **GMB Health Monitor** — per-client Google Business Profile status
- **Social Sync Dashboard** — post calendar, platform connectivity
- **Listing Accuracy** — directory sync status across 40+ directories
- **AI Chat Assistant** — natural language queries about clients, generate reports, suggest actions

> NOTE: AI chat features require Enter Cloud (Supabase Edge Functions). The UI is planned fully; AI chat will be wired via Enter LLM skill once Enter Cloud is enabled. All other panels work with mock data.

---

## Route
`/dashboard` — added to existing router, linked from Navbar (visible to agency users)

The existing public site Layout/Navbar stays unchanged. The dashboard uses its **own full-screen layout** (dark sidebar + content area), not the marketing Layout.

---

## Layout Architecture

```
/dashboard
├── DashboardLayout.tsx         — dark sidebar + main content shell
│   ├── DashboardSidebar.tsx    — logo, nav links, client quick-select
│   └── DashboardTopbar.tsx     — search, notifications, user menu
│
├── Views (rendered in main content area):
│   ├── OverviewView.tsx        — key metrics, client health grid, activity feed
│   ├── ClientsView.tsx         — full client table with filters + per-client drawer
│   ├── ClientDetailView.tsx    — single client deep-dive (GMB, social, listings, reviews)
│   ├── SocialCalendarView.tsx  — upcoming posts, publish status per platform
│   ├── ListingsView.tsx        — directory sync status table
│   ├── AiAssistantView.tsx     — Gemini chat panel for agency ops
│   └── SettingsView.tsx        — agency profile, billing, team
```

---

## Dashboard Page Structure

### Route: `/dashboard` → OverviewView (default)
Sub-routes via state (tab-based navigation, not URL-based for simplicity):
- `overview` — default
- `clients`
- `social`
- `listings`
- `ai-assistant`
- `settings`

---

## View Details

### 1. OverviewView
**Top KPI Strip (4 cards):**
- Active Clients: 24
- GMB Health Avg: 87%
- Posts This Week: 18
- Listings Synced: 40+

**Client Health Grid:**
- Responsive grid of ClientHealthCard components
- Each card: business name, niche icon, GMB score (ring progress), subscription tier badge, 3 status dots (website live, social connected, listings synced)
- Click → opens ClientDetailView

**Recent Activity Feed:**
- Chronological list: "Maria's Kitchen GMB updated menu", "Social post published to 4 platforms", "ThiboRoofing listing corrected on Apple Maps"

**AI Insight Banner:**
- Gemini-generated daily insight: "3 clients have GMB profiles not updated in 14+ days. Suggested action: send reminder email."
- "Ask AI" button → navigates to AiAssistantView

### 2. ClientsView
- Searchable/filterable data table
- Columns: Business Name, Niche, Plan, GMB Score, Last Updated, Status, Actions
- Filters: All | Active | Needs Attention | Trial
- Row click → ClientDetailView slide-over panel

### 3. ClientDetailView (Slide-over / full panel)
Tabs: **Overview | GMB | Social | Listings | Reviews | AI Report**

- **Overview tab:** Contact info, subscription, join date, notes
- **GMB tab:** Profile completeness score, last update date, posts timeline, current hours
- **Social tab:** Connected platforms (FB/IG/X/LI), last post date per platform, post history
- **Listings tab:** Per-directory accuracy table (Name, Address, Phone, Status: Synced/Error/Pending)
- **Reviews tab:** Review count, avg rating, recent reviews list, video reviews count
- **AI Report tab:** Gemini-generated client health report with recommendations

### 4. SocialCalendarView
- Week view calendar grid
- Each day shows scheduled/published posts per client
- Platform filter chips (Facebook, Instagram, X, LinkedIn)
- "New Post" button → modal to create GMB post (syncs to all)

### 5. ListingsView
- Table of all clients × directories
- Color-coded status: green (synced), yellow (pending), red (error)
- Bulk "Fix All Errors" action button
- Per-directory details panel on row click

### 6. AiAssistantView
- Full-page Gemini chat interface
- System prompt: Agency Command Center context (knows about all clients)
- Suggested prompts:
  - "Which clients need urgent GMB attention?"
  - "Generate a monthly performance report for Maria's Kitchen"
  - "What's the best niche to target next month?"
  - "Draft a re-engagement email for trial clients"
- Chat history persisted in component state
- Sources panel: shows which client data was used in response
- **REQUIRES Enter Cloud** — shows "Enable AI" banner if not connected

### 7. SettingsView
- Agency branding (logo, name, colors for white-label)
- Team members management (invite by email)
- Subscription & billing overview
- API connections (GMB OAuth status, social platform tokens)
- White-label configuration

---

## Component Files to Create

```
src/
├── pages/
│   └── Dashboard.tsx                    — main dashboard page (renders DashboardLayout)
│
├── components/
│   └── dashboard/
│       ├── DashboardLayout.tsx          — dark sidebar shell
│       ├── DashboardSidebar.tsx         — navigation sidebar
│       ├── DashboardTopbar.tsx          — top search/notifications bar
│       ├── views/
│       │   ├── OverviewView.tsx
│       │   ├── ClientsView.tsx
│       │   ├── ClientDetailPanel.tsx    — slide-over detail panel
│       │   ├── SocialCalendarView.tsx
│       │   ├── ListingsView.tsx
│       │   ├── AiAssistantView.tsx
│       │   └── SettingsView.tsx
│       └── widgets/
│           ├── KpiCard.tsx              — metric card with icon + trend
│           ├── ClientHealthCard.tsx     — client grid card with GMB ring
│           ├── ActivityFeed.tsx         — recent events list
│           ├── AiInsightBanner.tsx      — Gemini insight strip
│           ├── PlatformStatusDot.tsx    — colored status indicator
│           └── GmbScoreRing.tsx        — SVG ring progress for GMB score
```

---

## Mock Data File
```
src/data/
└── mockClients.ts     — 8 sample clients (Restaurant, Contractor, Retail niches)
                          with GMB scores, subscription tiers, listing status,
                          social connections, recent activity
```

---

## Design System (Dashboard-specific tokens)
Reuses existing brand tokens. Dashboard uses dark surfaces:
- Sidebar bg: `#0A1120` (existing `--nav-bg`)
- Main content bg: `#0D1526`
- Card bg: `#111E33`
- Card border: `rgba(255,255,255,0.08)`
- Text primary: `#EEF1FA`
- Text muted: `rgba(238,241,250,0.55)`
- Accent blue: `#0078D7` (existing `--primary`)
- Success green: `#22C55E`
- Warning amber: `#F59E0B`
- Error red: `#EF4444`

---

## Router Update
Add to `src/router.tsx`:
```
{ path: "/dashboard", element: <Dashboard /> }
{ path: "/dashboard/:view", element: <Dashboard /> }
```

Update `src/components/layout/Navbar.tsx`:
- Add "Dashboard" link (styled differently — agency-only)

---

## AI Integration Plan (Requires Enter Cloud)
- Enter Cloud must be enabled first
- Supabase Edge Function: `agency-ai-chat`
  - Uses Enter LLM skill
  - System prompt includes client context
  - Streams responses to AiAssistantView
- Until Enter Cloud is enabled: show placeholder "Enable AI Features" banner in AiAssistantView

---

## Files to Modify
| File | Change |
|------|--------|
| `src/router.tsx` | Add `/dashboard` route |
| `src/components/layout/Navbar.tsx` | Add Dashboard link |

## New Files (22 total)
- `src/pages/Dashboard.tsx`
- `src/data/mockClients.ts`
- `src/components/dashboard/DashboardLayout.tsx`
- `src/components/dashboard/DashboardSidebar.tsx`
- `src/components/dashboard/DashboardTopbar.tsx`
- `src/components/dashboard/views/OverviewView.tsx`
- `src/components/dashboard/views/ClientsView.tsx`
- `src/components/dashboard/views/ClientDetailPanel.tsx`
- `src/components/dashboard/views/SocialCalendarView.tsx`
- `src/components/dashboard/views/ListingsView.tsx`
- `src/components/dashboard/views/AiAssistantView.tsx`
- `src/components/dashboard/views/SettingsView.tsx`
- `src/components/dashboard/widgets/KpiCard.tsx`
- `src/components/dashboard/widgets/ClientHealthCard.tsx`
- `src/components/dashboard/widgets/ActivityFeed.tsx`
- `src/components/dashboard/widgets/AiInsightBanner.tsx`
- `src/components/dashboard/widgets/GmbScoreRing.tsx`

---

## Build Order
1. `mockClients.ts` — data foundation for all views
2. `DashboardLayout` + `DashboardSidebar` + `DashboardTopbar` — shell
3. Widget components (KpiCard, ClientHealthCard, etc.)
4. All views (OverviewView first, then others)
5. `Dashboard.tsx` page — assembles everything
6. Router + Navbar update

---

## Verification
- `/dashboard` loads without error
- Sidebar navigation switches views correctly
- Client health cards display with GMB ring scores
- ClientDetailPanel opens on click with all 6 tabs
- AiAssistantView shows "Enable AI" placeholder (no Enter Cloud yet)
- Mobile: sidebar collapses to hamburger
- Lint passes clean
