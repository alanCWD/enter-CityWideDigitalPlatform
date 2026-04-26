# CityWide Digital — Phase 1 Build Plan

## Context
Building a professional B2B digital agency marketing website for **CityWide Digital** — an SMB-focused SaaS platform that sells managed digital presence tools (GMB-integrated websites, social sync, listing management, video reviews, etc.). This is a public marketing/conversion site. The dashboard and tool apps are Phase 2+.

The current workspace is a blank React + Vite + Tailwind + shadcn project. All UI components exist in `src/components/ui/`.

---

## Phase 1 Deliverables
- Full multi-page public marketing website (5 pages + shared layout)
- Complete design system overhaul (tokens, typography, gradients)
- Product showcase for 5 tools
- Pricing page with tiers
- Lead capture / contact form
- Responsive mobile nav

**NOT in Phase 1:** Dashboard app, tool apps, white-label portal, backend/auth (Supabase).

---

## Design System

### Brand Tokens (update `src/index.css`)
```css
/* Primitive Colors */
--color-primary-100: #EEF1FA;
--color-primary-500: #1B2A4A;
--color-primary-900: #0A1120;
--color-accent-100:  #E0F0FF;
--color-accent-500:  #0078D7;
--color-accent-900:  #00447A;
--color-neutral-100: #F8F9FC;
--color-neutral-500: #737B8C;
--color-neutral-900: #14161D;

/* Semantic Tokens mapped to Tailwind CSS vars */
--background:       220 4% 98%;         /* #F8F9FC */
--foreground:       220 8% 11%;         /* #14161D */
--primary:          212 100% 42%;       /* #0078D7 — electric blue */
--primary-foreground: 0 0% 100%;
--secondary:        230 42% 18%;        /* #1B2A4A — navy */
--secondary-foreground: 230 38% 96%;    /* #EEF1FA */
--muted:            220 4% 96%;
--muted-foreground: 220 9% 48%;         /* #737B8C */
--accent:           212 100% 94%;       /* #E0F0FF — light blue */
--accent-foreground: 212 100% 42%;

/* Custom Tokens */
--nav-bg:           220 73% 8%;         /* #0A1120 — dark nav */
--hero-gradient:    linear-gradient(135deg, #0A1120 0%, #1B2A4A 55%, #00447A 100%);
--cta-gradient:     linear-gradient(90deg, #00447A 0%, #0078D7 100%);
--card-shadow:      0 8px 28px rgba(20, 22, 29, 0.10);
--card-shadow-hover: 0 12px 36px rgba(0, 120, 215, 0.18);
```

### Typography
- Font: `Inter` (via `@fontsource/inter` or Google Fonts CDN in `index.html`)
- Display: 56px/800, Hero headlines: 48px/700, Section heads: 30px/700, Cards: 22px/600

---

## File Structure to Create

### Layout Components
```
src/components/layout/
  Layout.tsx          — wraps all marketing pages (Nav + children + Footer)
  Navbar.tsx          — sticky dark nav, mobile hamburger drawer
  Footer.tsx          — 4-col links, trust badges, social icons, copyright
```

### Marketing Section Components
```
src/components/marketing/
  HeroSection.tsx     — gradient bg, headline, subhead, dual CTAs, trust badge row
  StatsBar.tsx        — "2,400+ businesses · 98% uptime · 5-star support" bar
  ProblemSolution.tsx — 2-col: "The Problem" / "The CityWide Solution"
  FeatureGrid.tsx     — 3×2 icon cards (6 features)
  HowItWorks.tsx      — 3-step visual (connect GMB → pick niche → go live)
  ProductCards.tsx    — horizontal scroll / grid of 5 product service cards
  TestimonialSection.tsx — 3 testimonial cards + star ratings
  PricingPreview.tsx  — 3 tier pricing cards (teaser on Home, full on /pricing)
  NicheShowcase.tsx   — tabs: Restaurant / Contractor / Retail — shows relevant GMB fields
  CTABanner.tsx       — full-width gradient "Ready to grow?" banner
```

### Pages
```
src/pages/
  Home.tsx            — assembles all marketing sections
  Services.tsx        — 5 detailed product cards with feature lists
  Pricing.tsx         — full 3-tier table + add-on + FAQ accordion
  About.tsx           — mission, story, team grid, values
  Contact.tsx         — lead form (name, business, email, phone, niche dropdown) + booking CTA
```

### Router Update
```
src/router.tsx        — add routes: /, /services, /pricing, /about, /contact
```

---

## Page Details

### Home (`/`)
Sections in order:
1. `Navbar`
2. `HeroSection` — headline: "Your Business Runs Itself Online" / sub: "CityWide Digital connects your Google Business Profile to a live website, all your social channels, and every major directory — automatically."
3. `StatsBar` — 3 stats: "2,400+ SMBs served", "40+ directory listings synced", "100% auto-updated websites"
4. `ProblemSolution` — left: outdated sites/manual posts/wrong listings; right: GMB-synced, one-click social, listing manager
5. `FeatureGrid` — 6 icons: Auto-updating Sites, Social Sync, Listing Accuracy, Video Reviews, Niche Templates, White-Glove Support
6. `HowItWorks` — Step 1: Connect GMB; Step 2: Choose Niche Template; Step 3: Launch & Forget
7. `NicheShowcase` — tabbed demo of Restaurant / Contractor / Retail data flows
8. `ProductCards` — brief cards for 5 products with price and CTA
9. `TestimonialSection`
10. `PricingPreview` — 3 tier cards, "Most Popular" badge on Growth
11. `CTABanner` — "Start your free 30-day trial"
12. `Footer`

### Services (`/services`)
- Page hero with title
- 5 `ServiceDetailCard` components (expanded version with feature lists):
  1. **Smart Website Builder** — GMB sync, niche templates, menu/products/services auto-pull, SEO-ready, $97–197/mo
  2. **Social Sync Pro** — post once on GMB → auto-publishes to FB, Instagram, X, LinkedIn, $47/mo
  3. **Listing Manager** — sync to 40+ directories (Yelp, Apple Maps, Bing, etc.), powered by Yext partnership, $79/mo
  4. **Video Review Engine** — SMS/email review requests → video testimonials → auto-embed on site, $37/mo
  5. **Site Concierge** — AI chatbot for a-la-carte site changes, pay-per-modification
- CTA to Pricing

### Pricing (`/pricing`)
- 3-tier pricing table:
  - **Starter** ($97/mo): Website Builder + 1 niche template + GMB sync
  - **Growth** ($197/mo, featured): Starter + Social Sync + Listing Manager
  - **Pro** ($297/mo): Growth + Video Reviews + Site Concierge credits
- Add-on section: Site Concierge ($15/mod), Extra Listings ($29/mo)
- FAQ accordion (10 questions)
- Bottom CTA

### About (`/about`)
- Mission statement hero
- 2-col story section
- Values grid (4 values with icons)
- Team placeholder grid

### Contact (`/contact`)
- Split layout: form (left) + info (right)
- Form fields: Full Name, Business Name, Email, Phone, Business Type (dropdown: Restaurant/Contractor/Retail/Other), Message
- "Or book a call" CTA linking to external calendar
- Address / hours / support email

---

## Component Enhancement
- `src/components/ui/button.tsx` — add `primary`, `ghost-dark`, `cta` variants
- `src/components/ui/badge.tsx` — add `featured`, `trust` variants
- `src/components/ui/card.tsx` — add `feature`, `pricing`, `testimonial` variants

---

## Key Technical Decisions
- **Routing**: React Router (already installed), all routes added to `src/router.tsx`
- **Icons**: `lucide-react` (already installed)
- **Fonts**: Add Inter via CDN link in `index.html`
- **No backend**: All content is static/hardcoded (Supabase for Phase 2)
- **Animations**: CSS transitions + Tailwind `transition` classes (no extra library)
- **Images**: Use `https://placehold.co` for placeholder images; real photos in Phase 2

---

## Files to Modify
| File | Action |
|------|--------|
| `src/index.css` | Full design token overhaul |
| `tailwind.config.ts` | Add brand color extensions |
| `index.html` | Add Inter font CDN link |
| `src/router.tsx` | Add all page routes |
| `src/pages/Index.tsx` | Replace with Home page |

## New Files to Create
- `src/components/layout/Layout.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/marketing/HeroSection.tsx`
- `src/components/marketing/StatsBar.tsx`
- `src/components/marketing/ProblemSolution.tsx`
- `src/components/marketing/FeatureGrid.tsx`
- `src/components/marketing/HowItWorks.tsx`
- `src/components/marketing/ProductCards.tsx`
- `src/components/marketing/TestimonialSection.tsx`
- `src/components/marketing/PricingPreview.tsx`
- `src/components/marketing/NicheShowcase.tsx`
- `src/components/marketing/CTABanner.tsx`
- `src/pages/Home.tsx`
- `src/pages/Services.tsx`
- `src/pages/Pricing.tsx`
- `src/pages/About.tsx`
- `src/pages/Contact.tsx`

---

## Build Order (Execution Sequence)
1. Update design tokens (`index.css`, `tailwind.config.ts`, `index.html`)
2. Enhance UI components (`button.tsx`, `card.tsx`, `badge.tsx`)
3. Build `Layout`, `Navbar`, `Footer`
4. Build all marketing section components (batch)
5. Assemble `Home.tsx` page
6. Build `Services.tsx`, `Pricing.tsx`, `About.tsx`, `Contact.tsx`
7. Update `router.tsx`
8. Run lint, fix errors

---

## Verification
- All 5 routes load without errors
- Mobile nav opens/closes correctly
- Pricing cards display all 3 tiers
- Contact form renders all fields
- No hardcoded color classes (only semantic tokens)
- No emoji in UI
- Lint passes clean
