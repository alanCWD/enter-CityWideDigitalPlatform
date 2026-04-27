# Agency Command Center — Final Build Plan (based on https://github.com/alanCWD/Agency-Command)

## Source App Summary
7 pages ported from Google AI Studio / Agency-Command GitHub repo:
- Dashboard, Builder, GBPIntegration, RestaurantHub, Analytics, Leads, Coaching
- Uses: recharts (already in project), framer-motion (needs install), react-router-dom, lucide-react
- Color scheme: indigo/slate → restyle to CityWide navy/electric blue
- Import fix: `@/src/lib/utils` → `@/lib/utils`

## New Routes
```
/dashboard      → Dashboard (overview, MRR, activity feed, client roster)
/builder        → Builder (prompt presets, template/copy mode, tier selection)
/gbp            → GBPIntegration (GBP connection, reviews, menus, products sync)
/restaurant     → RestaurantHub (Live Orders, Menu Manager, POS, Google Sync, Notifications)
/analytics      → Analytics (Search Console charts, top queries, SEO health)
/leads          → Leads (real-time lead alerts table)
/coaching       → Coaching (iframe embed of gso-coach.replit.app)
```

## Layout
All dashboard routes share `DashboardLayout` (dark sidebar + topbar) — NOT the marketing Layout.

## Dependency
Add: `framer-motion` (for `motion/react` imports)

## Files to Create
```
src/components/dashboard/
  DashboardLayout.tsx      — full-screen dark layout shell
  Sidebar.tsx              — dark nav sidebar (7 items + CityWide branding)
  TopBar.tsx               — search + notifications + user avatar

src/pages/dashboard/
  Dashboard.tsx            — KPI stats, chart (native vs aggregator), activity feed, client roster
  Builder.tsx              — prompt presets + template/copy/tier UI
  GBPIntegration.tsx       — GBP connection cards (reviews, NAP, publishing, menus, products)
  RestaurantHub.tsx        — tabs: Live Orders / Menu Manager / POS Integration / Google Sync / Notifications
  Analytics.tsx            — GSC chart, top queries table, SEO health score
  Leads.tsx                — lead alerts table with unread count
  Coaching.tsx             — iframe + heading for gso-coach.replit.app
```

## Files to Modify
- `src/router.tsx` — add 7 new routes
- `src/components/layout/Navbar.tsx` — add Dashboard link

## Color Mapping (Indigo → CityWide)
- `indigo-600` → `#0078D7`
- `indigo-700` → `#00447A`
- `indigo-50` → `#E0F0FF` or `bg-accent`
- `bg-slate-50` → `bg-[#F8F9FC]`
- Sidebar: dark navy `#0A1120` (matching existing nav)

## Build Order
1. Install framer-motion
2. DashboardLayout + Sidebar + TopBar
3. All 7 page components (ported + restyled)
4. Router + Navbar update
