# Business Online Health report purchase

Add a CityWide purchase flow for the $59 USD, one-time expanded report, without collecting card details in the report app. The planned purchase address is `https://www.citywidedigital.ca/business-online-health/checkout`, with the report reference supplied as `?boh_ref=...`.

## Important payment limitation

The currently supported checkout interface does not accept report-reference metadata or provide the controls needed to prevent duplicate charges. The existing subscription checkout is not suitable for this one-time purchase. Platform support for these capabilities is a prerequisite: do not enable a paid checkout or claim the integration works until that limitation is resolved. Existing CityWide billing and receipts must remain unchanged.

## Proposed experience

- [ ] Show a CityWide purchase page for a single $59 USD report, preserving the opaque `boh_ref` from entry through payment. Missing or malformed references receive a clear error and cannot start checkout.
- [ ] Once supported, create a one-time Stripe payment using CityWide’s existing billing and receipts. Record `boh_ref` on both the Checkout Session and PaymentIntent and retain the order, session, business, buyer, and payment timestamp. Preserve existing billing data.
- [ ] Prevent repeat and concurrent charges for the same reference, including retries and abandoned or unresolved checkout sessions. If already paid, offer to open the report instead; if payment status cannot be determined safely, prevent another charge and provide a retry path.
- [ ] After confirmed payment, issue the specified server-signed token and redirect to `https://online-health.citywidedigital.ca/report/<public_ref>?cw=<token>`. Use a 24-hour expiry for the immediate redirect and a seven-day expiry for any emailed link; include the reference and purchase identifier exactly as specified. Never expose the shared signing secret.
- [ ] Provide an “Open my report” recovery path that verifies the buyer’s access before issuing a fresh token from the stored paid order. A report reference alone must not grant access to someone else’s purchase. If lookup or signing fails, retain the paid order and show a retry route rather than redirecting with a broken token.
- [ ] Obtain `CITYWIDE_ENTITLEMENT_SECRET` through the secure secret channel; it must match the separate report app’s secret. The separate app remains responsible for validating the signature, expiry and URL reference, recording entitlement, and handling refreshes.
- [ ] With test-mode access and the report app available, run a test purchase and provide the real redirect, then verify metadata and order storage, duplicate-charge prevention, refresh behavior, and rejection of tampered and expired tokens. Report any unverified external-app behavior or missing test access rather than claiming success.
