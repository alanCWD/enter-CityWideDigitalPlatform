Subject: Workaround implemented for the webhook gateway Authorization-header block — sharing for the open ticket

Hi team,

Following up on the open ticket about live-mode Stripe webhook delivery failures
to this project. While waiting on a platform-side fix, we built and verified a
workaround entirely within the project, and wanted to share it in case it's
useful context for your investigation (and in case it points at exactly where
the gateway restriction lives).

## Confirmed root cause (re-tested independently)

Every backend function on this managed project requires a valid `Authorization`
header at the gateway, regardless of code or config:

- `supabase/config.toml` sets `verify_jwt = false` for the `stripe-webhook`
  function. No effect — the gateway still rejects unauthenticated requests.
- Direct curl tests against the deployed functions, with no Authorization header
  at all (and separately, with a `stripe-signature` header but no Authorization
  header — i.e. exactly what Stripe sends):

  No Authorization header → 401 {"msg":"Error: Missing authorization header"}
  stripe-signature header only, no Authorization → same 401

  This reproduces on multiple functions in this project (`stripe-webhook`,
  `qbo-webhook`), so it's a gateway-level policy in front of all functions, not
  a per-function or per-integration issue.
- Third-party services that own the outbound side (Stripe, Intuit/QuickBooks)
  have no mechanism to attach a custom `Authorization` header to their webhook
  POSTs. This means no inbound push webhook to this project can ever succeed,
  independent of URL correctness, signature verification, or any application
  code change.

One additional, separate finding worth noting: the webhook endpoint currently
on file in the Stripe dashboard
(`https://spb-t4n611neql9e2ec2.supabase.opentrust.net/functions/v1/stripe-webhook`)
does not even match this project's actual domain
(`https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net`, per
`supabase/config.toml`'s `project_id` and the generated Supabase client config).
That endpoint was never reachable regardless of the gateway issue. We're
intentionally leaving the Stripe-side endpoint configured (disabled) rather than
deleting it, so it remains available as a real test target once the gateway fix
ships — deleting it now would remove our ability to verify the fix later.

## Workaround shipped (pull instead of push)

We noticed this exact wall had already been hit once before in this project, for
QuickBooks webhooks, and worked around the same way (`qbo-poll-invoices` +
`pg_cron`, several weeks ago). We applied the identical pattern to Stripe:

1. New backend function `stripe-poll-events` calls Stripe's
   `events.list({ created: { gte: cursor } })` API directly (outbound, using the
   already-configured `STRIPE_SECRET_KEY`), fully paginating with
   `starting_after`/`has_more`, and replays each event oldest-to-newest through
   the same handling logic the original `stripe-webhook` function uses for
   invoices, subscriptions, payment intents, and checkout sessions.
2. A new table, `stripe_sync_state` (RLS enabled, service-role only), stores a
   single cursor row (`last_synced_at`) so each run only fetches events since the
   last successful poll. The cursor advances with a ~2 minute safety buffer and
   only after a run that found at least one event, so the process is idempotent
   and safe to re-run.
3. A `pg_cron` job (`stripe-poll-events-10min`, `*/10 * * * *`) invokes the
   function every 10 minutes. Critically, this call originates from Postgres
   itself via `net.http_post`, so it can attach a valid
   `Authorization: Bearer <anon key>` header — which is what gets it past the
   gateway. This is the same mechanism (`net.http_post` from `pg_cron`, not an
   external caller) that already works for `qbo-poll-invoices`.
4. `stripe-webhook/index.ts` and `config.toml` were left completely unchanged.
   If the gateway restriction is lifted, the original push-based webhook will
   simply start working on its own — no further code changes needed on our side.

## Verified working

- Manual invocation of `stripe-poll-events` with the anon key returns HTTP 200
  with a structured result (`processed`, `by_type`, `fetched`, `cursor_advanced`).
- `cron.job` confirms the schedule is active.
- `cron.job_run_details` shows successive automatic runs firing every 10 minutes
  with `status: succeeded`.
- `stripe_sync_state` correctly enabled RLS with a service-role-only policy on
  creation, per this platform's standard requirement for new tables.

## Why we're sharing this

This confirms with certainty that the block is a **platform gateway policy**
enforcing a mandatory `Authorization` header on all inbound requests to backend
functions, independent of `verify_jwt` / `config.toml`, and independent of which
function or third-party sender is involved. A pull-based workaround resolves our
immediate need, but true push-based webhooks (lower latency, no polling
overhead, works for any future third-party integration) still require the
gateway to allow an unauthenticated (or alternately-authenticated, e.g.
signature-based) path for specifically flagged public functions. Happy to
provide further logs or reproduction steps if useful for the fix.

Thanks for continuing to look into this.
