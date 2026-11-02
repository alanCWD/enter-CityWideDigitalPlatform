# Landing page rebuild — "space capsule" experience

## Context

The public home page still uses the original blue-navy marketing design. You want it rebuilt in the language of the reference capsule experience (near-black cinematic canvas, huge light type, tiny monospace HUD labels, a physical "capsule" you open), carrying the message **"Your Business Website Runs Itself Online"** with a **powered-by Google mark (icon, not the word)**.

Opening the capsule reveals a view of Earth from orbit: dark continents and, floating over them in the black, the same data-point network animation the current home page has — but running on its own instead of being driven by the scroll.

Both gestures open it: the hatch expands as you scroll, and it also opens when clicked.

## The experience

### 1. The capsule hero
- Full-viewport, near-black canvas. Corner HUD micro-labels (brand lockup, status, "human curiosity, no limits"-style line), all in small uppercase monospace with wide tracking.
- The headline sits low-left in large, light-weight type: "Your Business Website Runs Itself Online." Above it a mono kicker, below it a one-line description of what CityWide Digital connects.
- Directly beneath the headline, "**POWERED BY**" followed by the four-colour Google mark as an icon — the word "Google" is not printed, but the mark stays screen-reader friendly ("Powered by Google").
- Centre stage: the capsule — concentric hairline rings around a dark hatch with a faint internal glow and a subtle breathing pulse. It is a real button ("Open the capsule") with keyboard and focus states.
- Bottom edge: "SCROLL TO OPEN" with a downward cue, plus two primary actions kept from today: start a free trial and book a demo.

### 2. The world view
- Scrolling expands the hatch: rings sweep outward, the capsule fades, and the world fades up behind it. Clicking the capsule performs the same opening by gliding the page to the open state, so both gestures feel identical. `ESC` or a small "close" control returns to the closed capsule; scrolling back up does too.
- The world is a slowly rotating Earth: real continent outlines (bright hairline coasts) filled almost black, a faint graticule, a soft atmospheric limb, and stars behind. Continents are recognisable, drawn from a small public-domain world dataset that is only requested when the capsule opens — nothing extra loads for visitors who never open it.
- Over the continents, in the blackness, the network animation plays on its own: data points anchored to land masses, connection lines continuously extending, holding, retracting and re-routing, in the existing multi-colour channel palette. There is no scroll-driven camera — the globe drifts and the network pulses by itself.
- HUD annotations frame the view in the same mono type: the message restated, counters such as "4 social channels · 40+ directories · reviews · 24/7", and a "live / automated" indicator.
- On phones the globe scales down and particle density drops; the HUD reduces to its most important lines.

### 3. The page beneath
Scrolling past the world continues into a rebuilt page in the same language, keeping the current copy and offers:
- **The problem** — old way vs CityWide way as two hairline-ruled columns rather than tinted cards.
- **What is included** — the six capabilities as a numbered, rule-separated list with mono index numbers.
- **How it works** — the three setup steps as a horizontal sequence with hairline connectors.
- **Pricing** — the same three tiers ($97 / $197 / $297) as outlined columns, the featured one ringed, with the same trial buttons.
- **Closing call to action** — large centred statement with the same two actions.
- Navbar and footer adopt the same HUD treatment: transparent-to-solid hairline bar, mono uppercase links, thin dividers, quiet links.
- Motion is restrained throughout: no bouncy cards, no gradients; hover states are hairlines and brightness.

## Scope

**In:** the home page only — its hero, capsule/world experience, all sections on it, and the navbar/footer as they appear on the home page.

**Out:** every other page keeps its current design and content exactly as-is (Services, Pricing, About, Contact, GBP pages, legal pages, the client portal and the dashboard workspace). Shared navigation and footer on those pages are untouched. The existing home hero, its dashboard mockup and its scroll-driven animation are retired from the home page.

## Behaviour and constraints to preserve

- The trial and demo calls to action keep pointing to the same destinations.
- Copy and offers are unchanged: same capabilities, same three plans and prices, same trial promise.
- The page remains readable and navigable without JavaScript-driven motion: with reduced motion enabled the capsule opens instantly to a still globe and no ambient animation plays; the headline, copy and links are always present.
- The page stays usable by keyboard (capsule button, close control, focus visible) and by screen readers (real headings, labelled icon, hidden description of the scene).
- The globe canvas stops animating when it is off screen or the tab is hidden, and does not mount at all until the capsule starts opening — the first screen is cheap and fast.
- No external trackers, images or fonts beyond the existing font loading and the small world dataset.

## Assumptions

- The Google mark is used only as a "powered by" attribution next to the existing "POWERED BY" label; no other Google branding or claims are introduced.
- "The same data point animation" means the current hero's multi-channel network look, now self-animating around the globe rather than scroll-driven, not literally the same code path.
- The rest of the site's typography stays Inter; monospace is added only for HUD labels in this section.

## Implementation checklist

- [ ] Home page opens on the capsule hero: near-black canvas, mono HUD labels, light headline "Your Business Website Runs Itself Online", and "POWERED BY" with the Google mark (no Google word) that is announced correctly to screen readers.
- [ ] The capsule renders as a focused, keyboard-operable button with breathing rings; clicking it opens the world view the same way scrolling does.
- [ ] Scrolling through the hero expands the hatch and reveals the world; scrolling back up closes it; `ESC` and the close control also return to the closed capsule.
- [ ] The world view shows recognisable continents in blackness with a rotating globe, atmospheric limb and stars, and only loads the world dataset when the opening begins.
- [ ] The self-running network animation plays over the continents, independent of scroll, with the existing channel colour palette.
- [ ] World-view HUD restates the message and shows the channel/directory counters and an automated/live indicator.
- [ ] Sections beneath the hero (problem, capabilities, steps, pricing, closing CTA) are rebuilt in the same HUD language with unchanged copy, prices and CTA destinations.
- [ ] Navbar and footer on the home page adopt the HUD treatment; the same components on other pages render exactly as before.
- [ ] Reduced-motion visitors get an instant, still opening with no ambient drift; hidden/off-screen canvas animation is paused.
- [ ] Mobile (390 px) and desktop (1280 px) layouts of the hero, open world view and sections are composed deliberately rather than scaled down.

## Verification checklist

- [ ] Type-check, lint and production build succeed with no new warnings.
- [ ] Home page screenshots at 1280 px and 390 px show the closed capsule hero with the headline, Google mark, both actions and HUD labels, with no layout overflow.
- [ ] The opened world view is captured and reviewed for continent legibility, network visibility over land, HUD contrast and canvas sizing (using a temporary same-turn override that is removed before completion).
- [ ] A control page that shares the navbar/footer (e.g. Services and Pricing) is screenshotted to confirm it is visually unchanged.
- [ ] Keyboard pass: capsule button focus, activation, close control, and `ESC`.
- [ ] Reduced-motion pass: page opens to a still globe, no drift or pulsing.
- [ ] The dashboard workspace still renders its glass theme and the capsule theme does not leak into it.
