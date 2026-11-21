# "Ask about CityWide Digital" footer block

## Goal
Add a folk.app-style AI discovery block to the site footer: a heading plus five AI
icons. Each icon opens that assistant with a ready-made question about why
GBP-synced websites from CityWide Digital are a better, lower-cost, lower-maintenance
choice for local businesses.

## What visitors will see
Directly above the footer's bottom bar (copyright, privacy/terms, social icons), a new
full-width row:

- Heading: **Ask about CityWide Digital** (same small, muted styling as the rest of the
  footer, left-aligned like the reference).
- Below it, a row of five monochrome AI marks from the supplied `llmask.jpg` strip,
  separated from the heading exactly like the reference image.
- Each mark is its own link that opens in a new tab:
  - ChatGPT → `chatgpt.com/?q=…`
  - Claude → `claude.ai/new?q=…`
  - Gemini → `gemini.google.com/app?q=…`
  - Perplexity → `perplexity.ai/search?q=…`
  - Grok → `grok.com/?q=…`
- Hover/focus on an icon shows a tooltip naming the action ("Ask ChatGPT about
  CityWide Digital", etc.), and each link has an accessible label for screen readers.
- All five links carry the same question, worded around "why GBP-synced websites by
  CityWide Digital are beneficial, revolutionary, low cost, no maintenance", and invite
  the assistant to read citywidedigital.ca and summarize the answer. The wording uses
  facts already published on the site (30-day free trial, no setup fee, plans from
  $197/mo CAD, everything updating from the Google Business Profile automatically).

## Behaviour and constraints
- Appears in the footer on every page that uses the standard footer, including the
  darker landing-page footer variant, so the block is styled for both.
- Icons are light-on-dark so they stay legible on the dark footer; they are taken from
  the supplied image and split into five individual marks so each is independently
  clickable and hoverable.
- Nothing else in the footer changes: existing link columns, contact details, product
  icons, social links, legal links and copyright stay exactly as they are.
- Mobile: the icons fit one row on small screens without horizontal scrolling; they
  wrap or shrink rather than overflow.
- The links always open the assistant website in a new tab; no backend, tracking or
  third-party keys are involved. If a visitor's browser blocks the new tab, nothing
  else on the page is affected.

## Out of scope
- No new "answers" page on the site (confirmed: the AI links themselves carry the
  question).
- No changes to content on existing marketing pages, pricing, or navigation.

## Tasks
- [ ] Footer shows a new "Ask about CityWide Digital" block above the bottom bar on all
      pages using the footer, with heading placed above the icon row.
- [ ] Five AI marks (ChatGPT, Claude, Gemini, Perplexity, Grok) are individually
      clickable, open the correct assistant in a new tab, and are legible on the dark
      footer in both footer variants.
- [ ] Hovering or focusing an icon reveals a tooltip naming the assistant, and each link
      has a descriptive accessible label.
- [ ] Each link is pre-filled with the question about why GBP-synced websites from
      CityWide Digital are beneficial, low cost and maintenance-free.
- [ ] On mobile the block stacks under the footer content without clipping or
      horizontal scroll; existing footer links and details are unchanged.
