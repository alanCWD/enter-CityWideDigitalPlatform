# CityWide Digital footer standard

This is the contract for every footer on the CityWide Digital site. Use it when adding a page, replacing a static HTML footer, or reviewing a footer that looks out of date.

The footer is not a decorative afterthought: it carries the product line, the social profiles, and the "Ask about CityWide Digital" discovery links. A footer missing those elements is incomplete.

## Source of truth

| Layer | Canonical file |
| --- | --- |
| React footer markup and content | `src/components/layout/Footer.tsx` |
| "Ask about CityWide Digital" links and prompt | `src/components/layout/AskAboutCityWide.tsx` |
| Static guide footer styles | `public/gbp-guide.css` |
| Static reference footers | `public/gbp-source-of-truth.html`, `public/gbp-local-listing.html`, `public/google-business-profile-website-sync.html`, `public/google-posts-and-local-seo.html`, `public/ai-search-local-businesses.html` |

If the site footer changes, update this document and the static guide footers in the same change. Do not create a variant footer unless it is for a genuinely different product surface, and never with a reduced link set.

## Required structure

```
footer
├── grid
│   ├── brand column (spans 2 of 5 at ≥1024px)
│   │   ├── logo
│   │   ├── one-line description
│   │   ├── contact rows (location, email, phone)
│   │   └── Ask about CityWide Digital
│   ├── Products (8 links, each with an icon)
│   ├── Company (7 links)
│   └── Guides (6 links)
└── bottom bar
    ├── copyright
    ├── social profile icons
    └── legal links (static pages only)
```

At widths below 1024px the grid becomes two columns, then one column on mobile. The brand column always comes first.

## Brand column

Exact description:

> Managed digital presence for local businesses. Connect your Google Business Profile to everything — automatically.

Contact rows, in order:

| Row | Value | Icon |
| --- | --- | --- |
| Location | Serving businesses nationwide | Map pin |
| Email | `mailto:alan@citywidedigital.ca` with visible text `alan@citywidedigital.ca` | Mail |
| Phone | `tel:+12508827378` with visible text `250-882-7378` | Phone |

Do not drop the icons or substitute plain text rows. In the React footer they are lucide icons at 14px (`w-3.5 h-3.5`). In static pages they are the `#footer-pin`, `#footer-mail` and `#footer-phone` sprite symbols.

## Ask about CityWide Digital

This is a required part of the footer. It sits under the contact rows in the brand column.

- Heading text: **Ask about CityWide Digital**
- Five assistant links, in this order: ChatGPT, Claude, Gemini, Perplexity, Grok.
- Each link opens a new tab with `target="_blank" rel="noopener noreferrer"`.
- Each link has an accessible label: `Ask {assistant} about CityWide Digital`. Static pages also set the same text as `title`.
- Icons: `/ai/chatgpt.png`, `/ai/claude.png`, `/ai/gemini.png`, `/ai/perplexity.png`, `/ai/grok.png`. Icons are decorative (`alt="" aria-hidden="true"`), 17px, inside a 32px circular bordered button, at 70% opacity and full opacity on hover/focus.
- The prefilled question must match `QUESTION` in `AskAboutCityWide.tsx`. Reuse that prompt rather than writing a shorter one; the static guide pages contain the encoded equivalent and are the reference implementation.

Gemini's app ignores `?q=`, so it is sent through Google AI Mode using `https://www.google.com/search?q=...&udm=50` (escape the ampersand as `&amp;` in HTML).

React should keep using the `AskAboutCityWide` component. Static pages use the `footer-ask` markup and CSS below.

## Products column

Always these eight products, in this order, each with an icon in front of the label and the same colour accents as the site.

| Label | Link | Icon | Accent |
| --- | --- | --- | --- |
| Google Synced Website | `/services#website-builder` | Globe | `#a8d3ff` |
| Listing Sync Pro | `/services#listing-manager` | Map pin | `#8fe1d4` |
| Social Sync Pro | `/services#social-sync` | Share | `#f5b6dc` |
| Business Online Health | `/services#online-health` | Activity | `#b5f3cf` |
| Google Coach | `/services#google-coach` | Graduation cap | `#e1cbff` |
| Inbox Pro | `/services#inbox-pro` | Inbox | `#ffd0ad` |
| Review Engine | `/services#video-reviews` | Video | `#ffc4bc` |
| Creator Campaigns | `/services#creator-campaigns` | Megaphone | `#ffe6a2` |

React classes: `footer-product` equivalent is the `footerLinks` entry with `icon` and `iconClass`. Static pages use `<a class="footer-product">` plus one of the icon classes: `website`, `listing`, `social-product`, `health`, `coach`, `inbox-pro`, `review`, `creator`. The visual size is 16px static / `h-4 w-4` React.

A product link without its icon is a regression.

## Company column

| Label | Link |
| --- | --- |
| About | `/about` |
| Crew | `/crew` |
| Pricing | `/pricing` |
| Contact | `/contact` |
| Help Center | `/about#faq` |
| Book a Demo | `https://calendly.com/alan-citywidedigital/30min` (external, new tab) |
| Partner Program | `/contact` |

Do not put Privacy Policy or Terms of Service in this column. They belong in the bottom bar on static pages.

## Guides column

All current guides, in this order:

| Label | Link |
| --- | --- |
| GBP synced websites | `/google-business-profile-website-sync.html` |
| GBP as source of truth | `/gbp-source-of-truth.html` |
| GBP local listing | `/gbp-local-listing.html` |
| Google posts and SEO | `/google-posts-and-local-seo.html` |
| AI search for local businesses | `/ai-search-local-businesses.html` |
| Inbox Pro | `/inbox` |

On a static guide page, mark that page's own link with `aria-current="page"`. In React, the same guide entry must exist even though the router page uses the shared component.

## Bottom bar

Layout: copyright left, social profiles right. Keep the bar to one line on desktop and let it wrap on mobile.

Copyright: `© {current year} CityWide Digital. All rights reserved.` The year is generated at runtime in both implementations.

Social profiles — these exact accounts, with no generic platform URLs:

| Network | URL | Icon |
| --- | --- | --- |
| Facebook | `https://www.facebook.com/citywidedigital` | Facebook |
| Instagram | `https://www.instagram.com/citywidedigital/` | Instagram |
| LinkedIn | `https://www.linkedin.com/company/citywidedigital/` | LinkedIn |
| X | `https://x.com/citywidedigita1` | X |

Rules:

- Label the network **X**, not Twitter. Use the site's geometric X mark (lucide `X` in React; `#footer-x` sprite in static pages). Do not restore the old Twitter bird.
- Every social link opens in a new tab with `rel="noopener noreferrer"`.
- Accessibility label: `CityWide Digital on {network}`.
- Circle/rounded button, 32px, 14px icon, border and muted icon colour, full-strength icon on hover.
- Static pages may keep **Privacy Policy** and **Terms of Service** links in the bottom bar ahead of the social icons. This is the only intentional difference from the React footer, and it exists so legal pages stay reachable from every static landing page.

## Static HTML implementation

Use the footer block in `public/google-posts-and-local-seo.html` as the copy-ready reference. Key points:

- The footer starts with the hidden SVG sprite (`<svg style="display:none">`) containing all product, contact, social and X symbols. Keep the symbol ids stable: `footer-globe`, `footer-share`, `footer-pin`, `footer-video`, `footer-megaphone`, `footer-activity`, `footer-cap`, `footer-inbox`, `footer-mail`, `footer-phone`, `footer-facebook`, `footer-instagram`, `footer-linkedin`, `footer-x`.
- Product icons are `<svg class="{colour class}" viewBox="0 0 24 24"><use href="#footer-{name}"/></svg>`.
- The ask block is `<div class="footer-ask">` with the heading `<p>` and a `<ul>` of icon links.
- Styles live in `public/gbp-guide.css`. If a static page carries its own inline footer CSS (the GBP-synced websites page does), add the same `.footer-ask` rules there.
- Guide links use the `.html` twin paths in both the app footer and static pages; Inbox Pro uses `/inbox`.
- Keep the footer outside `<main>` and keep the existing JSON-LD block below it intact.

Required CSS hooks:

```css
.footer-product { display: inline-flex; align-items: center; gap: 0.625rem; }
.footer-product svg { width: 16px; height: 16px; flex-shrink: 0; }
.footer-product .website { color: var(--product-website-icon); }
.footer-product .listing { color: var(--product-listing-icon); }
.footer-product .social-product { color: var(--product-social-icon); }
.footer-product .health { color: #b5f3cf; }
.footer-product .coach { color: #e1cbff; }
.footer-product .inbox-pro { color: #ffd0ad; }
.footer-product .review { color: #ffc4bc; }
.footer-product .creator { color: #ffe6a2; }

.footer-ask { margin-top: 1.75rem; }
.footer-ask ul { display: flex; flex-wrap: wrap; gap: 0.625rem; margin: 0.75rem 0 0; padding: 0; }
.footer-ask a { width: 2rem; height: 2rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; }
.footer-ask img { width: 17px; height: 17px; object-fit: contain; opacity: 0.7; }
```

## Review checklist

- [ ] Brand column has logo, description, all three contact rows with icons, and the Ask block.
- [ ] All five assistant icons are present, link correctly, and open in a new tab.
- [ ] All eight products are present with icons and correct accent colours.
- [ ] Company column matches the seven-link list; no legal links in it.
- [ ] Guides column lists all six entries, with `aria-current="page"` on the current static guide.
- [ ] Social links use the four CityWide profiles above.
- [ ] X is labelled X and uses the geometric X mark; no Twitter bird or generic platform URLs.
- [ ] Privacy Policy and Terms of Service remain reachable from static pages.
- [ ] Footer appears on every public page, including all `.html` guide twins.
- [ ] Links and icon assets resolve; HTML has no unclosed tags.

## When the site footer changes

1. Update `Footer.tsx` (and `AskAboutCityWide.tsx` if the prompt or assistants change).
2. Copy the resulting structure into all static guide footers.
3. Update this document and the content tables above.
4. Check all five static guide pages, not just the one you started from.
