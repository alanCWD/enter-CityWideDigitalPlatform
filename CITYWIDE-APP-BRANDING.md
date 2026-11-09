# CityWide Digital — Brand & Theme Handoff

**Version 1.0 · 9 November 2026**
For the product agents building **Review Engine**, **Google Search Coach**, **Business Online Health**, and any future app in the CityWide Digital bundle.

---

## 0. How to use this file

You are building a separate app that must look and read like part of the CityWide Digital family. This file is the single source of truth for that.

- Use the **exact values** below. Do not substitute "close enough" colours, fonts or assets.
- If something is genuinely not covered here, choose the nearest established token in this file — do not introduce a new brand colour, font, logo treatment or icon style.
- Build the app's own screens. Do not rebuild the dashboard's navigation inside the app, and do not link to pages that are not live.
- Keep the tone in section 9. The app is customer-facing; every screen is part of the same product.

The stack these values assume is React + Vite + Tailwind + shadcn/ui, which is what the CityWide dashboard and marketing site use.

---

## 1. Brand facts

| Item | Value |
| --- | --- |
| Brand name | **CityWide Digital** (one word "CityWide", always with "Digital") |
| Parent product | CityWide Digital — managed digital presence for local businesses |
| Main site | `https://citywidedigital.ca` |
| Dashboard | `https://dashboard.citywidedigital.ca` |
| Positioning line | "Managed digital presence for local businesses. Connect your Google Business Profile to everything — automatically." |
| Serving area | Nationwide |
| Contact | alan@citywidedigital.ca · 250-882-7378 |
| Social handle | `@CityWideDigital` |

**Bundle product names** (use these spellings and capitalisation exactly):

- Website Builder
- Social Sync Pro
- Listing Sync Pro
- Review Engine
- Site Concierge

**Apps covered by this handoff:** Review Engine, Google Search Coach, Business Online Health.

**Attribution.** A standalone app refers to itself as an app by CityWide Digital in the footer or About area, for example "Review Engine is part of the CityWide Digital bundle." It never presents itself as an independent company, and it never uses a different brand name in the interface.

**Spelling.** Canadian English throughout: *licence* (noun), *colour*, *centre*, *favour*, *honour*, *neighbour*, *cancelled*, *realize* / *organize* (with -ize). Keep "Google Business Profile" spelled out on first mention.

---

## 2. Asset kit

| Asset | File | Live URL | Size | Use |
| --- | --- | --- | --- | --- |
| Wordmark (transparent PNG) | `cwd-logo.png` | `https://dashboard.citywidedigital.ca/cwd-logo.png` | 3447 × 1200 | Header, footer, auth screens, print |
| Favicon master (transparent PNG) | `favicon.png` | `https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100027458/1a09fdc1-9c34-4c.png` | 144 × 144 | Browser tab, bookmark, home-screen icon |
| Legacy favicon | `favicon.ico` | `https://dashboard.citywidedigital.ca/favicon.ico` | multi-size `.ico` | Older browsers only |
| Open Graph / social card | `citywide-og-v4.png` | `https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100027458/citywide-og-v4_010a8a83.png` | 1392 × 752 | Link previews everywhere |

All assets are live and publicly reachable. **Download each one into the new app's `public/` folder and serve it from your own domain.** Do not redesign, recolour, re-export or "clean up" any of them.

### 2.1 Favicon

- It is the **official bundle icon**: the tight two-line lockup — navy "CityWide" above orange "DIGITAL" — on a transparent background.
- Save the 144 px master linked above as `public/favicon.png`. Do not use the 40 px copy that sits inside the dashboard repo, and provide `public/favicon.ico` only as a legacy fallback if you already ship one.
- Every app in the bundle uses this **same** icon. Do not make an app-specific monogram, do not substitute a Lucide glyph, and never leave the default Vite icon in place.
- The wordmark is small at tab size; that is accepted. Do not strip "DIGITAL" to make it bigger.
- Also set the browser chrome colour to the deep navy `#0A1120` (see the head block in section 3).

### 2.2 Wordmark

- Navy **#274F72** and orange **#F15C1A** on a transparent background. Those two values are the logo; they are not interface colours.
- On deep navy surfaces, brighten the wordmark with `filter: brightness(1.6) saturate(1.1);` so the navy strokes separate from the background. On white or near-white surfaces, use the file untouched.
- Minimum height: **20 px** in dense UI, **32 px** in a header, **48 px** in a hero or auth panel.
- Clear space on all sides: at least **half the wordmark's height**. Nothing — text, rules, buttons, badges — enters that space.
- Never: recolour it, invert it to flat white, outline it, add a glow or drop shadow, stretch it, crop it, rotate it, place it on photography or on an orange/blue field, or lock it up with another company's logo.
- The "CityWide" line carries the name and the "DIGITAL" line completes the lockup. Do not split or restyle them, and do not retype the brand name in a display font as a substitute for the logo.

### 2.3 Open Graph image

- A light social card: white-to-mist background, centred wordmark, navy headline, grey subtitle. The live master reads **"Client Dashboard"** with the subtitle "Manage your website, reviews & local presence".
- **Links to the dashboard:** use the master as it is.
- **A standalone app's own link previews:** keep the template identical — same lockup, same position and scale, same light background, same type weights, same grey subtitle tone — and change the headline to the app's name and the subtitle to its one-line promise. Do not invent a new layout, colour scheme or logo treatment for a social card.
- Declare the image's real size, **1392 × 752**, in the meta tags. Do not declare 1200 × 630 for this file.
- Never use a screenshot, a stock photo or AI-generated artwork as the social card.

---

## 3. `index.html` head template

Replace the three placeholders: `APP_NAME`, `APP_DESCRIPTION`, `APP_URL`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/favicon.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0A1120" />
  <meta name="author" content="CityWide Digital" />

  <title>APP_NAME — CityWide Digital</title>
  <meta name="description" content="APP_DESCRIPTION" />
  <link rel="canonical" href="APP_URL" />

  <meta property="og:site_name" content="CityWide Digital" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_CA" />
  <meta property="og:title" content="APP_NAME — CityWide Digital" />
  <meta property="og:description" content="APP_DESCRIPTION" />
  <meta property="og:url" content="APP_URL" />
  <meta property="og:image" content="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100027458/citywide-og-v4_010a8a83.png" />
  <meta property="og:image:width" content="1392" />
  <meta property="og:image:height" content="752" />
  <meta property="og:image:alt" content="CityWide Digital" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@CityWideDigital" />
  <meta name="twitter:title" content="APP_NAME — CityWide Digital" />
  <meta name="twitter:description" content="APP_DESCRIPTION" />
  <meta name="twitter:image" content="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100027458/citywide-og-v4_010a8a83.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
</head>
```

Rules:

- **Title pattern:** `App Name — CityWide Digital`. Keep it under about 60 characters. Use an em dash, not a hyphen or a pipe.
- **Description:** 140–160 characters, one plain sentence about the outcome, no keyword stuffing, no exclamation marks.
- **Site name is always "CityWide Digital".** Never "CityWide", never "CWD", never the app name alone.
- One `h1` per page, matching the app name. Do not put the brand name in the `h1` unless the page is About.
- Keep `lang="en"`. Allow crawlers (the parent site's `robots.txt` allows all).

---

## 4. Theme

Deep navy canvas, one electric blue call to action, cool grey surfaces, restrained orange reserved for the logo. The product is calm and high-contrast; it is not a rainbow dashboard.

### 4.1 `src/index.css` tokens

Paste this block unchanged. It is the live dashboard and marketing design system.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ── CityWide Digital Brand Tokens ── */
    --background: 220 20% 98%;
    --foreground: 220 8% 11%;

    --card: 0 0% 100%;
    --card-foreground: 220 8% 11%;

    --popover: 0 0% 100%;
    --popover-foreground: 220 8% 11%;

    /* Primary = Electric Blue CTA */
    --primary: 212 100% 42%;
    --primary-foreground: 0 0% 100%;

    /* Secondary = light blue-grey in light mode */
    --secondary: 215 25% 92%;
    --secondary-foreground: 220 8% 18%;

    --muted: 220 14% 95%;
    --muted-foreground: 220 9% 48%;

    /* Accent = Light Blue */
    --accent: 212 100% 94%;
    --accent-foreground: 212 100% 42%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 220 13% 88%;
    --input: 220 13% 88%;
    --ring: 212 100% 42%;

    --radius: 0.625rem;

    /* ── Nav Surface ── */
    --nav-bg: 220 73% 8%;
    --nav-border: 220 30% 20%;

    /* ── Custom Semantic ── */
    --surface-elevated: 0 0% 100%;
    --surface-section-alt: 230 46% 18%;
    --text-on-brand: 230 38% 96%;
    --text-subtle: 220 9% 48%;
    --success: 142 72% 44%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 45%;
    --warning-foreground: 0 0% 100%;

    /* ── Sidebar (light mode) ── */
    --sidebar-background: 0 0% 100%;
    --sidebar-foreground: 220 8% 30%;
    --sidebar-primary: 212 100% 42%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 215 25% 94%;
    --sidebar-accent-foreground: 220 8% 18%;
    --sidebar-border: 220 13% 88%;
    --sidebar-ring: 212 100% 42%;
  }

  .dark {
    --background: 220 73% 6%;
    --foreground: 230 38% 96%;
    --card: 230 46% 10%;
    --card-foreground: 230 38% 96%;
    --popover: 230 46% 10%;
    --popover-foreground: 230 38% 96%;
    --primary: 212 100% 52%;
    --primary-foreground: 0 0% 100%;
    --secondary: 230 40% 22%;
    --secondary-foreground: 230 38% 96%;
    --muted: 230 40% 16%;
    --muted-foreground: 220 20% 65%;
    --accent: 212 60% 20%;
    --accent-foreground: 212 100% 72%;
    --destructive: 0 63% 40%;
    --destructive-foreground: 0 0% 100%;
    --border: 230 30% 22%;
    --input: 230 30% 22%;
    --ring: 212 100% 52%;
    --success: 142 62% 52%;
    --success-foreground: 220 73% 6%;
    --warning: 38 92% 58%;
    --warning-foreground: 220 73% 6%;

    /* ── Sidebar (dark mode) ── */
    --sidebar-background: 220 73% 8%;
    --sidebar-foreground: 230 38% 96%;
    --sidebar-accent: 230 40% 24%;
    --sidebar-accent-foreground: 230 38% 96%;
    --sidebar-border: 220 30% 20%;
  }
}

@layer base {
  * { @apply border-border; }

  body {
    @apply bg-background text-foreground font-sans;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

### 4.2 `tailwind.config.ts`

Dark mode is class-based (`darkMode: ["class"]`), so the app must toggle `.dark` on `<html>`. Default the app to **dark**; offer a light mode only if the app already has a theme toggle.

```ts
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        brand: {
          navy: "#0A1120",
          "navy-mid": "#1B2A4A",
          blue: "#0078D7",
          "blue-dark": "#00447A",
          "blue-light": "#E0F0FF",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #0A1120 0%, #1B2A4A 55%, #00447A 100%)",
        "cta-gradient": "linear-gradient(90deg, #00447A 0%, #0078D7 100%)",
        "blue-gradient": "linear-gradient(135deg, #0078D7 0%, #00447A 100%)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
```

### 4.3 Palette quick reference

| Role | Value | Notes |
| --- | --- | --- |
| Primary / controls (`--primary`) | `hsl(212 100% 42%)` ≈ `#0064D6` light · `hsl(212 100% 52%)` ≈ `#0A7CFF` dark | The interactive blue. Use `bg-primary` / `text-primary`, not a hard-coded hex. Hover/press: `#00447A`. |
| Brand blue (accents) | `#0078D7` | CTA-gradient endpoint, active nav link on navy, links on dark surfaces. Never a second button fill. |
| Deep navy (canvas) | `#0A1120` | Hero, nav, footer, auth background |
| Navy mid | `#1B2A4A` | Gradient midpoint, raised navy surfaces |
| Light blue tint (`--accent`) | `hsl(212 100% 94%)` ≈ `#E0EFFF` | Selected/accent fills in light mode |
| Workspace page | `#0D1526` | Dashboard dark page background |
| Workspace card | `#111E33` | Dark cards and panels |
| Workspace raised | `#15243F` | Hover/active dark surface |
| Workspace ink | `#EEF1FA` | Primary dark-mode text |
| Wordmark navy | `#274F72` | Logo only — never UI text or buttons |
| Wordmark orange | `#F15C1A` | Logo only — never UI accents, badges or alerts |
| Success (`--success`) | `hsl(142 72% 44%)` ≈ `#1FC15B` light · `hsl(142 62% 52%)` ≈ `#39D070` dark | Pass states. `#22C55E` is the positive-delta accent. |
| Warning (`--warning`) | `hsl(38 92% 45%)` ≈ `#DC8F09` light · `hsl(38 92% 58%)` ≈ `#F6AE31` dark | Caution, incomplete data |
| Destructive (`--destructive`) | `hsl(0 84% 60%)` light · `hsl(0 63% 40%)` dark | Errors and destructive actions only |

Rule: **one blue family.** Controls use `--primary`; `#0078D7` is the accent inside gradients and active links. Do not add a third blue, shift the hue, or introduce purple, teal, indigo or neon gradients. Status colours are the only other hues, and they are for status, not decoration.

Light workspace mapping (used when `.theme-light` is active in the dashboard):

| Surface | Light value |
| --- | --- |
| Page | `#F4F6FB` |
| Card | `#FFFFFF` |
| Elevated / sidebar | `#F8FAFD` |
| Border | `#E2E8F0` |
| Strong text | `#0D1526` |
| Muted text | `rgba(13,21,38,0.62)` |
| Faint text | `rgba(13,21,38,0.42)` |
| Active accent | `#0078D7` (unchanged) |

### 4.4 Gradients and shadows

```css
.hero-gradient { background: linear-gradient(135deg, #0A1120 0%, #1B2A4A 55%, #00447A 100%); }
.cta-gradient  { background: linear-gradient(90deg, #00447A 0%, #0078D7 100%); }

.card-shadow       { box-shadow: 0 4px 20px rgba(20, 22, 29, 0.08); }
.card-shadow-hover { box-shadow: 0 12px 36px rgba(0, 120, 215, 0.18); }
```

- Use the hero gradient **once per page at most** — hero or auth panel, not both.
- Primary buttons carry a blue shadow: `0 2px 8px rgba(0,120,215,0.28)` at rest, `0 4px 14px rgba(0,120,215,0.38)` on hover.
- Glass panels (workspace only): `0 28px 70px -32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.16)`.
- No coloured glows, no neumorphism, no heavy drop shadows on text.

### 4.5 Typography

- **Inter** — every piece of interface text. Available weights 300–800.
- **IBM Plex Mono** — small uppercase labels ("kickers"), IDs, counters, code. Not body copy, not headings.

| Element | Spec |
| --- | --- |
| Page title (`h1`) | Inter 700, 20–24 px, tight leading |
| Section title (`h2`) | Inter 700, 16–18 px |
| Card title | Inter 600–700, 14–16 px |
| Body | Inter 400, 14–16 px, line-height 1.6 |
| Small / meta | Inter 400–500, 12–13 px, muted |
| Kicker | IBM Plex Mono 400, 10–11 px, uppercase, letter-spacing `0.24em` |
| Metrics | Inter 700–800; keep numerals tabular where comparison matters |
| Marketing display | Inter 300, letter-spacing `-0.035em`, line-height `1.02` |

Sentence case for headings and buttons ("Start free trial", not "Start Free Trial" in prose contexts). Uppercase is reserved for mono kickers and small table headers with tracking.

### 4.6 Radii, spacing, motion

- Base radius `0.625rem` (10 px). Inputs and buttons `rounded-lg`; cards `rounded-xl`; glass panels 20 px; pills fully round.
- Spacing: 4 px base. Screen padding 24 px. Section gaps 20–32 px. Card padding 20–24 px.
- Grid: 12 columns, 16–24 px gutters. Marketing content max-width 1200 px; wide app layouts 1400 px; dashboards full width.
- Motion: 150 ms ease for hover/press, 200 ms for panels, 500 ms fade-up for entrance. Animate opacity and small translate only (max 16 px). Respect `prefers-reduced-motion` and disable all decorative motion, including ambient backgrounds.
- Focus: `ring-2 ring-ring ring-offset-2` with visible offset on both dark and light surfaces.

---

## 5. Layout and components

### 5.1 Workspace shell

Apps opened from the dashboard should feel like the same workspace.

- Fixed left sidebar, **240 px**, `--sidebar-background` (deep navy in dark mode, white in light), 1 px border.
- Sticky top bar, ~64 px, `#0D1526` at 95% opacity with backdrop blur, bottom border `rgba(255,255,255,0.10)`. Left: page title (18 px bold) and one-line subtitle (12 px muted). Right: at most one action button plus a profile control.
- Content area: page background `#0D1526`, 24 px padding, 20 px vertical rhythm.
- The CityWide wordmark sits at the top of the sidebar (or top-left of the top bar) on every app. It links to the app's home, not away from it.
- Mobile: sidebar becomes an overlay drawer; top bar stays; no horizontal scrolling at 390 px.

If the app does not need navigation (a single-purpose tool), use a slim top bar with the wordmark and the app name — do not fake a 6-item sidebar.

### 5.2 Cards and panels

- Dark: `#111E33` background, 1 px `rgba(255,255,255,0.08)` border, `rounded-xl`, 20–24 px padding.
- Light: `#FFFFFF`, 1 px `#E2E8F0`, same radius.
- Glass variant (hero/feature panels only): translucent white at 2–11%, 17% border, 22 px blur, subtle top highlight.
- Never nest a card inside a card with the same surface; use a divider or a raised tone instead.

### 5.3 Buttons

| Variant | Spec |
| --- | --- |
| Primary | `bg-primary` fill (≈ `#0064D6` light / `#0A7CFF` dark), `--primary-foreground` text, semibold, `rounded-lg`, 44 px tall (36 px compact), 24 px horizontal padding, blue shadow, hover `#00447A` |
| CTA | `linear-gradient(90deg, #00447A, #0078D7)`, white text; hero, upgrade and checkout only |
| Secondary | `--secondary` token (light blue-grey in light mode, raised navy in dark), `--secondary-foreground` text |
| Outline | 2 px `--primary` border, transparent fill, primary text |
| Ghost | No fill; muted text; `rgba(255,255,255,0.10)` hover in dark |
| Destructive | `--destructive`; confirmation dialog required |
| Link | Blue text, underline on hover only |

Rules: **one primary button per view.** Buttons are sentence case, verb-led ("Send request", "Connect profile"), never "Click here". Disabled state is 50% opacity with `not-allowed`. No gradient buttons other than the CTA variant, and no orange buttons.

### 5.4 Forms

- Label above the field, 13 px semibold; optional helper text 12 px muted.
- Input height 40–44 px, `rounded-lg`, 1 px border, white card in light / `#111E33` in dark, 16 px text (prevents mobile zoom).
- Focus: 2 px blue ring with offset. Error: red border plus 12 px message below; never colour-only signalling.
- Placeholder text is descriptive, never a label substitute.
- One column on mobile; two columns maximum on desktop.

### 5.5 Badges and status

- Pill: 11–12 px semibold, 6 px × 10 px padding, fully rounded, tinted background at 10–15% of the status colour with the full-strength colour as text.
- Positive states use `--success`; reserve `#22C55E` for positive-delta numbers. Warning and danger use their tokens.
- Pair every colour with a word ("Connected", "Needs attention"). Never status by colour alone.
- Do not use orange for status — orange belongs to the logo.

### 5.6 Tables and lists

- Header row: 11 px uppercase muted labels with `0.08em` tracking, 1 px bottom border.
- Rows: 48–56 px, 1 px divider, hover surface `#15243F` (dark) or `#F8FAFD` (light).
- Numbers right-aligned; text left-aligned; one primary action per row, secondary actions in an overflow menu.
- On mobile, collapse to stacked rows with the name and status first — never a horizontally scrolling table for primary content.

### 5.7 Empty, loading and error states

- Empty: Lucide icon at 32–40 px in muted blue, one sentence explaining what will appear, one button to act. No illustrations, no emoji.
- Loading: skeleton blocks that match the final layout for lists and cards; a small spinner only for short actions. Never a full-page spinner for content that could show a skeleton.
- Error: plain sentence, what to do next, and a retry. No stack traces, no "Oops!".
- Never show a successful result that did not happen. If data is not connected, say so explicitly and disable the action.

### 5.8 Icons

- **Lucide React only**, 16 px inside buttons, 18–20 px in cards, 1.5–2 px stroke.
- Icons support labels; they do not replace them in primary navigation.
- **Never emoji** — not in UI, not in empty states, not in copy, not in headings.
- Do not mix icon families, use brand logos as icons, or fill icons solid.

### 5.9 Accessibility

- Body text at least 4.5:1 against its surface; large text at least 3:1. Check both themes.
- All interactive elements reachable and visible by keyboard, with the focus ring above.
- Touch targets at least 44 × 44 px.
- Images and the wordmark have meaningful `alt` text ("CityWide Digital"); decorative graphics are `aria-hidden`.
- Motion respects `prefers-reduced-motion`; nothing flashes faster than 3 Hz.

---

## 6. Logo component

Copy this into `src/components/branding/Logo.tsx`. It is the live implementation. Adjust the import alias if your project does not use `@/`.

```tsx
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const HEIGHTS = { xs: "h-5", sm: "h-6", md: "h-8", lg: "h-12" } as const;

/** Official CityWide Digital wordmark. Use on light surfaces. */
export function Logo({ size = "md", className }: LogoProps) {
  return (
    <img
      src="/cwd-logo.png"
      alt="CityWide Digital"
      className={cn(HEIGHTS[size], "w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** Wordmark tuned for deep navy surfaces. */
export function LogoOnDark({ size = "md", className }: LogoProps) {
  return (
    <img
      src="/cwd-logo.png"
      alt="CityWide Digital"
      className={cn(
        HEIGHTS[size],
        "w-auto select-none",
        "[filter:brightness(1.6)_saturate(1.1)]",
        className,
      )}
      draggable={false}
    />
  );
}
```

Use `LogoOnDark` on navy or near-black surfaces and `Logo` on white or light surfaces. If your app supports a light theme, neutralise the filter there:

```css
.theme-light img[alt="CityWide Digital"] { filter: none !important; }
```

Do not ship a second logo file, a white-only version, or an SVG redraw.

---

## 7. App identities

Each app is its own product inside one brand. The tab title and social card carry the app name first and the parent brand second.

| App | Dashboard label (alias) | Published address | Tab title |
| --- | --- | --- | --- |
| Review Engine | Review Engine | Planned: `review-engine.citywidedigital.ca` | Review Engine — CityWide Digital |
| Google Search Coach | GSO Coach | Assigned `citywidedigital.ca` subdomain at publish | Google Search Coach — CityWide Digital |
| Business Online Health | Digital Health | Assigned `citywidedigital.ca` subdomain at publish | Business Online Health — CityWide Digital |

The dashboard may keep its short sidebar labels; the app's own interface, page title and social card always use the full canonical name above. Do not mix them within a single screen.

**Domains at the time of writing:** the apps are being integrated, so not every address is live yet. Use the subdomain you actually publish on for `canonical`, `og:url` and `twitter:image`, and confirm it resolves before launch. Never ship a canonical or `og:url` pointing at a host that does not load.

### 7.1 Review Engine

- **Icon suggestion:** `Sparkles` (matches the dashboard) or `Star` for review-specific actions.
- **Description:** "Collect reviews and video testimonials by text or email, then publish the approved ones on your website automatically. A CityWide Digital app."
- **Social subtitle line:** "Turn happy customers into your best marketing"
- **Tone:** practical and reassuring. Never fabricate review counts, star ratings or customer names; sample content must be labelled as sample.

### 7.2 Google Search Coach

- **Icon suggestion:** `GraduationCap`.
- **Description:** "Step-by-step coaching that shows you exactly how to improve how your business ranks in Google Search — included in your CityWide Digital bundle."
- **Social subtitle line:** "Climb the local search results"
- **Tone:** instructional and specific. One recommendation per step, a clear "why it matters", and a plain next action. No guarantees of ranking, traffic or revenue.

### 7.3 Business Online Health

- **Icon suggestion:** `Activity`.
- **Description:** "A live, plain-English snapshot of your website, Google Business Profile, speed, search visibility, listings and operations — and what we are improving."
- **Social subtitle line:** "See exactly how your business shows up online"
- **Tone:** diagnostic and calm. Show what is passing, what needs attention and what happens next. Pair scores with an explanation; a number alone is not a result.

---

## 8. Working inside the bundle

- **Entry point:** the CityWide dashboard links to each app from its sidebar and opens it in a new tab. The app should open on its own home screen, already branded, with no intermediate splash or "choose your plan" gate.
- **Return path:** every app header carries a quiet link back to `https://dashboard.citywidedigital.ca`, labelled "Back to CityWide dashboard" or a left-arrow plus "Dashboard". It is a secondary action, never the primary button.
- **No duplicated navigation:** do not rebuild the dashboard's full sidebar inside the app. If the app is multi-screen, use its own short, app-specific navigation (two to five items).
- **Sessions are separate.** Each app is a separate deployment; do not assume the dashboard's signed-in session is available. If the app needs a login, build an on-brand auth screen (navy hero gradient, white or dark card, one primary action, wordmark at 48 px) and never embed credentials or tokens in the client.
- **Bundle references:** say "included in your CityWide Digital bundle" or "part of your CityWide Digital plan". Do not invent plan names, prices or limits. The published plans are Starter, Growth and Pro; only mention pricing if the app already has approved copy for it.
- **Upgrade prompts:** use the CTA gradient and a single button. Never block the whole screen with an upsell.
- **No placeholder links.** If a related app is not live, do not link to it. Text without a destination is better than a dead link.

---

## 9. Voice and copy

- **Who is speaking:** a capable local-marketing partner. Warm, direct, never salesy.
- **Person:** "you" for the business owner; "we" for CityWide. Avoid "the user".
- **Sentences:** short. One idea each. Cut adverbs and superlatives.
- **Evidence over adjectives:** "Your hours update everywhere at once" beats "powerful automation".
- **Headings:** sentence case, specific. No puns, no wordplay, no ALL CAPS sentences.
- **Numbers:** real or absent. Never invent statistics, ratings, client counts or time saved.
- **No hype words:** revolutionary, game-changing, cutting-edge, unleash, supercharge, seamless (as a claim).
- **No emoji** anywhere, including notifications and empty states.
- **Punctuation:** em dash with spaces (—), serial comma, one space after a period. Use "&" only in short social-card subtitles, never in body copy.
- **Buttons:** verb first, two or three words: "Send request", "Connect profile", "View report".
- **Errors:** say what happened and what to do. No blame, no jargon, no error codes in the main sentence.

Approved examples:

- "Connect your Google Business Profile to keep your hours, photos and posts in sync."
- "No reviews collected yet. Send your first request and we'll track the responses here."
- "We couldn't load your report. Try again, or contact us at alan@citywidedigital.ca."

---

## 10. Do and don't

**Do**

- Use the wordmark on every screen, at the sizes above.
- Keep the same favicon and the same social-card template across every app.
- Default to the deep navy workspace with one electric blue action.
- Use the exact tokens; change the theme by editing tokens, not by hard-coding hex values in components.
- Test both themes, 390 px and 1280 px, and keyboard-only use.
- Label sample or unfinished data clearly.

**Don't**

- Recolour, redraw, crop or restyle the logo, favicon or social card.
- Use the wordmark orange (#F15C1A) or navy (#274F72) as UI colours.
- Add a second accent colour, a purple gradient, or neon highlights.
- Introduce another font, an icon pack, or emoji.
- Build a separate brand name, tagline or "powered by" lockup.
- Copy the dashboard's navigation, prices or plan names into the app.
- Show fake success, fake reviews, fake scores or fake connections.

---

## 11. Launch checklist

- [ ] Browser tab shows the CityWide icon (not the Vite/default icon), at 16 px and 32 px.
- [ ] `index.html` title follows `App Name — CityWide Digital`; description is 140–160 characters.
- [ ] Canonical URL, `og:url` and `twitter:image` are absolute and correct for this app.
- [ ] Link preview renders: shared card, site name "CityWide Digital", app name in the title; subtitle line matches the app.
- [ ] Wordmark is crisp on the header at 32 px, with clear space and `alt="CityWide Digital"`.
- [ ] On navy surfaces the wordmark uses the brightness filter; on light surfaces it does not.
- [ ] One primary button per screen; all buttons sentence case; no orange buttons.
- [ ] Text meets contrast in both themes; focus ring visible on every control.
- [ ] Works at 390 px with no horizontal scroll; touch targets at least 44 px.
- [ ] "Back to CityWide dashboard" link works and is secondary.
- [ ] No emoji, no placeholder links, no invented statistics, no fake success states.
- [ ] Canadian spelling checked (licence, colour, centre).
- [ ] `prefers-reduced-motion` disables ambient and entrance animation.

---

*Questions about anything not covered here: ask before inventing. Brand consistency across the bundle matters more than a local design idea.*
