# Fix Stripe webhook delivery failures

## Context

Stripe reported repeated failures delivering live-mode webhook events to:
`https://spb-t4n611neql9e2ec2.supabase.opentrust.net/functions/v1/stripe-webhook`

Investigation turned up two separate problems, confirmed by direct testing:

1. **Wrong project domain.** This project's real domain (from `supabase/config.toml`
   and `src/integrations/supabase/client.ts`) is `spb-t4n1w2j9jwhhc7h6...`, not
   `spb-t4n611neql9e2ec2...`. The endpoint Stripe has on file belongs to a
   different/stale project entirely, so it could never have worked regardless of code.

2. **Platform gateway blocks all unauthenticated inbound requests — confirmed live.**
   Curling the *correct* project's `stripe-webhook` and `qbo-webhook` endpoints just
   now, with no `Authorization` header (and even with a `stripe-signature` header
   present), both returned `401 Missing authorization header`. This happens even
   though `supabase/config.toml` sets `verify_jwt = false` for `stripe-webhook`.
   This is a hard requirement of this managed platform's gateway, not something
   `config.toml` or per-function code can override. The same conclusion is already
   documented in `config.toml`'s comment and independently confirmed by the user's
   own header tests.
   Stripe (and Intuit, for QuickBooks) has no way to attach a custom
   `Authorization` header to its webhook POSTs — so **no inbound webhook to this
   project can ever succeed**, no matter which URL is configured.

**There is already a precedent for this exact problem in this codebase.**
`supabase/functions/qbo-poll-invoices/index.ts` + migration
`migration_20260727_203955000` were built specifically because QuickBooks
webhooks hit this same gateway wall. Instead of receiving push events, that
function is called on a `pg_cron` schedule — and because the *call originates
from Postgres itself*, it can attach a valid `Authorization: Bearer <anon key>`
header, which passes the gateway. This plan applies the same pattern to Stripe.

## Approach

Replace the (permanently unreachable) inbound `stripe-webhook` with a scheduled
**poll-and-reconcile** function, `stripe-poll-events`, mirroring
`qbo-poll-invoices`. `stripe-webhook/index.ts` is left in place untouched (harmless,
and would start working on its own if the platform's gateway restriction is ever
lifted) — no code changes needed there.

### 1. New table: `stripe_sync_state` (migration)
Singleton row tracking the cursor for the poll job. RLS enabled, service-role only
(no client access needed), following the same locked-down pattern as
`scheduled_posts.service_role_all_sp`.

```sql
create table public.stripe_sync_state (
  id boolean primary key default true check (id),
  last_synced_at timestamptz not null default (now() - interval '1 day')
);
alter table public.stripe_sync_state enable row level security;
create policy "service role manages stripe_sync_state" on public.stripe_sync_state
  for all using (auth.role() = 'service_role');
insert into public.stripe_sync_state (id) values (true);
```

### 2. New function: `supabase/functions/stripe-poll-events/index.ts`
- Reads `last_synced_at` from `stripe_sync_state` (via the Supabase client — no raw SQL).
- Calls `stripe.events.list({ created: { gte: <cursor> }, limit: 100 })`, paginating
  with `starting_after` until `has_more` is false; processes events oldest → newest.
- Reuses the **same event-handling logic already in `stripe-webhook/index.ts`**
  (`handleEvent`, `clientIdForCustomer`, `exec`, `bunnyBase` — the invoice /
  subscription / payment_intent / checkout.session cases), copied into the new
  function the same way `qbo-poll-invoices` duplicated `qbo-webhook`'s helpers
  rather than sharing a module.
- Advances the cursor to the latest processed event's `created` time (minus a
  ~2 minute safety buffer, since Stripe events can be queryable slightly out of
  order) after a successful run.
- Returns `{ processed, by_type }` for observability.

### 3. Schedule it (migration, same file as the table)
```sql
select cron.schedule(
  'stripe-poll-events-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/stripe-poll-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon key, same as qbo-poll-invoices-daily>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```
Every 10 minutes (vs. QBO's daily) since payment/subscription state should reflect
in the CRM promptly.

### 4. User action required (outside this app)
In the Stripe Dashboard → **Developers → Webhooks**, delete or disable the
failing endpoint pointing at `spb-t4n611neql9e2ec2...` — it will never succeed
and will keep generating failure-notification emails. No replacement endpoint
needs to be added; polling replaces it.

### On the JWT investigation
The user's conclusion is correct: this is a hosting-gateway restriction, not a
`verify_jwt`/`config.toml` issue, and the same restriction already blocks
`qbo-webhook` (worked around the same way) — confirmed again live during this
investigation. Filing a ticket with support@enter.pro is still worth doing if
near-real-time (push) delivery is ever required, but the polling fallback above
is the immediate, actionable fix and needs no infrastructure change.

## Files touched
- New: `supabase/functions/stripe-poll-events/index.ts`
- New: one migration (table + RLS policy + seed row + `pg_cron` schedule)
- No changes to `supabase/functions/stripe-webhook/index.ts` or `config.toml`

## Implementation checklist
- [passed] Create `stripe_sync_state` table with RLS enabled and a service-role-only policy
- [passed] Seed the single cursor row
- [passed] Write `stripe-poll-events/index.ts` reusing the invoice/subscription/payment_intent/checkout.session handling from `stripe-webhook/index.ts`
- [passed] Paginate `stripe.events.list` fully (`has_more`/`starting_after`) instead of only the first page
- [passed] Advance and persist the cursor only after successful processing, with a safety buffer
- [passed] Deploy `stripe-poll-events` via `supabase_deploy_edge_function`
- [passed] Schedule the `pg_cron` job calling the function every 10 minutes with a valid `Authorization: Bearer <anon key>` header

## Verification checklist
- [passed] Manually invoke `stripe-poll-events` once (with the anon key header) and confirm a 200 response with a processed count
- [blocked] Check `supabase_search_edge_function_logs` for `stripe-poll-events` to confirm events were fetched and matched to CRM clients
- [manual-required] Confirm a recently-paid real invoice/subscription in Stripe is reflected correctly in the Bunny `invoices`/`subscriptions`/`payments` tables after a poll run
- [manual-required] Query `cron.job` to confirm `stripe-poll-events-10min` is scheduled and `cron.job_run_details` shows successful runs
- [manual-required] Confirm `stripe_sync_state.last_synced_at` advances after each run (boundary check: no duplicate processing of already-handled events on the next run)
- [manual-required] Remind user to delete the stale webhook endpoint in the Stripe Dashboard
