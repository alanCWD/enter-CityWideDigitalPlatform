# Free Trial intake on /pricing

## Intended result

"Start Free Trial" becomes a real intake instead of an instant redirect. A visitor gives their customer and billing details, reads and accepts how payment and Google Business Profile access work, and starts a 30-day trial with no card and no payment step. The request lands in the CRM as a free-trial client the team can pick up.

## What the visitor sees on /pricing

A "Start your 30-day free trial" section sits directly below the three plan cards. Every trial CTA — the plan card buttons, the navbar's Start Trial, the home page hero/plans/closing CTA, the shared CTA banner, and Services — sends people to this section, and a plan card button arrives with that plan already selected.

The form collects, all required unless noted:

- **Plan** — Starter, Growth or Pro, preselected from the card that was clicked.
- **Customer details** — business name, contact full name, email, phone, business type, website (optional), and the business's Google Business Profile name or link.
- **Billing details** — billing contact name, billing email, billing address, city, province/state, postal code, country (defaults to Canada).
- **Consent** — two checkboxes: one authorizing CityWide Digital's Owner access to the Google Business Profile, one accepting the Terms of Service and Privacy Policy.

The section explains, before submission:

- **No card today.** Nothing is charged and no payment details are collected. The 30-day trial starts when the account is set up.
- **After 30 days**, the plan's monthly price begins — $197 Starter, $397 Growth, $597 Pro — paid either by credit card through Stripe or by Direct Deposit. The team confirms the preferred method before the trial ends; nothing is charged automatically without that arrangement.
- **Google Business Profile access.** "Owner" access means management access to the listing, not Primary Ownership. It lets CityWide Digital update the business's information, and it can be disconnected at any time. Information is only adjusted with prior consent. The listing's ownership itself does not change hands. The copy names **alan@citywidedigital.ca** as the Owner being granted access.

On success the form is replaced by a confirmation showing the trial dates, the plan, the next steps (grant Owner access to alan@citywidedigital.ca in the profile's Users settings, then expect a setup contact within one business day), and a short restatement of the payment and ownership terms.

If saving fails, the visitor sees an error with a retry and a direct email fallback; the page never shows a confirmation for a request that was not saved. Submitting twice with the same billing email does not create a second record.

## Where the trial lands

- A new client record in the CRM, flagged as a free-trial request, with the selected plan, trial start and end dates, and the business type.
- The primary contact from the customer details, plus the billing email, phone and full billing address on the client.
- A note recording the Google Business Profile name, that Owner access was authorized for alan@citywidedigital.ca with a timestamp, and that payment after the trial is Stripe or Direct Deposit. The team can see all of this on the client record.
- No Stripe customer, subscription or card is created at intake.

## Limits and out-of-scope

- Google does not allow adding an Owner to a Business Profile on someone's behalf: the client must add alan@citywidedigital.ca themselves in their Google Business Profile. The form and confirmation explain this instead of implying automatic access, and the existing Google connection flow is unchanged.
- No portal account or password is created at signup; invitations continue to come from the existing portal invite.
- Checkout is not part of signup. The plan prices quoted at intake must match the amounts configured for billing, so the stale plan amounts in the existing checkout path will be corrected to $197 / $397 / $597 CAD monthly.
- The FAQ answer about card requirements gains one line covering the Stripe or Direct Deposit choice; the plan cards, comparison table, add-ons and other pricing content stay as they are.

## Tasks

- [ ] Trial section on /pricing with plan preselection, placed below the plan cards.
- [ ] Customer and billing fields with required-field validation, GBP listing field, and both consent checkboxes.
- [ ] Payment explanation: no card today, 30 days free, then Stripe or Direct Deposit; nothing charged without an arrangement.
- [ ] Owner-access explanation naming alan@citywidedigital.ca, stating management-not-Primary-Ownership, revocable at any time, changes only with prior consent, with the consent checkbox.
- [ ] Submission saved to the CRM as a flagged free-trial client with contact, billing details, plan and trial dates, and the authorization note; duplicate-safe.
- [ ] Confirmation screen with trial dates, next steps and the payment/ownership summary.
- [ ] Failure state with retry and email fallback; no false success.
- [ ] All trial CTAs (nav, home, services, banners, plan cards) point to the form.
- [ ] Plan amounts quoted in the form and used by billing match at $197 / $397 / $597.
- [ ] Verified responsive at mobile 390 and desktop 1280.
