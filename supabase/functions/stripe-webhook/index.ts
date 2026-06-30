// Stripe webhook receiver — always returns 200 to Stripe (fire-and-log pattern).
// Mirrors invoice / subscription / payment state into the Bunny CRM database.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// Validate required secrets are present
const missingSecrets: string[] = [];
if (!stripeKey) missingSecrets.push("STRIPE_SECRET_KEY");
if (!webhookSecret) missingSecrets.push("STRIPE_WEBHOOK_SECRET");
if (!BUNNY_TOKEN) missingSecrets.push("BUNNY_DB_AUTH_TOKEN");
if (missingSecrets.length > 0) {
  console.warn("stripe-webhook: missing env vars:", missingSecrets.join(", "));
} else {
  console.log("stripe-webhook: all secrets present, signature verification active");
}

const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-04-10" }) : null;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Step 1: Read & verify signature ────────────────────────────────────────
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret && sig && stripe) {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } else if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not set — accepting unsigned event.");
      event = JSON.parse(body) as Stripe.Event;
    } else {
      console.error("Cannot verify webhook: stripe client or signature header missing");
      return new Response("webhook error: missing signature", { status: 400 });
    }
  } catch (err) {
    console.error("Signature verification failed:", (err as Error).message);
    return new Response(`webhook error: ${(err as Error).message}`, { status: 400 });
  }

  // ── Step 2: Always return 200 to Stripe ───────────────────────────────────
  const ack = new Response(JSON.stringify({ received: true, event: event.type }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  // ── Step 3: Process (errors logged, never propagated as 5xx) ──────────────
  try {
    await handleEvent(event);
  } catch (err) {
    console.error(`handleEvent error for ${event.type} (id=${event.id}):`, err);
  }

  return ack;
});
