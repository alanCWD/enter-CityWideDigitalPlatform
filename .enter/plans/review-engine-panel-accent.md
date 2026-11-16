# Review Engine panel — first app-coloured panel

## What changes

The **Review Engine** panel on `/services` becomes the first panel that carries its app's own colour. Review Engine gets a subtle, classy red treatment; the panel and its buttons read as part of the same product, while the page's glass, typography and layout stay exactly as approved.

### Panel surface and icon
- The panel keeps its glass material, but gains a soft left-to-right wash: neutral glass on the left, fading into a restrained red tint on the right — present enough to identify the product, quiet enough that the copy stays the hero.
- The panel border and hover glow warm slightly toward red on this panel only.
- The icon tile gets a red outline tinge: a fine red hairline ring with a faint warm glow, and the icon stroke shifts from the standard ice blue to a soft warm tone so it reads as red-tinged rather than mismatched.
- Body copy, headings and the "What's included" list keep their current contrast; red is used only for the wash, ring and accents, so nothing becomes harder to read.

### Buttons
- The panel's actions change from **Start free trial** + **Talk to sales** to:
  - **Explore** — opens `https://review-engine.citywidedigital.ca/` in a new tab.
  - **Start free trial** — keeps today's destination (`/pricing#start-trial`).
- Both buttons adopt the panel's red CTA treatment, echoing the Review Engine landing page's CTA: the solid button gains a faint red edge and warm glow rather than turning into a loud red block, and the secondary button's hairline and hover state warm to match.
- Order on screen follows the requested list: Explore first, then Start free trial.

### Future apps
- The colour is defined per panel, not hard-coded into the page, so the next app panel (Google Search Coach, Business Online Health) simply carries a different colour with the same treatment. Nothing else changes until that colour is set.

## Stays unchanged
- The other four service panels (GBP Website Builder, Social Sync Pro, Listing Sync Pro, Site Concierge), their copy, features and buttons stay exactly as they are today.
- The Services hero, orbit scene, navigation, footer, pricing page, and every other page are untouched.
- No new pages or routes.

## Checks before done
- [ ] `/services` shows the Review Engine panel with a visible but restrained red wash, red icon ring and warm button treatment, at desktop and phone widths.
- [ ] The other four panels look identical to today.
- [ ] Explore opens the Review Engine app in a new tab; Start free trial lands on the trial section of `/pricing`.
- [ ] Text and buttons on the panel remain legible against the tint, with keyboard focus visible.
