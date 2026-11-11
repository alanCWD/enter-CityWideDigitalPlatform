# Business Online Health in the CityWide dashboard

## Goal

Add one entry point to the already-deployed Business Online Health module so a signed-in client can open their own report from their portal, and staff can open the same report from the client's record in the agency dashboard. No part of the module's pages, scoring or report UI is rebuilt here.

## What you will see

- **Client portal:** a new "Online Health" item in the per-client portal sidebar, beside the existing Overview, Listings, Reviews, Social, SEO, Health and other items. It opens a full-width view of the module for that client.
- **Agency dashboard:** a new "Online Health" tab on each client record, next to Overview, Health, Vault and the billing tabs, showing the same view for that client.
- The view is a single frame of the module, opened with its embedded layout (`embed=1`), so there is no second sidebar, top bar or footer from us. The module supplies its own slim bar with the client, location, check date and "Back to CityWide Digital", and the portal's own sidebar remains visible as the way back.
- While the module loads, a quiet loading panel is shown. If the module refuses to load or the client has no mapping yet, a clear written notice replaces the frame, with a plain "Open report in a new tab" fallback — never a blank page.
- The report is read-only. No edit, publish, claim or delete action is added anywhere in the dashboard for it.

## Client to slug mapping

All client slugs live in one file, keyed by the client's stable portal connection id — not by name — so renaming a client never changes its link. The five current clients get name-derived slugs for now:

| Client | Slug |
| --- | --- |
| CityWide Digital | citywide-digital |
| Go Rest | go-rest |
| HyperDrii | hyperdrii |
| The Finer Details | the-finer-details |
| The Foam Zone | the-foam-zone |

The module's base address is also a single value in that file, currently the test build you provided, so switching to the production address later is one edit. Each entry can carry an optional location reference (for example `NW-01`); none is set today, so the module's own location selector is used.

A client whose business profile is not linked yet, or that is not in this mapping, gets the written notice instead of a guessed link. The dashboard never substitutes another client's slug.

## Honest data state

The module currently labels its data as a sample dataset and shows its own notice for a link that is not in its sample build. We leave that labelling exactly as the module presents it and add no score, plan, coverage or "your result" claim of our own. Entitlement checks stay wherever they already are in the dashboard; the module's displayed plan or coverage is treated as presentation, never as the source of truth.

## Link and privacy

The launch address carries only the client slug, `from=citywide`, `embed=1` and the optional location reference. No tokens, emails, client ids, personal data or secrets are placed in the query string.

## Unchanged

- The module's standalone app still opens in full when no parameters are used; we do not change or proxy it.
- The existing "Health" page and any other portal or CRM page stay as they are.
- No data is copied into the dashboard, no second navigation system is introduced, and no new database table, backend function or billing change is made.

## Checklist

- [ ] Portal sidebar shows "Online Health" for the signed-in client's own connection, and it opens that client's report.
- [ ] Agency client record shows an "Online Health" tab for the same client.
- [ ] The embedded view is full width, at least 900 px tall, allows clipboard-write, and has no extra dashboard header above it.
- [ ] A client with no linked profile or no slug sees a written notice with a new-tab fallback, not a blank frame and not another client.
- [ ] The client-to-slug mapping is the only place the slug is defined, and every dashboard launch link is built with the slug, `from=citywide` and `embed=1`.
- [ ] No token, email or personal data appears in any launch address.
- [ ] The module opened without parameters still shows the full standalone app.
