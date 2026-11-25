# New guide: what Google Posts, social syndication and website content actually do for local SEO

## Outcome

Publish the supplied article as a new CityWide guide at `/google-posts-and-local-seo`, matching the existing guide set (GBP source of truth, GBP local listing, GBP-synced websites). The article explains three distinct mechanisms, keeps the honest caveats, and closes with CityWide's positioning: consistent local marketing, not guaranteed rankings.

## The article

**Working title:** Do Google Posts and Social Media Actually Help Your SEO?
**Kicker:** Local SEO Guide
**Lede:** What posting to Google, syndicating to social and publishing useful website content each contribute to local search visibility — and where the real opportunity sits.

Structure, following the supplied draft:

- **Short answer first:** posting, syndication and website content help, but the largest benefit comes from running all three together. No promise of automatic ranking improvements.
- **Three mechanisms, not one:** a short framing that distinguishes visibility inside Google, distribution to social, and indexable website content.
- **Google posts:** what posting to a Business Profile can do (services, local information, seasonal offers, reasons to contact, a current profile). Caveat citing Google's own local ranking guidance: local results are mainly based on relevance, distance and popularity; post frequency is not documented as a direct ranking factor.
- **Social syndication:** one post distributed to Google, Facebook, Instagram, LinkedIn and other connected channels; referral traffic, awareness, engagement, shares and discovery. Caveat: likes and shares are not established direct Google ranking factors, and syndication alone does not create authority.
- **The website is where the SEO opportunity is strongest:** the Victoria plumbing example (hot water tanks, emergency repairs, drain cleaning, bathroom renovations, seasonal maintenance). Key distinction: synchronised GBP information is not the same as dedicated service landing pages; ranking for "emergency plumber Victoria" needs useful, relevant website content. Link to Google's SEO Starter Guide.
- **The connected ecosystem:** a styled conceptual diagram — Google Business Profile as the central record, feeding the website, social channels, directories and customers — with the supplied note that it is conceptual, not a guarantee of identical replication.
- **What CityWide should emphasise:** the supplied capability-to-benefit table (Google posting, social syndication, GBP/website/directory sync, reviews, dedicated service pages), with service-specific content called out as a deliberate opportunity rather than a sync side effect.
- **A weekly publishing routine:** Monday service spotlight, Wednesday recent project or customer story, Friday offer/seasonal tip/FAQ; publish to Google and distribute appropriate versions; measure Maps visibility, organic impressions, clicks, calls, enquiries and new customers; review after 8–12 weeks.
- **Positioning:** traditional website agency (build, maintain, separately manage Google, social and directories) versus an ongoing local digital presence management system. Include the supplied marketing message as a pull quote.
- **Closing:** the credible promise is that CityWide makes consistent local marketing easier to execute; consistency, accurate information, quality website content and reputation support long-term visibility. No guarantee of rankings.

## Publication details

- New page component at `/google-posts-and-local-seo` using the existing glass guide layout (`GlassHero`, article panel, `GlassCTA`), plus a static crawlable twin at `public/google-posts-and-local-seo.html` built on `gbp-guide.css`, so the full text is server-rendered for search and AI crawlers. React and static copy stay in step, as with the existing guides.
- Add the route, page metadata (title, description, canonical), a sitemap entry with lastmod, a Guides link in the site footer, and an entry in `llms.txt`.
- Static twin gets article and breadcrumb structured data plus its own header and footer, following the existing guide template.
- Reviewed date: 25 November 2026.

## Copy and sourcing decisions

- Remove the pasted source-card artifacts ("Unsupported client – Canva", the Square boosted-post card, the Rise at Seven link, "Google for Developers +1"). Keep only the two relevant Google sources, linked inline: Google's tips to improve local ranking and the Google SEO Starter Guide.
- Use Google's current local-ranking wording ("relevance, distance and popularity") rather than the draft's older "prominence", since Google's published guidance now uses popularity.
- No new imagery or generated assets; the ecosystem visual is built from layout and CSS.

## Explicit exclusions

- No changes to the existing three guides, their copy, styling or routes.
- No guarantees, ranking claims or invented statistics.
- No dashboard, backend, database or integration changes.
- No additional navigation restructuring beyond one Guides footer link.

## Verification

- Confirm the new route renders with the guide layout and the static twin is served with its full article text.
- Run lint/typecheck on the changed files and fix any issues introduced.
- Confirm the page title, description, canonical, sitemap and footer link point at the same URL.
