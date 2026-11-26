# New Guides article: Website best practices for Google

## Outcome

Add a new CityWide Digital guide, "Website Best Practices for Google: A Local Business Guide", at `/google-website-best-practices`. It explains what Google actually recommends for a local business website, separates ranking factors from trust and legal basics, and says which of those basics CityWide handles. It joins the existing Guides set with the same glass guide layout, header and footer.

## Scope

- [ ] The guide is reachable at `/google-website-best-practices` as a React page using the shared glass guide layout, with the hero kicker "Guide · Managed local presence" and the title "Website Best Practices for Google: A Local Business Guide".
- [ ] A crawlable static twin is published at `public/google-website-best-practices.html` with the same article content, full document head (title, meta description, canonical, Open Graph, Twitter, robots), the standard CityWide header and footer, and Guide structured data.
- [ ] The article carries the draft's full content, edited for publication:
  - Writing for people first, and what E-E-A-T means for a local business.
  - Title tags, headings (one descriptive H1, logical H2/H3), and meta descriptions, each with its caveat where Google may rewrite it.
  - Crawlable, semantic pages, alt text and readable URLs.
  - LocalBusiness structured data, including that the markup must match visible content.
  - Trust pages: privacy policy, terms, copyright notice and contact information, stated clearly as trust and legal basics rather than Google ranking factors.
  - Keeping name, address, phone, hours and services consistent across the website, Google Business Profile and directories.
  - What CityWide handles, with the three items previously marked `[confirm]` published as current capabilities: unique titles, headings and meta descriptions on template pages; LocalBusiness structured data matching the profile; privacy, terms and copyright footer templates.
  - The quick checklist and the four FAQs, including the honest answers that Google sets no ideal title length, may write its own snippet, and that no one can guarantee rankings.
- [ ] Factual claims link to official Google Search Central documentation. CityWide's own pages appear only as internal links where they are genuinely the destination (for example the sync guide), not as external evidence.
- [ ] The guide is listed under "Guides" in the site footer: label "Website best practices for Google", linking to the static page like the other guides, in both the React footer and the static guide footers. The new static page marks its own link as current.
- [ ] The article's "Related guides and services" block links the sync service guide, the source-of-truth guide, the Google posts guide and the local listing guide. Each of those static guides gains a reciprocal link to the new article where it fits the existing grid.
- [ ] The new page is added to `public/sitemap.xml` (yearly, priority 0.6, lastmod 2026-11-26), the `llms.txt` key-pages list, the route metadata table, and the static reference page list in the header/footer standard.
- [ ] Page metadata: unique title and meta description for search and social, distinct from every other guide, and a "Reviewed 26 November 2026" note in the article.

## Preserve

- Existing guide pages, routes, footers, sitemap entries and metadata stay working and unchanged apart from the added Guides links.
- The shared glass guide layout, `gp-*` styles, header/footer standard, logo, contact details, pricing line and trial offer wording.
- No change to product plans, services copy, pricing, or trial terms.

## Exclusions

- No new Guides hub or index page; the footer's Guides column remains the entry point.
- No images, illustrations or design-system changes; the article uses the existing typographic guide treatment.
- No backend, database, authentication, analytics or payment work, and no new dependencies.
- No changes to the dashboard, portal or any other product page.

## Limitations stated in the copy

- The article does not claim that privacy policies, terms or copyright notices improve rankings, and does not promise rankings or guaranteed rich results.
- Structured data is described as making a page eligible, not as a guarantee of rich results.

## Verification

- ESLint and typecheck pass with the new page and route.
- The route renders without runtime errors, and the static twin opens with the standard header and footer.
- Every new internal link resolves to an existing page, and the new entry appears once in the footer, sitemap and llms.txt.
- Canonical, title and meta description are unique and match between the React route and the static twin.
