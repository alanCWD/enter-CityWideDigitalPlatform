# CityWide Digital — App Brand Handoff

## What you get

One Markdown file at the project root (`CITYWIDE-APP-BRANDING.md`) that can be pasted directly into the agent building Review Engine, Google Search Coach, Business Online Health, or any future app in the bundle.

It is written as an instruction set for an AI builder: every colour, font, asset URL, page title, favicon tag and Open Graph tag is given exactly, so the sibling apps come out looking like the same product family instead of three separate sites. A download link will be provided in chat so you can hand it off without digging through the repo.

## What the document establishes

**Brand at a glance**
- Wordmark, positioning line, voice and tone, and the "part of CityWide Digital" attribution rule.
- Canadian spelling and the real contact details already used on the site.

**Shared assets, with live links**
- The official navy-and-orange wordmark (3447 × 1200).
- The favicon master (144 × 144) plus the small PNG and `.ico` copies.
- The shared Open Graph image (1392 × 752), used by every app in the bundle.
- Where each file goes in a new project, and how the wordmark is treated on dark versus light surfaces (it is never recoloured, stretched or cropped).

**Head tags, ready to paste**
- Favicon and apple-touch icon links, canonical URL, and the full Open Graph and Twitter card block.
- Shared site name and shared image; only the app title, description and URL change per app.
- Note that the Open Graph image's true size is 1392 × 752, so the new apps declare the real dimensions.

**The theme itself**
- The exact light and dark palettes already in use: deep navy canvas, electric blue as the single call-to-action colour, cool greys for surfaces.
- The rule that the wordmark's orange is part of the logo only — it is never used as a UI accent.
- Inter for all interface text, IBM Plex Mono for small uppercase labels; type scale, radii, gradients and shadows.
- Success, warning and destructive colours so status pills match across apps.

**Layout and components**
- The workspace shell: 240 px sidebar, sticky top bar, glass content panels, light-mode behaviour.
- Buttons and calls to action, cards, badges and status treatment, empty and loading states.
- Lucide icons only, never emoji; reduced-motion handling; touch targets and contrast for both themes.

**App identity table**
- A row for Review Engine, Google Search Coach and Business Online Health: display name, browser tab title, Open Graph title and description, suggested icon, domain and return link.
- Each app carries a small CityWide lockup and a "Back to CityWide dashboard" link, and does not rebuild the dashboard navigation inside itself.
- The user's names are treated as the canonical product names; the dashboard's existing short labels ("GSO Coach", "Digital Health") are listed as aliases so the two stay reconciled.

**Do / don't and a finishing checklist**
- No new fonts, no off-brand colours, no recoloured logo, no emoji icons, no stock-photo hero.
- A short pass: tab icon visible, link preview correct, readable in both themes, usable on a phone.

## Boundaries

- Only the handoff document is added. The current site, dashboard, routes, theme and existing assets are untouched.
- The logo, favicon and Open Graph image are reused as they are; nothing is regenerated or replaced.
- The document sets rules for the other apps; it does not modify them.
- App-specific Open Graph artwork is out of scope — every app shares the one CityWide image.

## Assumptions

- The other apps are separate Enter projects on the same stack, so a self-contained Markdown handoff is the right format.
- "Google Search Coach" and "Business Online Health" are the intended product names, with the dashboard's current labels kept as short aliases.
- One shared Open Graph image, with per-app titles and descriptions, is enough to read as one brand.

## Done when

- [ ] A single file at the project root gives another app's agent everything needed to match the CityWide theme without asking follow-up questions.
- [ ] Every favicon, wordmark and Open Graph URL in it is a live address (verified reachable), and the tag blocks are copy-paste complete.
- [ ] The light and dark palettes, fonts, radii and component conventions in it match the live site exactly.
- [ ] All three named apps have a concrete identity and head-tag entry, including their browser tab title and link preview text.
- [ ] The document is available as a download link in chat.
