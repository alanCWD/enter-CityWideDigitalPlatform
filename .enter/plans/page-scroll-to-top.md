# Page Loads Start at the Top, and Footer Products Land on Their Product

## Goal

Two related navigation fixes:

1. Every time a page is opened — from the navbar, footer, a card, a call-to-action, or a direct URL — it opens at its top instead of inheriting the scroll position of the previous page.
2. The five products in the footer's **Products** column each take the visitor to that exact product on the Services page, not just to the top of the page.

## What changes for the user

### Page loads at the top
- Navigating from a scrolled page (for example, after reading far down the home page or `/services`) into any other page shows that page from its very top.
- Applies to all linked destinations: the marketing pages (`/`, `/services`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`, and the two GBP landing pages), the client portal pages, and the agency dashboard pages (including CRM, social, billing, and inbox).
- Reloading a page, or using the browser's back/forward buttons, also starts the destination at the top rather than restoring the old scroll position.
- Links whose destination is a section still reach that section: `/pricing#start-trial` and `/about#faq` continue to land on their section instead of the top. As a side effect, `/about#faq` will now actually reach the FAQ when opened from another page, which it currently does not.
- The home page's scroll-driven opening animation behaves correctly because the page always begins at scroll position zero.

### Footer products land on their product
- "Website Builder", "Social Sync Pro", "Listing Sync Pro", "Review Engine", and "Site Concierge" each open the Services page scrolled to that product's panel, sitting just below the fixed navigation bar rather than hidden behind it.
- This works both when the visitor arrives from another page and when they are already on the Services page and click a different product in the footer.
- Product names, order, pricing, and section content stay exactly as they are; only where the visitor lands changes.

## Scope and constraints

- No visual, layout, or content changes: same pages, same design, same sections, same footer content.
- The behavior is uniform for every route, including ones added later — no per-page handling that a future page could miss.
- User-initiated scrolling inside a page is untouched; position only resets when the page changes.
- Window resize, tab switching, and in-page menus (mobile nav, dropdowns) are unaffected.

## Tasks

- [ ] Add one shared behavior at the app's routing level so every route change opens the destination page at the top.
- [ ] Make section links scroll to their section after navigation, including when only the section changes while staying on the same page.
- [ ] Confirm the five footer Products links each land on the matching product panel, with the panel heading visible below the fixed navbar, when clicked from another page and when already on the Services page.
- [ ] Confirm other section links (`/pricing#start-trial`, `/about#faq`) still land on their section instead of the top.
- [ ] Confirm the browser does not restore a previously scrolled position on reload or back/forward navigation.
- [ ] Verify by scrolling to the bottom of a page, then opening each main destination (`/services`, `/pricing`, `/about`, `/contact`, a portal page, and a dashboard page) and confirming each starts at the top.
