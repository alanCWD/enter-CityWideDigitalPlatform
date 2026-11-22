# Swap Site Concierge for Inbox Pro on Services and in the footer

## What changes

Site Concierge stops being the eighth featured product. Inbox Pro takes its place as a first-class product with its own Services panel, and the product list is reordered so the Services page and the footer read the same.

### Services page
- [ ] The Services page shows eight products in this order: Google Synced Website, Listing Sync Pro, Social Sync Pro, Business Online Health, Google Coach, **Inbox Pro**, Review Engine, Creator Campaigns.
- [ ] The Site Concierge panel and its entry in the "explore" card grid are gone, including its `#site-concierge` anchor.
- [ ] Inbox Pro has a full panel matching the other apps: its own blue accent, the Inbox icon, the kicker line `06 / Included with CityWide plans`, a short description, a "What's included" list, and an **Explore** button that opens https://inbox-pro.citywidedigital.ca/ in a new tab.
- [ ] Panel content describes only behaviour the product actually has: conversations from connected channels brought into one shared team inbox, replying from one workspace, Pro tools for broadcasts, sequences and automations with access depending on plan, seats per workspace, and the signed hand-off from the CityWide dashboard. No pricing figure or availability date is claimed.
- [ ] Panel numbers, anchor links and the "0X / Explore below" count all follow the new order after the swap.

### Footer
- [ ] The Products column lists exactly: Google Synced Website, Listing Sync Pro, Social Sync Pro, Business Online Health, Google Coach, Inbox Pro, Review Engine, Creator Campaigns.
- [ ] Site Concierge is no longer in the Products column.
- [ ] Inbox Pro in the Products column uses the Inbox icon with its own blue tone and links to `/services#inbox-pro`, the same way the other products link to their panels.
- [ ] The three static guide pages (GBP synced websites, GBP as source of truth, GBP local listing) get the identical footer change, so none of them keeps a link to the removed `#site-concierge` anchor.
- [ ] The existing Guides-column "Inbox Pro" link to the `/inbox` explainer page is left as is.

## What stays unchanged

- Site Concierge remains a sold service: its credit rows in the Pricing comparison table, the "3 Site Concierge credits/mo" plan lines, the Site Concierge Credits add-on, and the About-page explanation are untouched. It simply no longer has a Services panel or footer entry.
- Every other product panel, the page hero, the closing call-to-action, and the dashboard/portal side of Inbox Pro are unchanged.
- The unused `ProductCards` marketing component (not rendered anywhere on the site) is left alone.

## Assumptions

- "Explore" points at the standalone Inbox Pro app URL you supplied; the panel's secondary action is omitted rather than invented, because no Inbox Pro pricing page or order flow exists yet.
