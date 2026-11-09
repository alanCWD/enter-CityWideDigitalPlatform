# Page Loads Start at the Top

## Goal

Every time a visitor opens a page — from the navbar, a footer link, a card, a call-to-action, or a direct URL — the page opens at its top instead of inheriting the scroll position of the previous page.

## What changes for the user

- Navigating from a scrolled page (for example, after reading far down the home page or `/services`) into any other page shows that page from its very top.
- This applies to all linked destinations: the marketing pages (`/`, `/services`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`, and the two GBP landing pages), the client portal pages, the agency dashboard pages, and the CRM, social, billing, and inbox areas.
- Reloading a page, or using the browser's back/forward buttons, also starts the destination at the top rather than restoring the old scroll position.
- Anchor links keep working as anchors: links such as "Get Started" that go to `/pricing#start-trial` and `/about#faq` still land on that section rather than the top. As a side effect, `/about#faq` will now actually reach the FAQ section when opened from another page, which it currently does not.
- The existing scroll-driven effects on the home page (the opening hero animation) behave correctly because the page always begins at scroll position zero.

## Scope and constraints

- No visual, layout, or content changes: same pages, same design, same sections.
- No per-page changes; the behavior applies uniformly to every route, including ones added later.
- User-initiated scrolling inside a page is untouched — this only resets position when the page changes.
- Window resize, tab switching, and in-page menus (mobile nav, dropdowns) are unaffected.

## Tasks

- [ ] Add one shared behavior at the app's routing level so every route change opens the destination page at the top.
- [ ] Ensure anchor destinations (`/pricing#start-trial`, `/about#faq`) still scroll to their section instead of the top.
- [ ] Confirm the browser does not restore a previously scrolled position on reload or back/forward navigation.
- [ ] Verify by visiting a page, scrolling to the bottom, then opening each main destination (`/services`, `/pricing`, `/about`, `/contact`, a portal page, and a dashboard page) and confirming each starts at the top.
