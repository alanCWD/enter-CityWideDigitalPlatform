# Clover → QuickBooks Online daily sync

## Scope (confirmed with user)
- Single client's Clover merchant ↔ that same client's QuickBooks Online company (reuses the existing `quickbooks_connections` row on this project's CRM `ClientDetail` page).
- Daily summary posting: one `JournalEntry` per calendar day with sales/tax/tips/tender totals — not per-order `SalesReceipt`.
- User has no Clover developer app yet — I will give step-by-step registration instructions; the actual Client ID/Secret get added as backend secrets once they have them (build proceeds now, connecting happens after).

## Architecture correction
No standalone Node/Python service. This runs entirely as Enter Cloud backend functions (Deno) + Postgres, following the exact pattern already used by `qbo-poll-invoices` and `stripe-poll-events` in this project: a `pg_cron` job calls a backend function on a schedule (because Clover, like Stripe/QBO, can't push webhooks through this platform's gateway).

## 1. Clover developer app (user action, guided by me)
1. Create an account at `https://sandbox.dev.clover.com` (sandbox) — production apps are managed at `https://www.clover.com/developers`.
2. Create a new app → App Market → "Create New App".
3. Set permissions: **Orders (Read)**, **Payments (Read)**, **Merchant (Read)**.
4. Set the OAuth redirect URI to `https://dashboard.citywidedigital.ca/clover/callback` (must match exactly, same pattern as the existing QBO redirect).
5. Copy the **App ID** and **App Secret** — I'll store them as backend secrets `CLOVER_APP_ID` / `CLOVER_APP_SECRET` via the secret tool when ready.
6. Get a sandbox test merchant from the Clover sandbox dashboard to test the connection before going live.

## 2. Database (one migration)
New tables, RLS modeled exactly on `quickbooks_connections`:

**`clover_connections`** (one row per client, unique on `crm_client_id`)
- `id uuid pk`, `crm_client_id text not null unique`
- `merchant_id text not null`, `access_token text not null`, `refresh_token text`, `token_expiry timestamptz`
- `environment text not null default 'production'` (`sandbox`|`production`, picks Clover base URL)
- `account_map jsonb not null default '{}'` — QBO `AccountRef` values for: sales, tax, tips, discounts, card_clearing, cash_clearing
- `status text not null default 'active'`, `last_error text`
- `last_synced_date date` — checkpoint (last calendar day successfully posted)
- `created_at`, `updated_at`

**`clover_qbo_sync_log`** (one row per client per day attempted)
- `id uuid pk`, `crm_client_id text not null`, `sync_date date not null`
- `status text not null` (`success`|`no_activity`|`failed`)
- `totals jsonb` (gross, tax, tips, discounts, card, cash, other)
- `qbo_journal_entry_id text`, `error_message text`, `created_at timestamptz`
- unique `(crm_client_id, sync_date)` so re-runs upsert instead of duplicating

RLS: `authenticated` SELECT/UPDATE/DELETE `true` (matches `quickbooks_connections`); all INSERTs happen via service-role backend functions.

pg_cron: daily job (`clover-qbo-sync-daily`) posting to the `clover-qbo-sync` function with the anon key, same `net.http_post` idiom as the Stripe migration.

## 3. Backend functions
- **`clover-auth-url`** — builds the Clover OAuth authorize URL (sandbox vs prod base picked by an `environment` param), encodes `crmClientId` in `state`, mirrors `qbo-auth-url`.
- **`clover-auth-callback`** — exchanges `code` for tokens against Clover's `/oauth/token`, upserts `clover_connections` keyed by `crm_client_id`. Mirrors `qbo-auth-callback`.
- **`qbo-list-accounts`** — given `crmClientId`, refreshes the QBO token if needed and runs `SELECT * FROM Account` against that client's existing QBO connection, returning `{id, name, type}[]` for the account-mapping dropdowns.
- **`clover-qbo-sync`** — the engine, callable both by cron (batch mode: catches up every pending day for every active connection) and by the frontend "Sync now" / "Retry day" button (`{crmClientId, date}` body = replay one day):
  1. Refresh Clover token if it carries an expiry and is stale; refresh QBO token via the same logic already in `qbo-poll-invoices`.
  2. For each pending date since `last_synced_date`: page through `GET /v3/merchant/{id}/payments?filter=createdTime>=...&filter=createdTime<...&expand=refunds` (100/page).
  3. Aggregate gross sales, tax, tips, discounts, refunds, and tender totals (card vs cash vs other) from the `tender.label`/`cardTransaction` fields.
  4. Skip (log `no_activity`) if there were zero payments that day.
  5. Build a `JournalEntry` from `account_map` (debit clearing accounts for card/cash, credit sales/tax/tips, matching the structure in your outline) and `POST /v3/company/{realmId}/journalentry`.
  6. Upsert the result into `clover_qbo_sync_log`; advance `last_synced_date` on success.

## 4. Frontend
- New route `/clover/callback` → `src/pages/CloverCallback.tsx` (mirrors `QboCallback.tsx`), registered in `router.tsx`.
- New hook file `src/hooks/useClover.ts` (`useCloverConnection`, `useCloverSyncLog`) mirroring `useQuickbooks.ts`.
- New `src/components/crm/clover/CloverPanel.tsx`:
  - Gated on QBO already being connected for this client (else: "Connect QuickBooks first" with a jump to that tab).
  - Not connected: "Generate Connection Link" (copy/email) exactly like the QBO panel's flow, since only the client can log into their own Clover account.
  - Connected: merchant id, environment, status badges; **Account Mapping** form (6 dropdowns sourced from `qbo-list-accounts`); sync log table (date, status, totals, JE id/link, error tooltip, per-row **Retry**); a manual **Sync Now** button; **Disconnect**.
- Add a `"Clover Sync"` tab next to `"QuickBooks"` in `src/pages/dashboard/crm/ClientDetail.tsx`, rendering `<CloverPanel clientId={c.id} />`.

## Not building (out of scope per your answers)
- No per-order/line-item `SalesReceipt` posting.
- No multi-tenant "share link to any client" onboarding flows beyond the single connection UI (though the schema is a normal keyed table, so it isn't hard to extend later).

## Sequencing
Steps 2–4 can be built and shipped now. Step 1 (Clover app registration) is on you; once you paste the App ID/Secret I'll wire them in via the secret tool and we'll do a live sandbox test end-to-end before flipping `environment` to production.
