# Getting CityWide Digital found in AI search

## The goal

When someone asks an assistant "which agencies build websites that update from Google Business Profile?", CityWide Digital should be readable, understandable and quotable. Today the site is largely invisible to that kind of crawler: every page is a JavaScript-only shell, there is no sitemap, and there is no page that states the service precisely.

`llms.txt` alone will not fix this. Google ignores it for Search, and no AI tool treats it as a registration. The work below therefore focuses on content that crawlers can actually read, plus the access and metadata that let them find it.

## What will be built

### 1. A dedicated service page

A new public page at **`/google-business-profile-website-sync`**, written to be cited rather than skimmed:

- **Definition first:** "CityWide Digital builds and runs websites that synchronise supported information from a Google Business Profile. Business owners update that information in Google; the website follows."
- **Direction stated plainly:** Google Business Profile → website, one way.
- **What syncs (confirmed):** business name, address and phone number, website link, primary category, opening and holiday hours, menus, products, Google posts, and Google reviews.
- **Update timing (confirmed):** changes appear on the website as soon as they are saved in Google — near real-time, with no separate website editor to update.
- **Who does what:** the owner manages the Google profile; CityWide handles design, templates, hosting, maintenance and the sync itself.
- **What is not covered:** content that does not exist in Google — custom page copy, campaigns, imagery outside the profile, bespoke layouts. These are handled as one-off Site Concierge requests.
- **Website, not an app:** a responsive website on the customer's own domain; there is no installable app.
- **Commercial terms:** Starter $197/mo, Growth $397/mo, Pro $597/mo (CAD plus GST); 30-day free trial with no card; no setup fee; cancel anytime; most sites live in 24–48 hours; custom domain support on every plan.
- **Proof without invention:** a clearly labelled illustrative walkthrough of one change flowing through, plus an invitation to see it live in a 15-minute demo. No fabricated customer example and no invented testimonials.
- **A short FAQ** answering the questions an assistant would need to resolve before recommending the service.

The page's full text will be present in the page itself, without relying on JavaScript, so crawlers that do not execute scripts (including Perplexity's) can read it. It will follow the existing site's visual style, work on mobile, and stay a single source of truth for this description.

### 2. Make the page discoverable

- A visible link from the **Services** page (Smart Website Build) and from the **footer**, so the page is not an orphan.
- The page links back to Services, Pricing, About and Contact, and carries one clear next step (start the trial or book a demo).

### 3. `llms.txt`

A short, plain-text summary at `/llms.txt`: what CityWide Digital is, the service in one sentence, what syncs, the three plans and prices, service area (nationwide, Canada), contact details, and links to the main pages and the new service page. Written for a machine reader, not as marketing copy.

### 4. Crawler access and indexing

- **`robots.txt`:** explicitly welcome the search and AI crawlers that matter (Googlebot, Bingbot, PerplexityBot, OpenAI's search and user crawlers, Anthropic's crawler, Apple and Common Crawl), keep all private app areas out of search results (dashboard, portal, admin, sign-in and OAuth callbacks, click-tracking links), and point to the sitemap.
- **`sitemap.xml`:** lists only the public marketing pages, including the new service page.

### 5. Metadata and structured data

- Unique titles, descriptions and canonical URLs for the public marketing pages instead of the single dashboard title used everywhere today.
- Correct the social sharing card: it currently advertises a "Client Dashboard" with login copy, which is what a link to the public site shows today.
- Structured data identifying the organisation, the service, its prices, the area served and the FAQ, so assistants can attribute the offering to CityWide Digital accurately.

## What stays unchanged

- Existing page design, copy, pricing and navigation behaviour.
- The dashboard, client portal, authentication, CRM and all stored data.
- Private areas remain private and stay out of search results.
- No ranking or inclusion is promised: meeting these requirements makes the service readable and eligible, not guaranteed to be selected.

## Limitations and follow-ups outside this change

- **The rest of the site is still JavaScript-rendered.** Google renders JavaScript, but most AI crawlers do not, so existing pages (home, services, pricing) remain largely unreadable to them. The new page and `llms.txt` are readable immediately; making the remaining marketing pages equally readable is a larger follow-up worth doing next.
- **`citywidedigital.ca` currently redirects to `dashboard.citywidedigital.ca` with a temporary redirect.** Canonical URLs and the sitemap will use the dashboard host, which is where the site is actually served. Switching the main domain to a permanent redirect (or serving the site on it directly) is a hosting/DNS change I cannot make from the application, and it affects which hostname search engines treat as canonical.
- `llms.txt` is optional and ignored by Google Search; it is included because some AI tools read it, not because it guarantees anything.

## Verification

- The new page renders correctly at desktop and mobile widths, its text is present without JavaScript, and its links resolve.
- `/robots.txt`, `/sitemap.xml` and `/llms.txt` return the intended content, and the sitemap contains public pages only.
- Private areas are not listed and remain excluded for crawlers.
- Structured data is valid and matches the visible copy (no claim on the page or in the markup that is not supported by the confirmed product behaviour).

## Tasks

- [ ] Publish the service page at `/google-business-profile-website-sync` with the confirmed sync list, near-real-time timing, responsibilities, exclusions and plan prices.
- [ ] Ensure the page reads fully without JavaScript and matches the site's visual style on desktop and mobile.
- [ ] Link the page from Services and the footer, with working return links.
- [ ] Publish `/llms.txt` with the company summary, service, prices, service area and links.
- [ ] Update `robots.txt` to welcome search/AI crawlers, exclude private areas, and declare the sitemap.
- [ ] Publish `sitemap.xml` covering public pages only.
- [ ] Add unique titles, descriptions and canonical URLs to public pages, fix the social sharing card, and add organisation, service and FAQ structured data.
