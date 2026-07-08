// TEMPORARY one-off remediation — recreates the 4 broken $0 invoices correctly and re-sends them.
// Safe to delete after use.

function bunnyBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}
const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

type SqlValue = string | number | null;
async function exec(sql: string, args: SqlValue[] = []) {
  const res = await fetch(`${bunnyBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql, args: args.map((v) => v === null || v === undefined ? { type: "null" } : typeof v === "number" ? { type: "integer", value: String(v) } : { type: "text", value: String(v) }) } }, { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`Bunny ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const r = data.results[0];
  if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "bunny error");
  const cols = r.response?.result?.cols ?? [];
  return (r.response?.result?.rows ?? []).map((arr: Array<{ type: string; value?: string }>) => {
    const o: Record<string, SqlValue> = {};
    cols.forEach((c: { name: string }, i: number) => {
      const v = arr[i];
      if (!v || v.type === "null") o[c.name] = null;
      else if (v.type === "integer" || v.type === "float") o[c.name] = Number(v.value);
      else o[c.name] = v.value ?? null;
    });
    return o;
  });
}

const stripeForm = (obj: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  const add = (key: string, val: unknown) => {
    if (val === undefined || val === null) return;
    if (Array.isArray(val)) { val.forEach((v, i) => add(`${key}[${i}]`, v)); return; }
    if (typeof val === "object") { for (const [k, v] of Object.entries(val as Record<string, unknown>)) add(`${key}[${k}]`, v); return; }
    params.append(key, String(val));
  };
  for (const [k, v] of Object.entries(obj)) add(k, v);
  return params.toString();
};
async function stripeCall(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { "Authorization": `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? stripeForm(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe HTTP ${res.status}`);
  return data;
}

const brokenIds = [
  "4fea4f7a-dda4-4088-895b-7fba7fc86973",
  "f840292d-9c66-487d-ad8e-678c51e7dbdd",
  "5ab0034c-0178-4993-abaf-fb75cd388fdd",
  "b2516706-5232-4fa1-a595-693ae981759c",
];

Deno.serve(async (req) => {
  try {
    const results = [];
    for (const invId of brokenIds) {
      const invRows = await exec(`SELECT id, number, client_id, line_items, total_cents, currency, due_at FROM invoices WHERE id = ?`, [invId]);
      const inv = invRows[0];
      if (!inv) { results.push({ invId, error: "not found" }); continue; }

      const clientRows = await exec(`SELECT stripe_customer_id, name FROM clients WHERE id = ?`, [inv.client_id as string]);
      const customerId = clientRows[0]?.stripe_customer_id as string | null;
      if (!customerId) { results.push({ invId, error: "no stripe customer" }); continue; }

      const lineItems = JSON.parse((inv.line_items as string) || "[]") as Array<{ description: string; quantity: number; unit_amount_cents: number }>;
      for (const item of lineItems) {
        await stripeCall("POST", "invoiceitems", {
          customer: customerId,
          amount: Math.round((item.unit_amount_cents ?? 0) * (item.quantity ?? 1)),
          currency: ((inv.currency as string) || "CAD").toLowerCase(),
          description: item.description || "Service",
        });
      }

      const dueDays = Math.max(1, Math.round((new Date(inv.due_at as string).getTime() - Date.now()) / 86400000)) || 14;
      const created = await stripeCall("POST", "invoices", {
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: dueDays,
        pending_invoice_items_behavior: "include",
        custom_fields: [{ name: "Invoice No.", value: inv.number as string }],
        metadata: { crm_invoice_id: inv.id as string, remediation: "true" },
      });

      const finalized = await stripeCall("POST", `invoices/${created.id}/finalize`, {});
      if ((finalized.total ?? 0) <= 0) {
        results.push({ invId, error: "still $0 after fix — aborting, not sending", stripe_invoice_id: created.id });
        continue;
      }
      await stripeCall("POST", `invoices/${created.id}/send`, {});

      await exec(
        `UPDATE invoices SET status = 'open', stripe_invoice_id = ?, hosted_invoice_url = ?, pdf_url = ?, sent_at = ?, amount_paid_cents = 0, paid_at = NULL WHERE id = ?`,
        [created.id, finalized.hosted_invoice_url ?? null, finalized.invoice_pdf ?? null, new Date().toISOString(), invId],
      );

      results.push({ invId, number: inv.number, old_broken_stripe_invoice: "left as-is ($0 paid, harmless)", new_stripe_invoice_id: created.id, new_total: finalized.total, hosted_invoice_url: finalized.hosted_invoice_url });
    }
    return new Response(JSON.stringify({ results }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
