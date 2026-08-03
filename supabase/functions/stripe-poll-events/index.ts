// stripe-poll-events — scheduled poll-and-reconcile for Stripe events.
//
// Stripe webhooks cannot reach this platform's backend functions directly: the
// gateway in front of every function requires an Authorization header, and Stripe
// has no way to attach one to its webhook POSTs (same wall QuickBooks hits, which
// qbo-poll-invoices was built to work around). So instead of receiving push
// events, this function pulls them on a pg_cron schedule (every 10 minutes — see
// migration) and replays them through the same handlers as stripe-webhook.
//
// The call originates from Postgres (pg_cron -> net.http_post), so it can carry a
// valid Authorization: Bearer <anon key> header, which is what lets it through the
// gateway. stripe-webhook/index.ts is left untouched and would start working on
// its own if that gateway restriction is ever lifted.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function bunnyBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const missingSecrets: string[] = [];
if (!stripeKey) missingSecrets.push("STRIPE_SECRET_KEY");
if (!BUNNY_TOKEN) missingSecrets.push("BUNNY_DB_AUTH_TOKEN");
if (missingSecrets.length > 0) {
  console.warn("stripe-poll-events: missing env vars:", missingSecrets.join(", "));
}

const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-04-10" }) : null;

// ── Bunny (CRM) SQL helpers — copied from stripe-webhook (kept in sync by copy,
//    same approach as qbo-poll-invoices duplicating qbo-webhook's helpers). ────
type SqlValue = string | number | null;
async function exec(sql: string, args: SqlValue[] = []) {
  if (!BUNNY_TOKEN) throw new Error("BUNNY_DB_AUTH_TOKEN not configured");
  const base = bunnyBase();
  if (!base || base === "https://") throw new Error("BUNNY_DB_URL not configured");

  const res = await fetch(`${base}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        type: "execute",
        stmt: {
          sql,
          args: args.map((v) =>
            v === null || v === undefined
              ? { type: "null" }
              : typeof v === "number"
              ? { type: "integer", value: String(v) }
              : { type: "text", value: String(v) }
          ),
        },
      }, { type: "close" }],
    }),
  });
  if (!res.ok) throw new Error(`Bunny ${res.status}: ${await res.text()}`);
  return res.json();
}

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const isoFromUnix = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

async function clientIdForCustomer(customerId: string): Promise<string | null> {
  try {
    const res = await exec(`SELECT id FROM clients WHERE stripe_customer_id = ? LIMIT 1`, [customerId]);
    const row = res?.results?.[0]?.response?.result?.rows?.[0];
    return row?.[0]?.value ?? null;
  } catch (e) {
    console.error("clientIdForCustomer error:", e);
    return null;
  }
}

// Copied verbatim from stripe-webhook/index.ts — invoice / subscription /
// payment_intent / checkout.session cases. Idempotent (UPDATE-then-INSERT OR
// IGNORE), which matters here because the cursor's 2-minute safety buffer
// intentionally re-sees recent events on the next poll.
async function handleEvent(event: Stripe.Event) {
  console.log(`Processing event: ${event.type} (id=${event.id})`);

  switch (event.type) {
    // ── Invoice events ──────────────────────────────────────────────────────
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.voided": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
      const clientId = customerId ? await clientIdForCustomer(customerId) : null;
      if (!clientId) {
        console.warn(`invoice event (${event.type}): no matching CRM client for customer ${customerId} — skipping DB write`);
        return;
      }

      const stripeStatus = inv.status ?? "open";
      const crmStatus = stripeStatus === "paid" ? "paid" : stripeStatus === "void" ? "void" : "open";
      const paidAt = stripeStatus === "paid" ? now() : null;

      const upd = await exec(
        `UPDATE invoices SET status=?, total_cents=?, amount_paid_cents=?, hosted_invoice_url=?, pdf_url=?, due_at=?, paid_at=?, number=? WHERE stripe_invoice_id=?`,
        [crmStatus, inv.total ?? 0, inv.amount_paid ?? 0, inv.hosted_invoice_url ?? null, inv.invoice_pdf ?? null, isoFromUnix(inv.due_date), paidAt, inv.number ?? null, inv.id],
      );
      const affected = upd?.results?.[0]?.response?.result?.affected_row_count ?? 0;
      if (affected === 0) {
        await exec(
          `INSERT OR IGNORE INTO invoices (id, client_id, number, status, subtotal_cents, total_cents, amount_paid_cents, currency, stripe_invoice_id, hosted_invoice_url, pdf_url, due_at, issued_at, paid_at, agency_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'citywide')`,
          [uuid(), clientId, inv.number ?? null, crmStatus, inv.subtotal ?? 0, inv.total ?? 0, inv.amount_paid ?? 0, (inv.currency ?? "cad").toUpperCase(), inv.id, inv.hosted_invoice_url ?? null, inv.invoice_pdf ?? null, isoFromUnix(inv.due_date), now(), paidAt],
        );
      }
      console.log(`invoice.event: ${event.type} → ${crmStatus} (clientId=${clientId})`);
      break;
    }

    // ── Subscription events ─────────────────────────────────────────────────
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      const clientId = customerId ? await clientIdForCustomer(customerId) : null;
      if (!clientId) {
        console.warn(`subscription event (${event.type}): no matching CRM client for customer ${customerId} — skipping`);
        return;
      }
      const crmStatus = sub.status === "active" || sub.status === "trialing" ? "active"
        : sub.status === "canceled" ? "canceled"
        : sub.status;
      const upd = await exec(
        `UPDATE subscriptions SET status=?, current_period_end=?, cancel_at_period_end=?, updated_at=? WHERE stripe_subscription_id=?`,
        [crmStatus, isoFromUnix(sub.current_period_end), sub.cancel_at_period_end ? 1 : 0, now(), sub.id],
      );
      const affected = upd?.results?.[0]?.response?.result?.affected_row_count ?? 0;
      if (affected === 0) {
        console.warn(`subscription event: no matching row for stripe_subscription_id=${sub.id}`);
      } else {
        console.log(`subscription.event: ${event.type} → ${crmStatus} (clientId=${clientId})`);
      }
      break;
    }

    // ── Payment events ──────────────────────────────────────────────────────
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const customerId = typeof pi.customer === "string" ? pi.customer : null;
      const clientId = customerId ? await clientIdForCustomer(customerId) : null;
      if (!clientId) return;

      const invoiceStripeId = (pi.invoice as string | null) ?? null;
      let invoiceId: string | null = null;
      if (invoiceStripeId) {
        const r = await exec(`SELECT id FROM invoices WHERE stripe_invoice_id = ? LIMIT 1`, [invoiceStripeId]);
        const row = r?.results?.[0]?.response?.result?.rows?.[0];
        invoiceId = row?.[0]?.value ?? null;
      }
      await exec(
        `INSERT OR IGNORE INTO payments (id, invoice_id, client_id, amount_cents, currency, method, stripe_payment_intent_id, paid_at) VALUES (?,?,?,?,?,?,?,?)`,
        [uuid(), invoiceId, clientId, pi.amount_received ?? pi.amount, (pi.currency ?? "cad").toUpperCase(), pi.payment_method_types?.[0] ?? "card", pi.id, now()],
      );
      if (invoiceId) {
        await exec(`UPDATE invoices SET status='paid', paid_at=?, amount_paid_cents=total_cents WHERE id=? AND status != 'paid'`, [now(), invoiceId]);
      }
      console.log(`payment_intent.succeeded clientId=${clientId} amount=${pi.amount_received}`);
      break;
    }

    // ── Checkout session ─────────────────────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`checkout.session.completed: session=${session.id} customer=${session.customer} subscription=${session.subscription}`);
      // No CRM write needed here — invoice/subscription events handle state.
      break;
    }

    default:
      console.log(`unhandled event type: ${event.type} — acknowledged`);
  }
}

// Stripe's events.list returns newest→oldest. We collect every page then reverse
// so events are applied oldest→newest — the correct order for the UPDATE-then-
// INSERT handlers (e.g. invoice.created before invoice.paid). starting_after
// advances strictly toward older events, so the chain is monotonic and must end.
async function fetchEventsSince(cursorUnix: number): Promise<Stripe.Event[]> {
  const collected: Stripe.Event[] = [];
  let startingAfter: string | undefined;
  let hasMore = true;
  let pages = 0;
  while (hasMore) {
    const params: Stripe.EventListParams = {
      limit: 100,
      created: { gte: cursorUnix },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    };
    const page = await stripe!.events.list(params);
    collected.push(...page.data);
    if (page.data.length === 0) break; // empty page — nothing more to page through
    startingAfter = page.data[page.data.length - 1].id;
    hasMore = page.has_more;
    pages++;
    if (pages >= 100) {
      // Defensive guard for a scheduled job. Realistic CRM payment volume never
      // approaches this; if it ever does, we process what we have and advance
      // normally rather than spinning the cron run indefinitely.
      console.warn(`[stripe-poll-events] reached 100 pages (${collected.length} events) — stopping pagination`);
      break;
    }
  }
  // oldest → newest
  return collected.reverse();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!stripe) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Read the cursor (single row in stripe_sync_state).
  const { data: state, error: stateErr } = await supabase
    .from("stripe_sync_state")
    .select("last_synced_at")
    .maybeSingle();
  if (stateErr || !state) {
    console.error("[stripe-poll-events] failed to read cursor:", stateErr);
    return new Response(JSON.stringify({ error: "cursor read failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const cursorIso = state.last_synced_at as string;
  const cursorUnix = Math.floor(new Date(cursorIso).getTime() / 1000);

  // 2. Pull every event created since the cursor.
  let events: Stripe.Event[] = [];
  try {
    events = await fetchEventsSince(cursorUnix);
  } catch (e) {
    console.error("[stripe-poll-events] events.list failed:", e);
    return new Response(JSON.stringify({ error: "stripe events.list failed", detail: String(e) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  console.log(`[stripe-poll-events] fetched ${events.length} events since cursor ${cursorIso}`);

  // 3. Replay oldest→newest. Errors are logged and never abort the run, mirroring
  //    stripe-webhook's fire-and-log behavior.
  const byType: Record<string, number> = {};
  let processed = 0;
  for (const event of events) {
    try {
      await handleEvent(event);
      processed++;
      byType[event.type] = (byType[event.type] ?? 0) + 1;
    } catch (err) {
      console.error(`[stripe-poll-events] handleEvent error for ${event.type} (id=${event.id}):`, err);
    }
  }

  // 4. Advance the cursor only after a successful run with at least one event.
  //    The ~2 minute safety buffer absorbs Stripe's slight out-of-order event
  //    indexing: the next poll re-sees the most recent events. That's safe —
  //    handlers are idempotent and each run replays oldest→newest, so the final
  //    state always reflects the newest event. When zero events were fetched we
  //    deliberately leave the cursor untouched: we can't be certain none are
  //    pending indexing, so the next run re-checks the same window.
  let cursorAdvanced = false;
  if (events.length > 0) {
    const newestCreated = events[events.length - 1].created ?? Math.floor(Date.now() / 1000);
    const newCursorIso = new Date((newestCreated - 120) * 1000).toISOString();
    const { error: updErr } = await supabase
      .from("stripe_sync_state")
      .update({ last_synced_at: newCursorIso })
      .eq("id", true);
    if (updErr) {
      console.error("[stripe-poll-events] failed to persist cursor:", updErr);
    } else {
      cursorAdvanced = true;
      console.log(`[stripe-poll-events] cursor advanced: ${cursorIso} → ${newCursorIso}`);
    }
  } else {
    console.log("[stripe-poll-events] no events — cursor unchanged");
  }

  return new Response(JSON.stringify({ processed, by_type: byType, fetched: events.length, cursor_advanced: cursorAdvanced }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
