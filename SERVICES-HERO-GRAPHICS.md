# Services Hero — Graphics Handoff

**Version 1.0 · 9 November 2026**
For the designer/agent working on the inner-page hero graphics at `/services`.

---

## 0. Scope

This package covers the background graphics of the Services hero only:

- the orbital Earth plate,
- the animated signal constellation over the continents,
- the five drifting satellites,
- the 12-second camera descent,
- and the scrim that keeps the headline readable.

It does **not** cover the hero copy, the buttons, the navbar, or the service panels below. Those are existing, approved UI and must not be restyled as part of a graphics change.

**The scene is a shared component.** It is switched on for `/services`, `/pricing` and `/about`. Any edit to `OrbitHeroScene.tsx`, its CSS, or the image below changes all three pages. The raster is also the final orbit frame of the home-page capsule journey. Treat these as live dependencies, not copies.

**Files that define the graphics**

| File | Role |
| --- | --- |
| `src/components/marketing/glass/GlassHero.tsx` | Renders `<OrbitHeroScene />` when `scene` is set |
| `src/components/marketing/glass/OrbitHeroScene.tsx` | Canvas renderer: photo, constellation, satellites, camera |
| `src/styles/glass-theme.css` | Hero box, scene stacking, scrim gradients |
| `public/capsule/space-v3.webp` | The only raster asset (1920 × 1080, 89 KB) |
| `src/pages/Services.tsx` | Enables `scene` on the hero |

Dependencies: `topojson-client` 3.1.0 and `world-atlas` 2.0.2 (both ISC), imported dynamically for the land outlines. No WebGL, no video, no image sequence.

---

## 1. The frame

At a 1280 px viewport the hero is roughly **610 px tall and full-bleed**. The headline block occupies the left `max-w-3xl` column; the Earth fills the lower two-thirds and rises to the right.

```
┌──────────────────────────────────────────────────────────┐
│  fixed transparent navbar (72 px)                        │
│                                                          │
│  kicker                                                   │
│  ≈64 px light headline         ·  stars + small satellites│
│  lede                          ·                         │
│  [ primary ] [ ghost ]         ·   Earth's limb →        │
│                                                          │
│  constellation dots + links over the planet              │
└──────────────────────────────────────────────────────────┘
```

The scene is one `<canvas>` that paints the photo, the constellation and the satellites in that order, then a `<div>` scrim on top, then the hero copy above that.

| Layer | z-index | Content |
| --- | --- | --- |
| Hero background | 0 | Canvas + scrim |
| Hero copy | 1 | Kicker, headline, lede, buttons |
| Navbar | 50 | Transparent capsule nav |

The hero has `overflow: hidden`; the canvas is `position: absolute; inset: 0`. Its height follows the copy, so a longer headline makes the hero taller and changes the photo crop. Keep the copy to the approved length when judging framing.

---

## 2. The raster plate

| Property | Value |
| --- | --- |
| File | `/capsule/space-v3.webp` |
| Dimensions | 1920 × 1080 (16:9) |
| Format / size | WebP (VP8), 89,130 bytes |
| Subject | Photoreal Earth limb from low orbit, thin cyan atmosphere, starfield, one space station upper-left |
| Role | Background plate for all three scene heroes; final frame of the home capsule journey |

**Shared-file warning:** `CapsuleHero.tsx` uses the same file as `END_STILL`. Replacing it in place re-frames the landing-page ending too. If the new plate is only meant for the inner-page hero, add a new file (for example `space-hero-v4.webp`), point `PHOTO` in `OrbitHeroScene.tsx` at it, and leave `space-v3.webp` alone.

**Composition requirements for any replacement**

- 16:9, at least 1920 × 1080; 2400 × 1350 is welcome if the file stays under ~150 KB.
- Earth's limb curve should sit in the lower half, with a shallow arc that reads as a planet, not a close-up coast. The projection is calibrated for a fitted limb whose apex is near **48% of the image height**; a very different curve needs recalibration (section 8).
- Deep, near-black space in the upper third; enough clean dark space on the left for white type.
- Thin, bright atmospheric band (cyan-white) along the limb; clouds and ocean detail below it.
- One small orbital station in the upper-left quadrant, at most ~8% of the frame width.
- No text, no logo, no watermark, no lens flare, no second planet, no visible tiling or seam.
- Photoreal orbital photography, natural colour, restrained contrast; no neon grading.

If the plate is AI-generated, keep it photographic rather than illustrative, and check the limb for wobble or duplicated curvature before accepting it.

---

## 3. The constellation

Purpose: turn the planet into a live business network without turning it into a dashboard. It reads as tiny coloured signal points joined by short links over land only.

- Land outlines come from `world-atlas/land-110m.json` through `topojson-client`, loaded after first paint.
- Points are sampled on a 2.9° lat/lon grid, tested against the land polygons, and only land points are kept.
- The generator is seeded (`424242`), so the pattern is identical on every load. Do not randomise per visit.
- Points are projected onto a sphere fitted to the photograph, then rotated by a fixed yaw of **-0.6 rad** and pitch of **0.32 rad**.
- The projected radius is pulled to **98.5%** of the fitted earth radius so points sit inside the limb, never in the sky.
- Back-face points (`z <= 0.02`) are culled.

**Point treatment**

| Tier | Share | Radius | Halo |
| --- | --- | --- | --- |
| Large | ~6% | 2.1 px | 5.2 × radius |
| Medium | ~22% | 1.35 px | 3.8 × radius |
| Small | ~72% | 0.85 px | 3.8 × radius |

- Core: `rgba(232, 242, 255, 0.82)`.
- Halo: the point's own colour at `0.12` alpha.
- Links: nearest neighbour within about 10.3°, alpha `0.36`, width `0.5–0.85 px`, no link across water.

**Palette** (RGB triplets, used for halos and links):

```
234, 179, 8     amber
168, 85, 247    violet
56, 189, 248    sky
236, 72, 153    pink
45, 212, 191    teal
129, 140, 248   indigo
248, 113, 113   coral
```

This is the **only** sanctioned multi-hue layer in the brand. It exists because it encodes a network over a photograph. Do not carry this palette into buttons, badges, panels or any other page. The core points stay near-white; the colour lives in the small halos and the links.

**Reveal:** the constellation starts with 55% of its points shown and fills to 100% over the first ~10.8 s of the 12 s timeline. It grows steadily while the camera descends, so the network appears to spread across the planet rather than pop in at once.

---

## 4. The satellites

Five vector satellites drift across the sky on shallow elliptical paths. They are drawn, not photographed, so they stay crisp and cost almost nothing.

| # | Centre (x, y) | Radii (x, y) | Phase | Speed | Scale | Appears at |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.50, 0.23 | 0.44, 0.09 | -2.3 | 0.05 | 0.90 | 0 s |
| 2 | 0.50, 0.14 | 0.36, 0.07 | 0.7 | 0.075 | 0.75 | 1.9 s |
| 3 | 0.52, 0.30 | 0.52, 0.11 | 2.4 | 0.04 | 0.85 | 4.3 s |
| 4 | 0.48, 0.19 | 0.40, 0.08 | -0.9 | 0.09 | 0.65 | 6.7 s |
| 5 | 0.50, 0.35 | 0.58, 0.13 | 1.7 | 0.035 | 0.80 | 8.9 s |

Centres and radii are fractions of the canvas. Each craft fades in over 16% of the timeline (~1.9 s), rotates to `angle × 0.5`, and is drawn as:

- a near-white body (`rgba(232, 242, 255, 0.92)`), 4.4 × 3.6 units;
- two blue solar panels (`rgba(120, 172, 255, 0.52)` fill, `rgba(190, 220, 255, 0.75)` stroke), 5.8 × 6.2 units each;
- a short mast below the body.

A satellite is skipped when it would sit inside the visible globe disc. Keep that occlusion: craft crossing the planet is the one thing that breaks the illusion.

The photo already contains one station in the upper left. The drawn craft are small and distant; do not scale them up until they compete with the photographic station.

---

## 5. Camera move

The shot plays once on load and holds. It never loops.

| Time | Progress | What happens |
| --- | --- | --- |
| 0 s | 0 | Rest frame: photo at cover, limb apex near 48% of the hero |
| 0–10.8 s | — | Constellation fills from 55% to 100% while the camera descends |
| 0–12 s | 0 → 1 | Earth grows from 1.004× to ~1.404×; horizon rises by 13% of the hero height |
| 1.9 / 4.3 / 6.7 / 8.9 s | — | Satellites 2–5 fade in |
| 12 s | 1 | Eases to a stop on the final frame and the animation loop ends |

- Easing is smoothstep (`t²(3−2t)`) across the full 12 s.
- The plate is scaled about the fitted earth centre, not the canvas centre.
- The drawn image is clamped every frame so its bottom edge can never enter the hero. Nothing is more damaging to the effect than a visible edge of the photograph.
- The camera is a 2D approximation of a descent. Do not add rotation, parallax or a second axis; it will fight the fixed perspective of the photograph.

**Reduced motion:** the scene renders the final frame immediately (`t = 1`) and starts no animation loop. That is the correct behaviour; do not replace it with a faded static image.

---

## 6. Scrim and hero box

The scrim is what makes white type survive on top of a bright planet. Do not "clean it up" or reduce it for aesthetic reasons.

```css
.gp-hero--scene {
  position: relative;
  overflow: hidden;
  padding: 7.5rem 0 7rem;      /* 10.5rem 0 10.5rem at ≥768px */
}
.gp-hero--scene .gp-shell { position: relative; z-index: 1; }

.gp-scene { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.gp-scene__canvas { display: block; width: 100%; height: 100%; }

.gp-scene__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg,
      rgba(5, 7, 10, 0.82) 0%,
      rgba(5, 7, 10, 0.34) 30%,
      rgba(5, 7, 10, 0) 52%,
      rgba(5, 7, 10, 0.28) 74%,
      rgba(5, 7, 10, 0.72) 90%,
      #05070a 100%),
    linear-gradient(100deg,
      rgba(5, 7, 10, 0.86) 0%,
      rgba(5, 7, 10, 0.42) 38%,
      rgba(5, 7, 10, 0) 70%);
}
```

On phones the copy lands on the bright terminator, so a stronger vertical scrim replaces the desktop pair. If you change the plate, re-test this breakpoint: a brighter left side needs more scrim, not less.

The hero's bottom fades to `#05070a`, which is also the page background, so the scene ends without a hard line.

---

## 7. Performance and failure behaviour

- One 89 KB image, one canvas, one 12-second requestAnimationFrame loop, then nothing until resize.
- Canvas backing store is capped at devicePixelRatio ×2.
- The loop pauses when the tab is hidden and resumes only if the 12 s has not finished.
- Land data is dynamically imported after paint; if it fails, the photo and camera still work and the constellation simply does not appear.
- If the image fails, the hero stays `#05070a` with the scrim and copy intact. Never leave a broken-image icon or an empty white box.
- No filters, blurs or blend modes on the canvas — the constellation's brightness comes from alpha, not CSS effects.

**Accessibility:** the whole scene is `aria-hidden`. The headline and lede are real text, not baked into the image. Keep at least 4.5:1 contrast for the lede; the scrim is already tuned for it.

---

## 8. Replacing or restyling the plate

1. Produce the new plate to the composition requirements in section 2.
2. Drop it in `public/capsule/` with a new name; do not overwrite `space-v3.webp` unless the home page should change too.
3. Update `PHOTO` in `OrbitHeroScene.tsx`.
4. **Recalibrate the sphere fit.** The constellation is projected onto a circle defined in image fractions:

```
EARTH_X = 0.5    centre x / image width
EARTH_Y = 1.5    centre y / image height
EARTH_R = 1.02   radius / image height
```

These place the fitted circle's apex at `EARTH_Y − EARTH_R = 0.48` of the image height. The photograph's visible limb may sit slightly above that line, which is deliberate: it keeps the points inside the planet. To recalibrate, measure the apex and two points on the limb near the left and right edges, solve the circle through them, then express its centre as fractions of width and height and its radius as a fraction of height.

5. Check the constellation sits just inside the limb across the whole curve. If points float in the sky or sink into the planet, the fit is off; do not hide it with more scrim.
6. Re-test the satellites' occlusion against the new limb.

**If the new plate is a different crop rather than a new photograph**, you may instead leave the fit and change only the camera's rest zoom in `cameraAt`. Prefer recalibrating the fit.

---

## 9. Using this hero in another project

Copy these three pieces together; they are self-contained:

- `OrbitHeroScene.tsx` and `GlassHero.tsx` (React 19, no UI-library dependency),
- the `.gp-hero--scene`, `.gp-scene` and `.gp-scene__scrim` CSS blocks,
- `space-v3.webp` into `public/capsule/`.

Then install `topojson-client` and `world-atlas`. The component expects a Vite-style JSON import for `world-atlas/land-110m.json`. If the new project cannot resolve that import, the scene still renders without the constellation — fix the import rather than drawing fake continents.

The hero copy is passed in by the page, not baked into the scene; keep the left column at `max-w-3xl` so the type never runs into the bright limb.

---

## 10. Acceptance checks

- [ ] At 1280 px wide, the limb apex sits near the vertical middle of the hero and the Earth reads as one continuous curve.
- [ ] No edge, seam or letterbox of the photograph is visible at any point in the 12 s.
- [ ] Headline and lede remain clearly readable over the brightest part of the planet, on desktop and at 390 px.
- [ ] Constellation points sit on land inside the limb; none float in space, none cross the horizon.
- [ ] Links are short and over land only; no line spans an ocean.
- [ ] All five satellites appear in sequence; none passes in front of the planet.
- [ ] The animation plays once, holds the final frame, and does not loop or jitter.
- [ ] With `prefers-reduced-motion: reduce`, the final frame appears immediately with no motion.
- [ ] Hero copy length is unchanged, and the section below starts at the same place as before.
- [ ] `/pricing` and `/about` still look correct, since they share this scene.
- [ ] The home-page capsule ending still looks correct, since it shares the image.
- [ ] Image is under ~150 KB and the page shows no layout shift when the scene initialises.

---

## 11. Do and don't

**Do**

- Keep the photograph photographic; the whole hero depends on that realism.
- Keep the constellation subtle: white cores, coloured halos, short links.
- Keep the camera move to a single slow push.
- Keep the scrim exactly as strong as it is today unless the plate changes.
- Test against the real headline, not placeholder text.

**Don't**

- Replace the photo with an illustration, gradient or 3D render.
- Enlarge or brighten the constellation until it competes with the headline.
- Add more satellites, orbit rings, grids, glows or HUD chrome.
- Add rotation, parallax, a loop or a scroll-triggered replay.
- Bake the headline or buttons into the image.
- Reuse the seven-colour constellation palette anywhere else in the interface.
- Overwrite the shared raster without checking the home page and `/pricing` / `/about`.

---

*If a change would make the hero louder rather than clearer, it is the wrong change. The graphics exist to make the headline land.*
