# Glassmorphic CRM Dashboard Workspace — re-theme

## Context

The agency workspace currently wears the CityWide navy/electric-blue theme (`#0D1526` surfaces, `#0078D7` accents). You want it re-skinned in the visual language of the **Glassmorphic CRM Dashboard Workspace** template instead, with the public marketing site and the client portal left exactly as they are.

The result should read as a premium, modern CRM workspace: frosted glass panels floating over a deep, softly glowing aurora background, with a violet→indigo signature accent and cyan/pink light leaks.

## What changes

### 1. The workspace backdrop
Instead of a flat navy page, the workspace gets a deep ink canvas with slow-drifting violet, indigo, cyan and fuchsia glows — subtle enough that charts and tables stay easy to read, weighted toward the edges so content areas stay calm.

### 2. Frosted surfaces
- Sidebar, top bar, KPI cards, panels, tables, dropdowns, dialogs and toasts all become translucent glass: soft light edges, gentle inner highlight, blurred backdrop.
- Rounded corners get slightly softer, shadows become diffuse violet-tinted halos instead of hard black drop shadows.
- Content areas keep their current spacing, grids and density — only the material changes.

### 3. Signature accent
- Primary actions, active nav items, links, focus rings, chart strokes and progress fills move from electric blue to a violet→indigo gradient, with cyan/pink as supporting glow colors.
- Success/warning/error semantics (green/orange/red) and third-party brand marks stay as they are, because their meaning must remain readable.
- Per-agency identity colors (CityWide blue, Legacy Leaf green, Foodiio orange, OneProfile purple) are kept on agency avatars/logo chips so the agency switcher still distinguishes brands; the workspace-level highlights use the new signature accent.

### 4. Typography and detail
- Inter stays as the typeface, with tighter tracking and stronger weight contrast on titles and KPI values so they sit crisply on glass.
- Buttons, inputs, badges, tabs, pagination and pills are restyled consistently with the frosted/violet system.
- Custom scrollbars, text selection and focus rings follow the new palette.

### 5. Light mode
The existing light/dark toggle keeps working. Dark becomes the signature glass look; light becomes a soft frosted variant over a pale lavender/sky/pink ambient wash, with violet accents and dark ink text — still fully legible.

## Scope

**In:** every page rendered inside the shared workspace shell — Dashboard/Command Centre, all CRM screens (index, clients, client detail, catalog, invoices), social (calendar, profiles, inbox, campaigns), inbox, review requests, Builder, GBP integration, restaurant/ordering, analytics, leads, Kimi console, billing/affiliates, and internal admin user management (it renders in the same shell).

**Out:** public marketing pages, the client portal (`/portal/*`), login/signup screens, and all page content, navigation, data, integrations and workflows. No behavioral change anywhere.

## Preserved behavior

- Same routes, navigation structure, page titles, data, forms, dialogs, tables and actions.
- Modals, dropdowns and toasts remain readable and correctly layered above the glass surfaces.
- Text contrast stays at comfortable reading levels on every glass surface in both themes; interactive elements keep visible focus states.
- Fully responsive: sidebar/drawer behavior, sticky top bar and card grids unchanged on mobile and desktop.
- Animations are gentle and automatically disabled for users who prefer reduced motion.
- The theme is self-contained to the workspace, so marketing and portal styling cannot drift.

## Implementation checklist

- [x] Workspace pages render over the new aurora backdrop while marketing and portal routes keep their current appearance.
- [x] Sidebar, top bar and mobile drawer present as frosted glass with the new accent for active items.
- [x] All semantic surfaces (cards, panels, tables, popovers, dialogs, toasts) take on the translucent glass treatment in both themes.
- [x] Legacy navy/blue hard-coded styling anywhere inside the workspace resolves to the glass palette; semantic green/orange/red and third-party brand colors remain unchanged.
- [x] Signature violet→indigo accent replaces electric blue for CTAs, links, rings, chart strokes and active states inside the workspace only.
- [x] Light mode renders as a legible light-glass variant; the theme toggle and its saved preference are unchanged in behaviour.
- [x] Reduced-motion preference disables the ambient drift.
- [x] Theme classes are removed when leaving the workspace so no other surface is affected.

## Verification checklist

- [x] Type-check, lint and production build succeed with no new warnings (lint: 0 errors, 10 pre-existing warnings).
- [x] Landing on a marketing page and the sign-in screen shows them unchanged (verified by screenshot at 1280 px).
- [ ] Workspace screens verified in a signed-in session (blocked: the workspace redirects to sign-in in the automated browser).
- [ ] Toggling light/dark inside the live workspace and surviving a reload (logic untouched, not exercised in a signed-in session).
- [x] Light and dark glass material, contrast hierarchy and hard-coded navy/blue remaps verified on a temporary in-preview harness at 1280 px and 390 px; the harness was removed afterwards.
- [ ] Modal, dropdown, toast and tooltip stacking verified on a live workspace screen (not visually exercised; styling resolves through shared glass tokens and dialog blur rules).

**Known verification limit:** the workspace is behind sign-in, so end-to-end visual checks could not run. The theme itself was validated on a temporary harness using the real components' class names, and that harness has been deleted.

