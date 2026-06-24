// Stripe webhook receiver. Mirrors invoice / subscription / payment state into the
// Bunny CRM database so the dashboard renders without round-tripping Stripe.

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

const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN")!;
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });

type SqlValue = string | number | null;
async function exec(sql: string, args: SqlValue[] = []) {
  const res = await fetch(`${bunnyBase()}/v2/pipeline`, {
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
  const res = await exec(`SELECT id FROM clients WHERE stripe_customer_id = ? LIMIT 1`, [customerId]);
  const row = res?.results?.[0]?.response?.result?.rows?.[0];
  if (!row) return null;
  return row[0]?.value ?? null;
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    // ── Invoice events ──────────────────────────────────────────────────────
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.voided": {
      const inv = event.data.object as Stripe.Invoice;
      const clientId = inv.customer ? await clientIdForCustomer(inv.customer as string) : null;
      if (!clientId) { console.warn("invoice event: no matching client for customer", inv.customer); return; }

      const stripeStatus = inv.status ?? "open";
      const crmStatus = stripeStatus === "paid" ? "paid" : stripeStatus === "void" ? "void" : "open";
      const paidAt = stripeStatus === "paid" ? now() : null;

      // Try update first (by stripe_invoice_id)
      const upd = await exec(
        `UPDATE invoices SET status=?, total_cents=?, amount_paid_cents=?, hosted_invoice_url=?, pdf_url=?, due_at=?, paid_at=?, number=? WHERE stripe_invoice_id=?`,
        [crmStatus, inv.total ?? 0, inv.amount_paid ?? 0, inv.hosted_invoice_url ?? null, inv.invoice_pdf ?? null, isoFromUnix(inv.due_date), paidAt, inv.number ?? null, inv.id],
      );
      const affected = upd?.results?.[0]?.response?.result?.affected_row_count ?? 0;
      if (affected === 0) {
        // Insert if we don't have it yet (webhook arrived before our DB write)
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
      const clientId = sub.customer ? await clientIdForCustomer(sub.customer as string) : null;
      if (!clientId) { console.warn("subscription event: no matching client for customer", sub.customer); return; }
      const crmStatus = sub.status === "active" || sub.status === "trialing" ? "active"
        : sub.status === "canceled" ? "canceled"
        : sub.status;
      const upd = await exec(
        `UPDATE subscriptions SET status=?, current_period_end=?, cancel_at_period_end=?, updated_at=? WHERE stripe_subscription_id=?`,
        [crmStatus, isoFromUnix(sub.current_period_end), sub.cancel_at_period_end ? 1 : 0, now(), sub.id],
      );
      const affected = upd?.results?.[0]?.response?.result?.affected_row_count ?? 0;
      if (affected === 0) console.warn("subscription event for unknown row", sub.id);
      else console.log(`subscription.event: ${event.type} → ${crmStatus} (clientId=${clientId})`);
      break;
    }

    // ── Payment events ──────────────────────────────────────────────────────
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const clientId = pi.customer ? await clientIdForCustomer(pi.customer as string) : null;
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
      // Also mark the linked invoice as paid
      if (invoiceId) {
        await exec(`UPDATE invoices SET status='paid', paid_at=?, amount_paid_cents=total_cents WHERE id=? AND status != 'paid'`, [now(), invoiceId]);
      }
      console.log(`payment_intent.succeeded clientId=${clientId} amount=${pi.amount_received}`);
      break;
    }

    default:
      console.log(`unhandled event type: ${event.type}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } else {
      // Accept unsigned if secret not yet configured — log a warning
      event = JSON.parse(body) as Stripe.Event;
      console.warn("STRIPE_WEBHOOK_SECRET missing — unsigned event accepted:", event.type);
    }
  } catch (err) {
    console.error("Signature verification failed:", (err as Error).message);
    return new Response(`webhook error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    await handleEvent(event);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("handler error:", err);
    return new Response((err as Error).message, { status: 500 });
  }
});
