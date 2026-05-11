// Stripe webhook receiver. Mirrors invoice / subscription / payment state into the
// Bunny CRM database so the dashboard renders without round-tripping Stripe.
//
// To use: register an endpoint in Stripe pointing to this function URL and select
// the events listed below. Paste the resulting signing secret into STRIPE_WEBHOOK_SECRET.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUNNY_URL = Deno.env.get("BUNNY_DB_URL")!;
const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN")!;
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

type SqlValue = string | number | null;
async function exec(sql: string, args: SqlValue[] = []) {
  const res = await fetch(`${BUNNY_URL.replace(/\/$/, "")}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        type: "execute",
        stmt: {
          sql,
          args: args.map((v) => v === null || v === undefined
            ? { type: "null" }
            : typeof v === "number"
              ? { type: "integer", value: String(v) }
              : { type: "text", value: String(v) }),
        },
      }],
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
  const v = row[0];
  return v?.value ?? null;
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided": {
      const inv = event.data.object as Stripe.Invoice;
      const clientId = inv.customer ? await clientIdForCustomer(inv.customer as string) : null;
      if (!clientId) return;
      // Upsert: try update, then insert if no rows touched
      const upd = await exec(
        `UPDATE invoices SET status=?, total_cents=?, amount_paid_cents=?, hosted_invoice_url=?, pdf_url=?, due_date=?, paid_at=?, number=? WHERE stripe_invoice_id=?`,
        [
          inv.status ?? "open",
          inv.total ?? 0,
          inv.amount_paid ?? 0,
          inv.hosted_invoice_url ?? null,
          inv.invoice_pdf ?? null,
          isoFromUnix(inv.due_date),
          inv.status === "paid" ? now() : null,
          inv.number ?? null,
          inv.id,
        ],
      );
      const affected = upd?.results?.[0]?.response?.result?.affected_row_count ?? 0;
      if (affected === 0) {
        await exec(
          `INSERT INTO invoices (id, client_id, number, status, subtotal_cents, total_cents, amount_paid_cents, currency, stripe_invoice_id, hosted_invoice_url, pdf_url, due_date, issued_at, paid_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            uuid(), clientId,
            inv.number ?? null,
            inv.status ?? "open",
            inv.subtotal ?? 0,
            inv.total ?? 0,
            inv.amount_paid ?? 0,
            (inv.currency ?? "cad").toUpperCase(),
            inv.id,
            inv.hosted_invoice_url ?? null,
            inv.invoice_pdf ?? null,
            isoFromUnix(inv.due_date),
            now(),
            inv.status === "paid" ? now() : null,
          ],
        );
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const clientId = sub.customer ? await clientIdForCustomer(sub.customer as string) : null;
      if (!clientId) return;
      const upd = await exec(
        `UPDATE subscriptions SET status=?, current_period_start=?, current_period_end=?, cancel_at_period_end=? WHERE stripe_subscription_id=?`,
        [
          sub.status,
          isoFromUnix(sub.current_period_start),
          isoFromUnix(sub.current_period_end),
          sub.cancel_at_period_end ? 1 : 0,
          sub.id,
        ],
      );
      const affected = upd?.results?.[0]?.response?.result?.affected_row_count ?? 0;
      if (affected === 0) {
        // Could not find — best effort: don't insert (we don't know the product mapping).
        console.warn("subscription event for unknown row", sub.id);
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const clientId = pi.customer ? await clientIdForCustomer(pi.customer as string) : null;
      if (!clientId) return;
      // Resolve invoice id (if any) from charges
      const invoiceStripeId = (pi.invoice as string | null) ?? null;
      let invoiceId: string | null = null;
      if (invoiceStripeId) {
        const r = await exec(`SELECT id FROM invoices WHERE stripe_invoice_id = ? LIMIT 1`, [invoiceStripeId]);
        const row = r?.results?.[0]?.response?.result?.rows?.[0];
        invoiceId = row?.[0]?.value ?? null;
      }
      await exec(
        `INSERT OR IGNORE INTO payments (id, invoice_id, client_id, amount_cents, currency, method, stripe_payment_id, paid_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          uuid(), invoiceId, clientId,
          pi.amount_received ?? pi.amount,
          (pi.currency ?? "cad").toUpperCase(),
          pi.payment_method_types?.[0] ?? "card",
          pi.id,
          now(),
        ],
      );
      break;
    }
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
      // Fallback (no secret yet) — accept the JSON as-is. Configure the secret ASAP.
      event = JSON.parse(body) as Stripe.Event;
      console.warn("STRIPE_WEBHOOK_SECRET missing — accepting unsigned event:", event.type);
    }
  } catch (err) {
    console.error("signature verification failed", err);
    return new Response(`webhook error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    await handleEvent(event);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("handler error", err);
    return new Response((err as Error).message, { status: 500 });
  }
});
