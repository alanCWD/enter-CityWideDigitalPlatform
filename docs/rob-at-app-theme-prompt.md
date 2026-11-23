# Prompt — Build the Rob@ App in the CityWide Digital Theme

Paste everything below the line into the agent building the Rob@ app.

---

You are building **Rob@**, the CityWide Digital agentic helpbot app: the first voice a business owner meets, the thing that answers questions, books the demo, and hands the crew a clear brief. It is one app in the CityWide Digital bundle, not a separate company and not a new brand.

Your job is to make it look and read like the live CityWide Digital site (citywidedigital.ca) without re-inventing anything. Copy the values below exactly. Do not substitute "close enough" colours, fonts, spacings or logo treatments. If something is not covered here, pick the nearest value in this document — never introduce a new brand colour, font, radius or icon style.

Stack: React + Vite + Tailwind + shadcn/ui.

---

## 1. Brand facts

- Brand name: **CityWide Digital** — one word "CityWide", always followed by "Digital". Never "CityWide", never "CWD".
- Positioning line: *"Managed digital presence for local businesses. Connect your Google Business Profile to everything — automatically."*
- Serving area: nationwide (Canada). Contact: alan@citywidedigital.ca · 250-882-7378.
- The app is **Rob@**, titled "Agentic Helpbot · Rob At". Its personality is an aspiring actor with a titanium ego, moonlighting as the helpbot. That wit lives in the *copy*, never in the visual design: the interface stays calm, restrained and high-contrast.
- Attribution: the app refers to itself as part of the CityWide Digital bundle ("Rob@ is part of the CityWide Digital bundle"). It never presents itself as an independent company.
- Spelling: Canadian English — *licence*, *colour*, *centre*, *favour*, *honour*, *cancelled*, *organize* / *realize*. Use em dashes, not hyphens or pipes, in titles. No exclamation marks in interface copy.
- Title pattern: `Rob@ — CityWide Digital`. Site name is always "CityWide Digital".

## 2. Logo

- Use the official wordmark `cwd-logo.png` (orange "DIGITAL", navy "CityWide"). Download it into `public/` and serve it from the app's own domain. Do not redraw, recolour, crop or re-export it.
- On dark surfaces apply a brightness lift so the navy stays legible: `filter: brightness(1.6) saturate(1.1)`.
- Heights: 20px / 24px / 32px / 48px for xs / sm / md / lg. The header uses ~35px on the dark shell; the footer uses 32px.
- Favicon and Open Graph card: reuse the live CityWide assets. Never ship a Rob@ wordmark of your own.

## 3. Colour and materials

The default surface is the **dark glass theme**: a near-black canvas, a slow aurora wash, fine grain, and translucent blurred panels. Never a flat grey dashboard.

Core values:

| Token | Value |
| --- | --- |
| Canvas | `#05070a` |
| Ink (primary text) | `#f2f5fa` |
| Ink at 72% / 55% / 40% / 24% | same ink, alpha `0.72` / `0.55` / `0.4` / `0.24` |
| Accent blue | `#6ea8ff` |
| Ice (link / tint text) | `#cfe2ff` |
| Hairline | `rgba(255,255,255,0.07)` |
| Panel line | `rgba(255,255,255,0.12)` |

Legacy brand colours, used sparingly for product identity and the light signed-in surface:

| Token | Value |
| --- | --- |
| Navy | `#0A1120` |
| Navy mid | `#1B2A4A` |
| Electric blue (light-mode CTA) | `#0078D7` (`hsl(212 100% 42%)`) |
| Blue dark | `#00447A` |
| Blue light | `#E0F0FF` |
| Hero gradient | `linear-gradient(135deg, #0A1120 0%, #1B2A4A 55%, #00447A 100%)` |
| CTA gradient | `linear-gradient(90deg, #00447A 0%, #0078D7 100%)` |

Aurora wash (fixed, behind everything, never scrolls away) — five soft radial gradients in blue and ice, roughly:

```
radial-gradient(820px 560px at 8% -8%, rgba(78,141,255,0.34), transparent 62%),
radial-gradient(680px 520px at 94% 2%, rgba(118,222,255,0.16), transparent 60%),
radial-gradient(760px 620px at 12% 46%, rgba(86,132,255,0.16), transparent 66%),
radial-gradient(700px 560px at 92% 58%, rgba(122,158,255,0.13), transparent 66%),
radial-gradient(900px 700px at 50% 112%, rgba(104,110,255,0.22), transparent 64%)
```

Add a fine fractal-noise grain over it (`opacity: 0.35`, `mix-blend-mode: overlay`) so the glass reads as material rather than a flat gradient.

Glass recipe — use it for every panel, card and surface:

```
background: linear-gradient(158deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.045) 48%, rgba(255,255,255,0.02) 100%);
border: 1px solid rgba(255,255,255,0.17);
border-radius: 20px;
backdrop-filter: blur(22px) saturate(150%);
box-shadow: 0 28px 70px -32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.16);
```

Variants: a **soft** panel (`white 0.07 → 0.022`, hairline border, smaller shadow) and a **feature** panel (blue-tinted border, blue outer glow, `inset 0 1px 0 rgba(255,255,255,0.24)`). Hovering a panel lifts it 3px over 350ms and brightens the border to `rgba(160,200,255,0.34)`.

One accent rule: blue is for links, focus rings, kickers in tables and the active state. It is never a large background block, and there is never a second accent colour on the dark surface.

Signed-in screens may use the light token set instead: background `hsl(220 20% 98%)`, foreground `hsl(220 8% 11%)`, card white, primary `hsl(212 100% 42%)`, muted `hsl(220 14% 95%)`, border `hsl(220 13% 88%)`, radius `0.625rem`. Never mix the two on one screen.

## 4. Typography

Two families, loaded from Google Fonts: **Inter** (300–800) and **IBM Plex Mono** (400–500). Body default is Inter with system fallbacks.

- **Display** — Inter weight 200 on dark glass (300 on the cinematic landing surface), letter-spacing `-0.035em`, line-height `1.02`, `text-wrap: balance`. Large, light and quiet; never bold headlines.
- **Lede** — Inter 300, line-height `1.65`, ink at 72%, max ~65 characters per line.
- **Body** — Inter 300, line-height `1.75`, ink at 72%.
- **Kicker / eyebrow** — IBM Plex Mono 10px, uppercase, letter-spacing `0.24em`, ink at 38%. This is the app's signature detail: every section opens with a mono kicker above the headline.
- **Micro labels** — IBM Plex Mono 9–10px, uppercase, letter-spacing `0.18em`–`0.24em`, ink at 24–55%.
- **Links** — ice `#cfe2ff` with a `rgba(207,226,255,0.28)` bottom border that brightens to white on hover.

## 5. The page shell

Every page renders inside the same shell: fixed nav on top, footer at the bottom.

**Nav bar**
- Fixed, full width, `z-50`, height 72px, max content width 1400px with 24px side padding on mobile and 40px from md up.
- Background `rgba(5,7,10,0.45)` with `backdrop-filter: blur(12px)` and a bottom border of `rgba(255,255,255,0.05)`. After 16px of scroll it becomes `rgba(5,7,10,0.85)` with a `rgba(255,255,255,0.10)` border, over 300ms.
- Wordmark left at ~35px, links centred-right with 28px gaps, then the CTAs.
- Nav links: IBM Plex Mono 10px, uppercase, letter-spacing `0.2em`, ink at 55%; hover and current page go to full ink. No underlines, no pills, no background on hover.
- Right side: a plain-text "Book a demo" link (opens Calendly in a new tab) plus one bordered CTA "Start Trial".
- The bordered CTA: IBM Plex Mono 10px uppercase `0.2em`, padding `0.55rem 0.95rem`, radius 2px, border `rgba(255,255,255,0.34)`, background `rgba(255,255,255,0.06)`, white text; hover raises the border to 55% white and the fill to 14%.
- Include the shared profile menu (avatar/sign-in) at the far right if the app has accounts.
- Mobile: profile menu plus a hamburger. The drawer slides in from the right at 288px wide, background `#05070a`, left border `rgba(255,255,255,0.10)`, padding 24px with 80px top inset, links stacked as 10px mono uppercase rows separated by hairlines, and the two CTAs full width at the bottom over a dark 60% backdrop. Close it on route change.

**Menu**
Primary links, in this order: Services · Pricing · About · Crew · Contact. Use the label "Crew" for the people page. Link only pages that are live in the Rob@ app — never add a nav item to a route that does not exist, and never rebuild the CityWide dashboard navigation inside the app.

**Footer**
- Background `#05070a`, top border `rgba(255,255,255,0.10)`, content max 1400px, 64px vertical padding (80px from md up).
- Five-column grid: brand column spanning two, then **Products**, **Company**, **Guides**. 48px gaps, 48px below the grid.
- Brand column: wordmark at 32px, then the positioning line in 14px Inter 300 at 55% ink (max ~320px wide), then three rows with 14px lucide icons in ice: "Serving businesses nationwide", `alan@citywidedigital.ca`, `250-882-7378` (mail and phone are links). Keep these details real or omit them — never invent a phone number or address.
- Then the **"Ask about CityWide Digital"** row: a 14px label, and a row of 32px circular 1px-border buttons, one per AI assistant (ChatGPT, Claude, Gemini, Perplexity, Grok), each opening that assistant with a pre-written question about CityWide. Icons at 17px, 70% opacity, full on hover.
- Column headings: IBM Plex Mono 9px uppercase, letter-spacing `0.24em`, ink at 24%.
- Column links: 13px, ink at 55%, going to full ink on hover, 10px vertical rhythm.
- Products column, each link with a 16px lucide icon in its own colour, 1.5 stroke, 10px gap: Google Synced Website (`#a8d3ff`, globe), Listing Sync Pro (`#8fe1d4`, map pin), Social Sync Pro (`#f5b6dc`, share), Business Online Health (`#b5f3cf`, activity), Google Coach (`#e1cbff`, graduation cap), Inbox Pro (`#ffd0ad`, inbox), Review Engine (`#ffc4bc`, video), Creator Campaigns (`#ffe6a2`, megaphone). These product colours belong to the icons only — never to panels, buttons or text.
- Company column: About, Crew, Pricing, Contact, Help Center, Book a Demo (external, new tab), Partner Program.
- Guides column: the free guide pages, plus the app's own landing page.
- Bottom bar: hairline above, 32px padding, copyright "© {year} CityWide Digital. All rights reserved." in 9px mono at 24% ink, and 32px circular social buttons (Facebook, Instagram, LinkedIn, Twitter) in ink at 40%, going to full ink and a 30% white border on hover.

## 6. Components

- **Buttons, solid** — near-white fill (`rgba(255,255,255,0.94)`), 1px `rgba(255,255,255,0.85)` border, radius 12px, `#06080c` text, IBM Plex Mono 10px uppercase `0.2em`, padding `0.95rem 1.6rem`. Hover: pure white, lift 1px. This is the only high-emphasis action on a screen.
- **Buttons, ghost** — transparent over `rgba(255,255,255,0.07)`, `rgba(255,255,255,0.22)` border, ink at 86%; hover raises fill to 0.09 and border to 0.28.
- **Filled primary (light surfaces)** — electric blue background, white text, radius `0.625rem`, subtle blue shadow, hover to `#00447A` with a 1px lift.
- **Chips** — pill, 1px hairline, `rgba(255,255,255,0.045)` fill, 9px mono uppercase `0.16em` at 55% ink. An accent chip uses a `rgba(158,193,255,0.4)` border and ice text.
- **Icon tiles** — 36px square, 1px line, radius 12px, ice-coloured 16px lucide icon.
- **Forms** — inputs on `rgba(255,255,255,0.045)` with a `rgba(255,255,255,0.14)` border and ink text; placeholders at 32%; labels at 55%. Focus: `rgba(158,193,255,0.55)` border plus a 3px `rgba(110,168,255,0.16)` glow. Select options need a dark `#0a1220` background.
- **Tables** — no outer border; 9px mono uppercase headers at 38% ink, 14px body at 72%, hairline row separators, a faint white tint on row hover, and group rows in accent blue over a `rgba(110,168,255,0.07)` fill.
- **Accordions** — hairline separated, 10px mono triggers, open state at pure white.
- Icons: **lucide-react only**, 1.5 stroke, 16–20px. No emoji anywhere.
- Motion: 200ms for colour and border, 350ms for panel lift, nothing longer. Respect `prefers-reduced-motion` by collapsing all animation and transition durations.

## 7. Page rhythm

- Content shell: max width 1240px, centred, 24px side padding on mobile, 40px from md up.
- Hero: 120px top / 56px bottom padding on mobile, 168px / 80px from md up.
- Sections: 72px vertical padding on mobile, 104px from md up, each separated by a 1px hairline at 7% white. No alternating background blocks — separation comes from hairlines and glass panels, not stripes.
- Every section opens the same way: mono kicker, then a light display headline, then an ink-72 lede capped at ~65 characters per line.
- Closing band: one feature panel or a full-width CTA strip with a single solid button and one ghost button.
- Focus states: a 1px `#6ea8ff` outline at 4px offset (or a 2px blue ring), never removed.
- Quote the *shape* of the Rob@ story — first contact, questions answered, demo booked, brief handed over — but keep the layout language identical to the rest of the site. Do not add a chat-bubble aesthetic, neon glow, gradient text or 3D blobs to signal "AI".

## 8. Guardrails

- No new brand colours, fonts, radii or logo treatments. No green "success" buttons or purple AI gradients.
- No custom one-off styles in components: everything comes from the design tokens above.
- Only link live pages; no placeholder routes and no "coming soon" links in nav or footer.
- Never show a fake booking, payment or message-sent confirmation. If the backend is not connected, disable the action and label it as not yet connected.
- Keep one `h1` per page, matching the page, not the brand. `lang="en-CA"`. Description 140–160 characters, no keyword stuffing.
- Accessibility: contrast at least 4.5:1 for body text, visible focus everywhere, 44px minimum touch targets, drawer and dialogs close with Escape.
- The app must feel like the same product with a new front desk — not a new brand wearing CityWide colours.
