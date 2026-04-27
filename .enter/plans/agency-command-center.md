# Agency Command Center — App Builder: Blueprint → Code

## Context
The App Builder currently generates a text **blueprint/spec** via Claude (Step 1). The user wants a **Step 2**: a second AI pass that converts that blueprint into real, deployable React files — viewable in a tabbed code panel and downloadable as a ZIP for use in a new Enter.pro project.

---

## What Changes

### 1. New Edge Function: `app-code-gen`
**File:** `supabase/functions/app-code-gen/index.ts`

- Input (POST JSON): `{ blueprint, niche, tier, clientName, template }`
- Calls Claude Sonnet 4.5 (non-streaming) with a strict code-generation system prompt
- System prompt instructs Claude to return **only a JSON object** where keys = file paths, values = file contents (React + Vite + Tailwind + TypeScript)
- Files to generate:
  - `package.json`, `index.html`, `vite.config.ts`, `tailwind.config.ts`
  - `src/main.tsx`, `src/index.css`, `src/App.tsx`
  - `src/components/Navbar.tsx`, `src/components/Hero.tsx`
  - Niche-specific: `Menu.tsx` (restaurant) / `Services.tsx` (contractor) / `Products.tsx` (retail)
  - `src/components/Reviews.tsx`, `src/components/Contact.tsx`, `src/components/Footer.tsx`
- Returns: `{ files: Record<string, string> }` or `{ error: string }`

### 2. New Hook: `src/hooks/useCodeGen.ts`
- `generateCode({ blueprint, niche, tier, clientName, template })` — POST to `app-code-gen`
- States: `files: Record<string, string> | null`, `isGenerating: boolean`, `error: string | null`
- Parses the JSON response and stores the file map

### 3. New Component: `src/components/dashboard/CodePanel.tsx`
Props: `{ files: Record<string, string>, clientName: string }`

- **Tab bar** listing all generated files (sorted: config files first, then src files)
- **Code viewer** — scrollable `<pre>` block with monospace font matching existing design
- **"Download ZIP" button** — uses JSZip to bundle all files and trigger download as `{clientName}-site.zip`
- **"Copy File" button** — copies current tab's content to clipboard
- **"Open in Enter.pro" button** — copies the blueprint + instructions to clipboard + opens `https://enter.pro` in new tab with a toast: "Blueprint copied! Paste it as your first prompt in the new project."

### 4. Updated `src/pages/dashboard/Builder.tsx`
After `OutputPanel` renders with `isDone === true`, append a new **"Build Code" section**:

```
┌─────────────────────────────────────────────────────┐
│  Blueprint Ready                              [Step 2]│
│  Convert this spec into deployable React code        │
│                                                       │
│  [  Generate Code Files  ]  ←  button                │
└─────────────────────────────────────────────────────┘
```

- Button calls `useCodeGen.generateCode({ blueprint: output, niche, tier, clientName, template: selectedTemplate })`
- While generating: shows a spinner card "Building {clientName} website..."
- On complete: renders `<CodePanel files={files} clientName={clientName} />`

### 5. Install JSZip
`jszip` package for client-side ZIP creation.

---

## Files Modified
| File | Action |
|---|---|
| `supabase/functions/app-code-gen/index.ts` | Create new |
| `src/hooks/useCodeGen.ts` | Create new |
| `src/components/dashboard/CodePanel.tsx` | Create new |
| `src/pages/dashboard/Builder.tsx` | Add Step 2 section below `OutputPanel` |
| `package.json` | Add `jszip` dependency |

---

## Verification
1. Generate a blueprint for "Mash & Dash" (restaurant, pro tier)
2. Click "Generate Code Files" — spinner appears, ~15-30s
3. Code panel appears with tabs: `package.json`, `src/App.tsx`, `src/components/Hero.tsx`, etc.
4. Switch tabs — each shows the correct file content
5. Click "Download ZIP" — `Mash-Dash-site.zip` downloads with all files
6. Unzip and run `pnpm install && pnpm dev` — site loads locally
7. Click "Open in Enter.pro" — enter.pro opens in new tab, toast confirms clipboard copy
