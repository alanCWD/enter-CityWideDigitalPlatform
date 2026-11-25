# Pricing copy update — Starter / Growth / Pro

## Outcome

Update the public plan copy so Starter reads "GMB-synced webapp" with Advanced SEO, Growth gets the longer Social Sync description plus the optional webapp-refresh note, and Pro adds Google Search Coach and Inbox Pro and now lists "Concierge site credits". Prices, plan keys, trial flow and checkout remain untouched.

## Scope

- [ ] **Starter card (`/pricing`)**: "GMB-synced website" → "GMB-synced webapp"; "Basic SEO" → "Advanced SEO". All other bullets unchanged.
- [ ] **Growth card**: "Social Sync — GBP + 3 platforms" → "Social Sync — Synced social posting on GBP + 3 platforms". Add a muted note below the bullet list: "Optional webapp refresh every 2 years *" with the footnote "* requires updated customer supplied imagery and textual content." rendered smaller directly underneath (not as a checked feature).
- [ ] **Pro card**: "Social Sync — up to 10 platforms, choose from 15" → "Social Sync — up to 10 platforms"; add "Google Search Coach" and "Inbox Pro"; replace "3 Site Concierge credits/mo" with "Concierge site credits". Final order: Everything in Growth · Social Sync — up to 10 platforms · Review Engine · Google Search Coach · Inbox Pro · AI chatbot intake · Concierge site credits · Dedicated account manager.
- [ ] **Comparison table (`/pricing`)**: align with the cards — rename the shared website row to "GMB-synced webapp"; remove the "Choose from 15 platforms" row; show Concierge site credits as included on Pro instead of "3 credits/mo"; add Google Search Coach and Inbox Pro as Pro-only rows; add an "Optional webapp refresh every 2 years" row (Growth and Pro) with the asterisk footnote under the table.
- [ ] **Home page plan preview**: use condensed versions of the new card bullets (Starter: webapp, template, Social Sync GBP + 2, Advanced SEO; Growth: the new Social Sync wording plus its existing extras and the refresh note; Pro: 10 platforms, Review Engine, Google Search Coach, Inbox Pro, Concierge site credits). Remove the old "GMB-integrated website", "Basic analytics", "Site Concierge credits (3/mo)" and "White-label option" wording from that preview.
- [ ] **Dashboard plan picker (Builder)**: apply the same short-form wording (webapp, Advanced SEO, new Social Sync descriptions, Search Coach, Inbox Pro, Concierge site credits).
- [ ] **AI builder plan summaries (backend function)**: update the Starter/Growth/Pro summary strings so generated plan recommendations do not quote "basic SEO" or "3 Site Concierge credits" as current features; redeploy the function after the text change.

## Unchanged / excluded

- Prices, "$197 / $397 / $597 /mo", "CAD · plus GST", plan keys and the trial intake / plan selection behavior.
- Add-ons section (including the "$15 / credit" Site Concierge add-on), FAQ copy, white-label claims, service pages, product cards and footer links.
- No database, authentication, entitlement, Stripe or analytics changes. Existing plan entitlements and customer data are preserved.

## Notes and assumptions

- The Growth refresh line is optional and customer-supplied content is required, so it is presented as a footnote rather than a delivered feature.
- "Concierge site credits" no longer states a monthly count; the plan does not introduce a new number.
- Footer/service mentions of Inbox Pro and Site Concierge remain as they describe the products, not plan contents.

## Verification

- Check the three `/pricing` cards and comparison table render the new copy without overflow or misalignment, including the Growth footnote and longer Pro list.
- Check the home page plan preview and the dashboard plan picker show the same wording.
- Run lint/typecheck; the dashboard picker is behind sign-in, so its rendering will be confirmed from code rather than a signed-in session unless an accessible account exists.
