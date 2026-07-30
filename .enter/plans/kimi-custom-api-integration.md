# Integrate Custom Kimi K3 API (Bypassing the Built-in AI Gateway)

## Context

The two existing AI backend functions in this project (`app-builder-ai`, `app-code-gen`) both go through the Enter built-in AI gateway (`https://api.enter.pro/code/api/v1/ai/messages`), billed via the platform-issued `AI_API_TOKEN_5831877fc23c` token.

The user wants to integrate **their own Kimi K3 API key from the official Moonshot platform (platform.moonshot.ai)**, calling the official default endpoint `https://api.moonshot.ai/v1` directly, bypassing the Enter gateway and its platform billing. This is a new integration independent of the two existing functions. This iteration implements "streaming chat + long context" first; tool calling / multi-model routing are deferred to a later iteration.

## Technical Approach

### 1. Credential Storage (Enter Cloud Secrets)
Use the `supabase_add_secret` tool to add one secret (the user's own credential, not Stripe, not the Enter AI gateway token):
- `KIMI_API_KEY` — API key from the official Moonshot platform

The Base URL uses the official international default address `https://api.moonshot.ai/v1`, hardcoded directly in the backend function (not sensitive, no need to store as a secret). `KIMI_API_KEY` is read in the backend function via `Deno.env.get()`; if missing, it errors out with no silent fallback.

### 2. New Backend Function `supabase/functions/kimi-chat/index.ts`
- Independent of `app-builder-ai` / `app-code-gen`, dedicated to this custom Kimi integration.
- Request body: `{ messages: {role, content}[], model?: string, max_tokens?: number, temperature?: number }`
  - `model` defaults to `"kimi-k2-0905-preview"` (Moonshot's official long-context model identifier; update this default per official docs once the user switches to a specific K3 model name), overridable from the frontend.
  - `max_tokens` defaults to a larger value (e.g. 8192) to support long-context scenarios.
- Uses `fetch` to forward to `https://api.moonshot.ai/v1/chat/completions`, `Authorization: Bearer ${KIMI_API_KEY}`, `stream: true`, following the OpenAI Chat Completions protocol (`choices[0].delta.content` increments, `data: [DONE]` to end) — the official Moonshot API is itself OpenAI-compatible.
- Transparently streams the upstream SSE `response.body` back to the frontend (zero transformation on the success path, to best preserve streaming behavior for "long context" use cases).
- Failure path: reads the upstream response text, attempts to parse an OpenAI-style `{error:{message,type}}` envelope, wraps it as `event: error\ndata: {...}\n\n`, and passes the status code through unchanged — consistent with the style of existing functions in this repo.
- CORS headers follow the project's existing pattern (`authorization, x-client-info, apikey, content-type`).

### 3. New Frontend Hook `src/hooks/useKimiChat.ts`
- Follows the hand-rolled `ReadableStream` parsing approach from `useCodeGen.ts` (rather than `fetchEventSource`), since the target is the user's own endpoint and its response content-type/compliance may not be as strict as the Enter gateway's — a hand-rolled reader is more tolerant.
- Maintains `messages` (role/content array, including a streaming assistant placeholder message), `isGenerating`, and `error`.
- Parses `chat.completion.chunk`: accumulates `choices[0].delta.content`; ends the stream on `data: [DONE]` or `finish_reason`.
- Errors prioritize the backend's returned `error.message`, falling back to a fixed message (network error / service unavailable, etc.) when empty.
- Imports `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` from `@/integrations/supabase/client` to call `/functions/v1/kimi-chat` (without modifying `client.ts`).

### 4. New Frontend Page `src/pages/dashboard/KimiConsole.tsx`
- A standalone chat/test page: message bubble list + input box + send/stop buttons + clear conversation.
- A banner at the top notes "Uses your own official Moonshot Kimi API key, connects directly to the official endpoint, bypasses the built-in AI gateway billing."
- Allows the `model` name to be filled in / overridden on the page (text input, default value `kimi-k2-0905-preview`), so the user can easily switch as official models are updated.
- UI structure reuses `DashboardLayout` + `TopBar`, styled after the card layout in `Builder.tsx`, avoiding a separate styling approach.

### 5. Routing & Navigation
- `src/router.tsx`: adds a `/dashboard/kimi` route, wrapped in the existing `<Auth>` wrapper.
- `src/lib/agencies.ts`: adds a "Kimi AI" nav entry (new icon, e.g. `Bot` or `Sparkles`) under the `citywide` agency (the primary/internal-tooling-facing agency), placed near App Builder. The other three agencies (legacy_leaf / foodiio / oneprofile) are left untouched, keeping end-customer-facing navigation clean.

## Existing Code to Reuse
- Backend function error envelope + CORS header pattern: `supabase/functions/app-builder-ai/index.ts`
- Hand-rolled SSE reader parsing pattern: `src/hooks/useCodeGen.ts`
- Supabase URL/Key retrieval: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (already exported from `client.ts`)
- Navigation/routing wiring: `src/router.tsx` + `src/lib/agencies.ts` + `Sidebar.tsx` (no changes needed to `Sidebar.tsx` itself)

## Implementation checklist
- [passed] Added `KIMI_API_KEY` via `supabase_add_secret`
- [passed] Created `supabase/functions/kimi-chat/index.ts`: reads the secret, errors out with an SSE error if missing
- [passed] `kimi-chat` forwards to `https://api.moonshot.ai/v1/chat/completions`, `stream: true`, streams the success response body through
- [passed] `kimi-chat` failure path parses the upstream OpenAI-style error and wraps it as an `event: error` SSE, passing the status code through
- [passed] Created `src/hooks/useKimiChat.ts`: hand-rolled reader parses `chat.completion.chunk`, handles `[DONE]`, `finish_reason`, and error events
- [passed] Created `src/pages/dashboard/KimiConsole.tsx`: chat UI + overridable model name input + stop/clear
- [passed] Added `/dashboard/kimi` route to `src/router.tsx` (wrapped in `<Auth>`)
- [passed] Added "Kimi AI" entry to the `citywide` navigation in `src/lib/agencies.ts`

## Verification checklist
- [manual-required] When `KIMI_API_KEY` is not configured, calling `kimi-chat` returns a clear SSE error (not an uninformative 500)
- [manual-required] With a valid key configured, sending a message on `/dashboard/kimi` shows streaming output appearing character by character
- [manual-required] When the upstream returns an error (e.g. 401/429), the frontend displays the specific error message passed through from the backend, not a generic "Request failed: xxx"
- [manual-required] Long input (simulating long context, e.g. pasting a long text) is not truncated due to an overly small `max_tokens`
- [manual-required] Clicking "Stop" mid-stream correctly aborts the request without leaving a stuck loading state
- [passed] Switching to the other three agencies (legacy_leaf/foodiio/oneprofile) does not show the "Kimi AI" entry in the sidebar; it appears and is clickable under `citywide`
- [passed] `pnpm run build` and lint pass
