# Agency Command Centre — Multi-Brand Selector Plan

## Context
The dashboard needs to support 4 white-label agency brands under CityWide Digital's master account:
- **CityWide Digital** (slug: `citywide`) — broadest niche range, master agency
- **Legacy Leaf** (slug: `legacy_leaf`) — sovereign cannabis shops (GBP optional)
- **Foodiio** (slug: `foodiio`) — restaurants with GBP, menus, POS
- **OneProfile** (slug: `oneprofile`) — individual creator portfolios, LinkedIn-fed

Each agency has its own clients (isolated via `agency_id`) but shares master service credentials (Zernio, Synup, bunny.net). The switcher lives at the top of the sidebar as a branded dropdown.

---

## Changes

### 1. Database Migration
- Add `agencies` table (slug PK, name, tagline, accent_color)
- Add `agency_id text NOT NULL DEFAULT 'citywide'` to `gbp_connections`
- Seed the 4 agencies

### 2. New: `src/lib/agencies.ts`
Static agency config with typed definitions:
```ts
export interface Agency {
  slug: string          // DB key
  name: string          // display name
  tagline: string       // one-liner
  accent: string        // tailwind color class e.g. "emerald"
  navItems: NavItem[]   // sidebar nav specific to this agency
}
```
Agency-specific nav items:
| Agency | Nav items |
|--------|-----------|
| CityWide Digital | Dashboard, App Builder, GBP, Ordering & Menus, Analytics, Leads, CRM, Clients, Plans, Invoices |
| Legacy Leaf | Dashboard, GBP, Analytics, Leads, CRM, Clients, Plans, Invoices |
| Foodiio | Dashboard, GBP, Ordering & Menus, Social, Analytics, Leads, CRM, Clients, Plans, Invoices |
| OneProfile | Dashboard, Social, Analytics, CRM, Clients, Plans, Invoices |

### 3. New: `src/contexts/AgencyContext.tsx`
- `AgencyContext` providing `{ agency, setAgency }`
- Persists selected slug in `localStorage` key `cwd_active_agency`
- Defaults to `'citywide'`
- `AgencyProvider` wraps the app (added to `src/main.tsx` or `src/App.tsx`)
- Export `useAgency()` hook

### 4. New: `src/components/dashboard/AgencySwitcher.tsx`
Replaces the logo area at the top of the sidebar:
- Shows current agency name + tagline + colored accent dot
- Clicking opens a dropdown listing all 4 agencies
- Each agency row: colored dot, name, tagline
- Active agency has a checkmark
- Logo shown below the switcher (smaller, secondary)
- Closes on outside click

### 5. Modified: `src/components/dashboard/Sidebar.tsx`
- Replace logo+badge header block with `<AgencySwitcher />`
- Replace static `NAV_ITEMS` with `agency.navItems` from `useAgency()`
- Sidebar bottom "Lead Velocity" widget stays (relabeled contextually if needed)

### 6. Modified: `src/pages/dashboard/Dashboard.tsx`
- Fix: `"Agency Command Center"` → `"Agency Command Centre"` (Canadian spelling)
- Remove: `action={{ label: "+ Deploy New Restaurant" }}` from `<TopBar />`
- KPI subtitle dynamically shows agency name and client count from DB
- Client roster: `SELECT COUNT(*) FROM gbp_connections WHERE agency_id = {slug}` for count, full list for table
- KPI cards adapt labels per agency (e.g., "Active Restaurant Sites" → "Active Clients" for CityWide; "Cannabis Shops" for Legacy Leaf; etc.)
- Chart section: hide "Native vs Aggregator" chart for OneProfile and Legacy Leaf (not relevant); show only for Foodiio/CityWide

---

## Files to Create/Edit

| File | Action |
|------|--------|
| DB migration | New — agencies table + agency_id on gbp_connections |
| `src/lib/agencies.ts` | New |
| `src/contexts/AgencyContext.tsx` | New |
| `src/components/dashboard/AgencySwitcher.tsx` | New |
| `src/components/dashboard/Sidebar.tsx` | Edit — swap header, use agency nav |
| `src/pages/dashboard/Dashboard.tsx` | Edit — fix spelling, remove action, dynamic KPIs |
| `src/App.tsx` or `src/main.tsx` | Edit — wrap with AgencyProvider |

---

## Key Patterns / Reuse
- Existing `useTheme()` pattern → same pattern for `useAgency()`
- `NavLink` with `end` prop already in Sidebar — reuse as-is
- `TopBar` already accepts `subtitle` prop — pass agency name dynamically
- DB `agency_id` already exists on `posts`, `billing_records`, `social_accounts` — consistent pattern
- `supabase` client already imported in Dashboard area hooks — use for live client count

---

## Verification
1. Sidebar top shows branded agency dropdown — clicking cycles through 4 agencies
2. Nav items change when agency switches (e.g. OneProfile has no GBP or Ordering)
3. Dashboard title reads "Agency Command Centre" (no action button)
4. Subtitle shows active agency name and live client count from DB
5. Switching from CityWide to Foodiio only shows Foodiio clients in roster
6. Selection persists on page refresh (localStorage)
7. New clients added via CRM get stamped with current `agency_id`
