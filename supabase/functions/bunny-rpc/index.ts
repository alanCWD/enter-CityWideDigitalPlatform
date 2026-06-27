// CRM gateway with Vault (notes, credentials, files) + multi-agency tenancy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUNNY_URL = Deno.env.get("BUNNY_DB_URL")!;
const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-04-10" }) : null;

type SqlValue = string | number | null;
interface ExecRequest { sql: string; args?: SqlValue[] }
interface BunnyRow { [k: string]: SqlValue }
interface BunnyCol { name: string }
interface BunnyValue { type: string; value?: string }

function bunnyHttpBase(): string {
  let u = (BUNNY_URL ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

async function exec(req: ExecRequest) { return (await execMany([req]))[0]; }
async function execMany(stmts: ExecRequest[]) {
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        ...stmts.map((s) => ({
          type: "execute",
          stmt: {
            sql: s.sql,
            args: (s.args ?? []).map((v) =>
              v === null || v === undefined ? { type: "null" } : typeof v === "number" ? { type: "integer", value: String(v) } : { type: "text", value: String(v) }
            ),
          },
        })),
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Bunny HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as { results: Array<{ type: string; response?: { result?: { cols: BunnyCol[]; rows: Array<Array<BunnyValue>> } }; error?: { message: string } }> };
  const out: { rows: BunnyRow[] }[] = [];
  for (let i = 0; i < stmts.length; i++) {
    const r = data.results[i];
    if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "bunny error");
    const cols = r.response?.result?.cols ?? [];
    const rows = (r.response?.result?.rows ?? []).map((arr) => {
      const o: BunnyRow = {};
      cols.forEach((c, i) => {
        const v = arr[i];
        if (!v || v.type === "null") o[c.name] = null;
        else if (v.type === "integer" || v.type === "float") o[c.name] = Number(v.value);
        else o[c.name] = v.value ?? null;
      });
      return o;
    });
    out.push({ rows });
  }
  return out;
}

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

let bootstrapped = false;
async function bootstrapBatch(stmts: string[]) {
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [...stmts.map((sql) => ({ type: "execute", stmt: { sql, args: [] } })), { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`Bunny bootstrap HTTP ${res.status}`);
  await res.json().catch(() => null);
}
async function bootstrap() {
  if (bootstrapped) return;
  const stmts: string[] = [
    `CREATE TABLE IF NOT EXISTS agencies (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `INSERT OR IGNORE INTO agencies (id, name, slug) VALUES ('citywide', 'Citywide Digital', 'citywide')`,
    `CREATE TABLE IF NOT EXISTS agency_members (user_id TEXT NOT NULL, agency_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, agency_id))`,
    `CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'lead', source TEXT, owner_id TEXT, billing_email TEXT, phone TEXT, address_line1 TEXT, city TEXT, region TEXT, postal_code TEXT, country TEXT, gbp_connection_id TEXT, stripe_customer_id TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE clients ADD COLUMN status TEXT NOT NULL DEFAULT 'lead'`,
    `ALTER TABLE clients ADD COLUMN source TEXT`,
    `ALTER TABLE clients ADD COLUMN owner_id TEXT`,
    `ALTER TABLE clients ADD COLUMN billing_email TEXT`,
    `ALTER TABLE clients ADD COLUMN phone TEXT`,
    `ALTER TABLE clients ADD COLUMN address_line1 TEXT`,
    `ALTER TABLE clients ADD COLUMN city TEXT`,
    `ALTER TABLE clients ADD COLUMN region TEXT`,
    `ALTER TABLE clients ADD COLUMN postal_code TEXT`,
    `ALTER TABLE clients ADD COLUMN country TEXT`,
    `ALTER TABLE clients ADD COLUMN gbp_connection_id TEXT`,
    `ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT`,
    `ALTER TABLE clients ADD COLUMN notes TEXT`,
    `ALTER TABLE clients ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE clients ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE clients ADD COLUMN agency_id TEXT NOT NULL DEFAULT 'citywide'`,
    `UPDATE clients SET agency_id = 'citywide' WHERE agency_id IS NULL OR agency_id = ''`,
    `CREATE INDEX IF NOT EXISTS clients_agency_idx ON clients(agency_id)`,
    `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, full_name TEXT NOT NULL DEFAULT '', email TEXT, phone TEXT, role TEXT, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE contacts ADD COLUMN full_name TEXT NOT NULL DEFAULT ''`,
    `UPDATE contacts SET full_name = name WHERE full_name = '' AND name IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL DEFAULT 0, unit_amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'CAD', interval TEXT, type TEXT NOT NULL DEFAULT 'subscription', stripe_product_id TEXT, stripe_price_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE products ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN unit_amount_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN type TEXT NOT NULL DEFAULT 'subscription'`,
    `ALTER TABLE products ADD COLUMN interval TEXT`,
    `ALTER TABLE products ADD COLUMN stripe_product_id TEXT`,
    `UPDATE products SET unit_amount_cents = price_cents WHERE unit_amount_cents = 0 AND price_cents > 0`,
    `CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', start_date TEXT, current_period_end TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, stripe_subscription_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT`,
    `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', subscription_id TEXT, number TEXT, subtotal_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL DEFAULT 0, amount_cents INTEGER NOT NULL DEFAULT 0, amount_paid_cents INTEGER NOT NULL DEFAULT 0, line_items TEXT, currency TEXT NOT NULL DEFAULT 'CAD', status TEXT NOT NULL DEFAULT 'draft', issued_at TEXT, due_at TEXT, paid_at TEXT, sent_at TEXT, hosted_invoice_url TEXT, pdf_url TEXT, stripe_invoice_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE invoices ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN subtotal_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN total_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN line_items TEXT`,
    `ALTER TABLE invoices ADD COLUMN agency_id TEXT NOT NULL DEFAULT 'citywide'`,
    `ALTER TABLE invoices ADD COLUMN sent_at TEXT`,
    `ALTER TABLE invoices ADD COLUMN pdf_url TEXT`,
    `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_id TEXT, client_id TEXT NOT NULL, amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'CAD', method TEXT, status TEXT NOT NULL DEFAULT 'succeeded', stripe_payment_intent_id TEXT, paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE payments ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS vault_notes (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', title TEXT NOT NULL, body TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'agency_only', pinned INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS vault_credentials (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', label TEXT NOT NULL, category TEXT, username TEXT, password TEXT, url TEXT, mfa_method TEXT, mfa_codes TEXT, notes TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE vault_credentials ADD COLUMN mfa_method TEXT`,
    `ALTER TABLE vault_credentials ADD COLUMN mfa_codes TEXT`,
    `ALTER TABLE vault_credentials ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `CREATE TABLE IF NOT EXISTS vault_files (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', storage_path TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER, kind TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', uploaded_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS health_checks (client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', key TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', weight INTEGER NOT NULL DEFAULT 1, auto INTEGER NOT NULL DEFAULT 1, client_visible INTEGER NOT NULL DEFAULT 1, evidence TEXT, evidence_url TEXT, metric_value TEXT, updated_by TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (client_id, key))`,
    `CREATE TABLE IF NOT EXISTS health_audits (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, url TEXT NOT NULL, strategy TEXT NOT NULL, performance INTEGER, seo INTEGER, accessibility INTEGER, best_practices INTEGER, lcp_ms INTEGER, cls REAL, inp_ms INTEGER, cwv_pass INTEGER, error TEXT, raw_report_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS health_citations (client_id TEXT NOT NULL, directory TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', listing_url TEXT, evidence TEXT, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (client_id, directory))`,
  ];
  try { await bootstrapBatch(stmts); } catch (e) { console.error("bootstrap batch failed", e); }
  bootstrapped = true;
}

let seedEnsured = false;
async function ensureSeedData() {
  if (seedEnsured) return;
  try {
    await execMany([
      { sql: `DELETE FROM clients WHERE id IN ('hyperdrii-1', 'hyperdrii-3', 'hyperdrii-primary')` },
      { sql: `INSERT OR IGNORE INTO clients (id, name, status, billing_email, phone, agency_id, created_at, updated_at) VALUES ('hyperdrii-2', 'HyperDrii', 'active', 'alan@citywidedigital.ca', '+1 226 225 8333', 'citywide', '2026-05-10T00:00:00Z', '2026-05-10T00:00:00Z')` },
      { sql: `UPDATE clients SET gbp_connection_id = NULL WHERE id = 'hyperdrii-2' AND gbp_connection_id = '27cd88f7-6eef-454f-a881-1df5ddb89824'` },
    ]);
  } catch (e) { console.error("ensureSeedData failed", e); }
  // (one-time migrations have been removed — data is correct in DB)
  seedEnsured = true;
}

interface AuthCtx { userId: string; isSuperAdmin: boolean; agencyId: string; }
async function resolveAuth(token: string): Promise<AuthCtx | { error: string }> {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !userData?.user) return { error: "Invalid token" };
  const userId = userData.user.id;
  const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
  const isSuperAdmin = !!ADMIN_EMAIL && userData.user.email === ADMIN_EMAIL;
  let agencyId = "citywide";
  try {
    const { rows } = await exec({ sql: `SELECT agency_id FROM agency_members WHERE user_id = ? LIMIT 1`, args: [userId] });
    if (rows[0]?.agency_id) agencyId = rows[0].agency_id as string;
  } catch { /* default to citywide */ }
  return { userId, isSuperAdmin, agencyId };
}

function tenantScope(ctx: AuthCtx): { sql: string; args: SqlValue[] } {
  if (ctx.isSuperAdmin) return { sql: "1=1", args: [] };
  return { sql: "agency_id = ?", args: [ctx.agencyId] };
}

async function assertClientAccess(ctx: AuthCtx, clientId: string): Promise<void> {
  const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
  if (!rows[0]) throw new Error(`client ${clientId} not found`);
  if (ctx.isSuperAdmin) return;
  if (rows[0].agency_id !== ctx.agencyId) throw new Error("Forbidden: client belongs to another agency");
}

async function ensureStripeCustomer(clientId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to secrets.");
  const { rows } = await exec({ sql: `SELECT stripe_customer_id, name, billing_email FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
  const client = rows[0];
  if (!client) throw new Error("Client not found");

  const createFresh = async () => {
    const customer = await stripe!.customers.create({
      name: (client.name as string) || undefined,
      email: (client.billing_email as string) || undefined,
      metadata: { crm_client_id: clientId },
    });
    await exec({ sql: `UPDATE clients SET stripe_customer_id = ? WHERE id = ?`, args: [customer.id, clientId] });
    return customer.id;
  };

  if (!client.stripe_customer_id) return createFresh();

  try {
    await stripe.customers.retrieve(client.stripe_customer_id as string);
    return client.stripe_customer_id as string;
  } catch {
    console.warn(`Stripe customer ${client.stripe_customer_id} not found, creating fresh (mode switch?)`);
    return createFresh();
  }
}

const adminStorage = createClient(SUPABASE_URL, SERVICE_KEY).storage;

function bucketFor(score: number): { bucket: "critical" | "needs_work" | "healthy" | "excellent"; label: string } {
  if (score >= 90) return { bucket: "excellent", label: "Excellent" };
  if (score >= 75) return { bucket: "healthy", label: "Healthy" };
  if (score >= 50) return { bucket: "needs_work", label: "Needs work" };
  return { bucket: "critical", label: "Critical" };
}
function statusWeight(s: string): number { return s === "pass" ? 1 : s === "warn" ? 0.5 : s === "fail" ? 0 : -1; }

async function summariseHealth(clientId: string) {
  const [checks, audits] = await execMany([
    { sql: `SELECT * FROM health_checks WHERE client_id = ? ORDER BY category, key`, args: [clientId] },
    { sql: `SELECT * FROM health_audits WHERE client_id = ? ORDER BY created_at DESC LIMIT 4`, args: [clientId] },
  ]);
  let totalWeight = 0; let earned = 0;
  for (const r of checks.rows as Array<{ status: string; weight: number }>) {
    const w = statusWeight(r.status); if (w < 0) continue;
    totalWeight += r.weight; earned += w * r.weight;
  }
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
  return { score, ...bucketFor(score), checks: checks.rows, audits: audits.rows };
}

async function handle(action: string, payload: Record<string, unknown>, ctx: AuthCtx): Promise<unknown> {
  const ts = tenantScope(ctx);
  switch (action) {
    case "ping": return { ok: true, agency_id: ctx.agencyId, super_admin: ctx.isSuperAdmin };

    case "debug.tables": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const { rows: tableRows } = await exec({ sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name` });
      const out: Array<{ table: string; count: number; columns: string[]; sample: BunnyRow | null; error?: string }> = [];
      for (const t of tableRows) {
        const tname = t.name as string;
        try {
          const { rows: countRows } = await exec({ sql: `SELECT COUNT(*) AS n FROM "${tname}"` });
          const { rows: colRows } = await exec({ sql: `PRAGMA table_info("${tname}")` });
          const { rows: sampleRows } = await exec({ sql: `SELECT * FROM "${tname}" LIMIT 1` });
          out.push({ table: tname, count: Number(countRows[0]?.n ?? 0), columns: colRows.map((r) => r.name as string), sample: sampleRows[0] ?? null });
        } catch (e) {
          out.push({ table: tname, count: -1, columns: [], sample: null, error: (e as Error).message.slice(0, 200) });
        }
      }
      return { tables: out };
    }

    case "debug.adoptClients": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const source = payload.source as string;
      if (!source) return { error: "missing source table name" };
      const map = (payload.column_map as Record<string, string>) ?? {};
      const targetCols = ["name","status","source","billing_email","phone","address_line1","city","region","postal_code","country","notes"];
      const { rows: srcColRows } = await exec({ sql: `PRAGMA table_info("${source}")` });
      const srcCols = new Set(srcColRows.map((r) => r.name as string));
      if (srcCols.size === 0) return { error: `source table ${source} not found or empty schema` };
      const resolved: Record<string, string | null> = {};
      for (const t of targetCols) { const src = map[t] ?? t; resolved[t] = srcCols.has(src) ? src : null; }
      if (!resolved.name) {
        const guess = ["business_name","company_name","title","label"].find((g) => srcCols.has(g));
        if (guess) resolved.name = guess;
      }
      if (!resolved.name) return { error: `cannot find a 'name' source column. Pass column_map: { name: "<col>" }` };
      const selectExprs = targetCols.map((t) => resolved[t] ? `"${resolved[t]}"` : `NULL`);
      const idExpr = srcCols.has("id") ? `"id"` : `lower(hex(randomblob(16)))`;
      const sql = `INSERT OR IGNORE INTO clients (id, name, status, source, billing_email, phone, address_line1, city, region, postal_code, country, notes, agency_id) SELECT ${idExpr}, ${selectExprs.join(", ")}, 'citywide' FROM "${source}"`;
      await exec({ sql });
      const { rows: countRows } = await exec({ sql: `SELECT COUNT(*) AS n FROM clients` });
      return { ok: true, total_clients: Number(countRows[0]?.n ?? 0), source, mapping_used: resolved };
    }

    case "metrics.summary": {
      const [clients, mrr, openInv, paid30] = await execMany([
        { sql: `SELECT COUNT(*) as count FROM clients WHERE status = 'active' AND ${ts.sql}`, args: ts.args },
        { sql: `SELECT COALESCE(SUM(p.unit_amount_cents * s.quantity), 0) as cents FROM subscriptions s JOIN products p ON p.id = s.product_id JOIN clients c ON c.id = s.client_id WHERE s.status IN ('active','trialing') AND ${ts.sql.replace(/agency_id/g, "c.agency_id")}`, args: ts.args },
        { sql: `SELECT COUNT(*) as count, COALESCE(SUM(total_cents),0) as cents FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.status IN ('open','past_due') AND ${ts.sql.replace(/agency_id/g, "c.agency_id")}`, args: ts.args },
        { sql: `SELECT COALESCE(SUM(amount_cents),0) as cents FROM payments p JOIN clients c ON c.id = p.client_id WHERE p.status = 'succeeded' AND p.paid_at >= datetime('now','-30 day') AND ${ts.sql.replace(/agency_id/g, "c.agency_id")}`, args: ts.args },
      ]);
      return { active_clients: clients.rows[0]?.count ?? 0, mrr_cents: mrr.rows[0]?.cents ?? 0, overdue_count: openInv.rows[0]?.count ?? 0, outstanding_cents: openInv.rows[0]?.cents ?? 0, paid30_cents: paid30.rows[0]?.cents ?? 0 };
    }

    case "products.list": {
      const { rows } = await exec({ sql: `SELECT id, name, description, type, unit_amount_cents, price_cents, currency, interval, stripe_product_id, stripe_price_id, active, created_at FROM products WHERE active = 1 ORDER BY unit_amount_cents ASC` });
      return { products: rows };
    }
    case "products.upsert": {
      const id = (payload.id as string) || uuid();
      const cents = (payload.unit_amount_cents ?? payload.price_cents ?? 0) as number;
      const productName = payload.name as string;
      const productType = (payload.type as string) ?? "subscription";
      const interval = (payload.interval as string) ?? null;
      const currency = ((payload.currency as string) ?? "CAD").toLowerCase();
      const active = (payload.active as number) ?? 1;

      const { rows: existing } = await exec({ sql: `SELECT stripe_product_id, stripe_price_id, unit_amount_cents, interval FROM products WHERE id = ? LIMIT 1`, args: [id] });
      const ex = existing[0];

      let stripeProductId = (ex?.stripe_product_id ?? payload.stripe_product_id ?? null) as string | null;
      let stripePriceId = (ex?.stripe_price_id ?? payload.stripe_price_id ?? null) as string | null;

      if (stripe) {
        try {
          if (!stripeProductId) {
            const sp = await stripe.products.create({ name: productName, description: (payload.description as string) || undefined, metadata: { crm_product_id: id } });
            stripeProductId = sp.id;
          } else {
            try {
              await stripe.products.update(stripeProductId, { name: productName, description: (payload.description as string) || undefined, active: !!active });
            } catch {
              console.warn(`Stripe product ${stripeProductId} not found, creating fresh (mode switch?)`);
              stripeProductId = null;
              stripePriceId = null;
              const sp = await stripe.products.create({ name: productName, description: (payload.description as string) || undefined, metadata: { crm_product_id: id } });
              stripeProductId = sp.id;
            }
          }

          const priceChanged = !ex || ex.unit_amount_cents !== cents || ex.interval !== interval || !stripePriceId;
          if (priceChanged && stripeProductId) {
            if (stripePriceId) {
              try { await stripe.prices.update(stripePriceId, { active: false }); } catch { /* stale — ignore */ }
            }
            const priceParams: Stripe.PriceCreateParams = { product: stripeProductId, unit_amount: cents, currency };
            if (productType === "subscription" && interval) {
              priceParams.recurring = { interval: interval as "month" | "year" };
            }
            const sp = await stripe.prices.create(priceParams);
            stripePriceId = sp.id;
          }
        } catch (stripeErr) {
          console.error("Stripe product sync failed:", stripeErr);
        }
      }

      await exec({ sql: `INSERT INTO products (id, name, description, type, price_cents, unit_amount_cents, currency, interval, stripe_product_id, stripe_price_id, active) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, type=excluded.type, price_cents=excluded.price_cents, unit_amount_cents=excluded.unit_amount_cents, currency=excluded.currency, interval=excluded.interval, stripe_product_id=excluded.stripe_product_id, stripe_price_id=excluded.stripe_price_id, active=excluded.active`, args: [id, productName, (payload.description as string) ?? null, productType, cents, cents, (payload.currency as string) ?? "CAD", interval, stripeProductId, stripePriceId, active] });
      return { id, stripe_product_id: stripeProductId, stripe_price_id: stripePriceId };
    }

    case "clients.list": {
      const status = payload.status as string | undefined;
      const search = (payload.q ?? payload.search) as string | undefined;
      const where: string[] = [ts.sql]; const args: SqlValue[] = [...ts.args];
      if (status && status !== "all") { where.push("status = ?"); args.push(status); }
      else if (!status) { where.push("status != 'archived'"); }
      if (search) { where.push("(name LIKE ? OR billing_email LIKE ? OR city LIKE ?)"); const s = `%${search}%`; args.push(s, s, s); }
      const limit = Math.min(Number(payload.limit ?? 100), 500);
      const offset = Number(payload.offset ?? 0);
      const whereClause = where.join(" AND ");
      const [{ rows }, { rows: countRows }] = await execMany([
        { sql: `SELECT id, name, status, billing_email, phone, city, region, gbp_connection_id, agency_id, created_at, updated_at FROM clients WHERE ${whereClause} ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'prospect' THEN 2 WHEN 'lead' THEN 3 WHEN 'paused' THEN 4 WHEN 'churned' THEN 5 ELSE 6 END, name ASC LIMIT ? OFFSET ?`, args: [...args, limit, offset] },
        { sql: `SELECT COUNT(*) as total FROM clients WHERE ${whereClause}`, args },
      ]);
      return { clients: rows, total: Number(countRows[0]?.total ?? 0), limit, offset };
    }
    case "clients.get": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      const [client, contacts, subs, invs, pays] = await execMany([
        { sql: `SELECT * FROM clients WHERE id = ? LIMIT 1`, args: [id] },
        { sql: `SELECT id, client_id, full_name, email, phone, role, is_primary, created_at FROM contacts WHERE client_id = ? ORDER BY is_primary DESC, full_name ASC`, args: [id] },
        { sql: `SELECT s.*, p.name as product_name, p.unit_amount_cents, p.currency as product_currency, p.interval as product_interval FROM subscriptions s JOIN products p ON p.id = s.product_id WHERE s.client_id = ? ORDER BY s.created_at DESC`, args: [id] },
        { sql: `SELECT id, client_id, number, status, subtotal_cents, tax_cents, total_cents, amount_paid_cents, currency, line_items, issued_at, due_at as due_date, paid_at, sent_at, hosted_invoice_url, pdf_url, stripe_invoice_id, created_at FROM invoices WHERE client_id = ? ORDER BY issued_at DESC LIMIT 50`, args: [id] },
        { sql: `SELECT * FROM payments WHERE client_id = ? ORDER BY paid_at DESC LIMIT 50`, args: [id] },
      ]);
      return { client: client.rows[0] ?? null, contacts: contacts.rows, subscriptions: subs.rows, invoices: invs.rows, payments: pays.rows };
    }
    case "clients.create": {
      const id = (payload.id as string) || uuid();
      await exec({ sql: `INSERT INTO clients (id, name, status, source, owner_id, billing_email, phone, address_line1, city, region, postal_code, country, gbp_connection_id, notes, agency_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, payload.name as string, (payload.status as string) ?? "lead", (payload.source as string) ?? null, (payload.owner_id as string) ?? null, (payload.billing_email as string) ?? null, (payload.phone as string) ?? null, (payload.address_line1 as string) ?? null, (payload.city as string) ?? null, (payload.region as string) ?? null, (payload.postal_code as string) ?? null, (payload.country as string) ?? null, (payload.gbp_connection_id as string) ?? null, (payload.notes as string) ?? null, ctx.agencyId] });
      return { id };
    }
    case "clients.update": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      const fields: string[] = []; const args: SqlValue[] = [];
      const updatable = ["name","status","source","owner_id","billing_email","phone","address_line1","city","region","postal_code","country","gbp_connection_id","stripe_customer_id","notes"];
      for (const k of updatable) if (k in payload) { fields.push(`${k} = ?`); args.push((payload[k] as SqlValue) ?? null); }
      fields.push("updated_at = ?"); args.push(now());
      args.push(id);
      await exec({ sql: `UPDATE clients SET ${fields.join(", ")} WHERE id = ?`, args });
      return { ok: true };
    }
    case "clients.archive": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      await exec({ sql: `UPDATE clients SET status = 'archived', updated_at = ? WHERE id = ?`, args: [now(), id] });
      return { ok: true };
    }
    case "clients.delete": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      await exec({ sql: `DELETE FROM clients WHERE id = ?`, args: [id] });
      return { ok: true };
    }
    case "clients.bulkImport": {
      const items = (payload.items as Array<Record<string, SqlValue>>) ?? [];
      let created = 0; let skipped = 0;
      for (const r of items) {
        const id = uuid();
        try {
          await exec({ sql: `INSERT INTO clients (id, name, status, source, billing_email, phone, address_line1, city, region, postal_code, country, notes, agency_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, (r.name as string) ?? "Untitled", (r.status as string) ?? "lead", (r.source as string) ?? "import", (r.billing_email as string) ?? null, (r.phone as string) ?? null, (r.address_line1 as string) ?? null, (r.city as string) ?? null, (r.region as string) ?? null, (r.postal_code as string) ?? null, (r.country as string) ?? null, (r.notes as string) ?? null, ctx.agencyId] });
          created++;
        } catch { skipped++; }
      }
      return { created, skipped };
    }

    case "contacts.upsert": {
      const id = (payload.id as string) || uuid();
      await assertClientAccess(ctx, payload.client_id as string);
      const contactName = (payload.full_name ?? payload.name) as string;
      await exec({ sql: `INSERT INTO contacts (id, client_id, full_name, email, phone, role, is_primary) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name, email=excluded.email, phone=excluded.phone, role=excluded.role, is_primary=excluded.is_primary`, args: [id, payload.client_id as string, contactName, (payload.email as string) ?? null, (payload.phone as string) ?? null, (payload.role as string) ?? null, (payload.is_primary as number) ?? 0] });
      return { id };
    }
    case "contacts.delete": { await exec({ sql: `DELETE FROM contacts WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }

    case "subscriptions.create": {
      await assertClientAccess(ctx, payload.client_id as string);
      const id = uuid();
      await exec({ sql: `INSERT INTO subscriptions (id, client_id, product_id, quantity, status, start_date) VALUES (?,?,?,?,?,?)`, args: [id, payload.client_id as string, payload.product_id as string, (payload.quantity as number) ?? 1, "active", now()] });
      let stripeWarning: string | null = null;
      if (stripe && payload.product_id) {
        try {
          const { rows: prodRows } = await exec({ sql: `SELECT stripe_price_id FROM products WHERE id = ? LIMIT 1`, args: [payload.product_id as string] });
          const stripePriceId = prodRows[0]?.stripe_price_id as string | null;
          if (!stripePriceId) {
            stripeWarning = "This product has no Stripe price. Open Catalog, open the product, and click Save & Sync to Stripe — then re-create the subscription.";
          } else {
            const customerId = await ensureStripeCustomer(payload.client_id as string);
            const method = (payload.collection_method as string) === "send_invoice" ? "send_invoice" : "charge_automatically";
            const stripeSub = await stripe.subscriptions.create({
              customer: customerId,
              items: [{ price: stripePriceId, quantity: (payload.quantity as number) ?? 1 }],
              collection_method: method,
              ...(method === "send_invoice" ? { days_until_due: 30 } : {}),
              payment_settings: { save_default_payment_method: "on_subscription" },
              metadata: { crm_subscription_id: id },
            });
            await exec({ sql: `UPDATE subscriptions SET stripe_subscription_id = ? WHERE id = ?`, args: [stripeSub.id, id] });
          }
        } catch (stripeErr) {
          console.error("Stripe subscription create failed:", stripeErr);
          const msg = (stripeErr as Error).message ?? "Stripe sync failed";
          stripeWarning = msg.includes("No such price") || msg.includes("resource_missing")
            ? "The product's Stripe price is stale (test-mode ID used in live mode). Go to Catalog → open the product → Save & Sync to Stripe, then re-create this subscription."
            : msg.slice(0, 300);
        }
      }
      return { id, stripe_warning: stripeWarning };
    }
    case "subscriptions.cancel": {
      const { rows: subRows } = await exec({ sql: `SELECT stripe_subscription_id FROM subscriptions WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const stripeSub = subRows[0]?.stripe_subscription_id as string | null;
      if (stripe && stripeSub) {
        try {
          if (payload.at_period_end) {
            await stripe.subscriptions.update(stripeSub, { cancel_at_period_end: true });
          } else {
            await stripe.subscriptions.cancel(stripeSub);
          }
        } catch (e) { console.warn("Stripe subscription cancel failed:", e); }
      }
      await exec({ sql: `UPDATE subscriptions SET status = ?, cancel_at_period_end = ?, updated_at = ? WHERE id = ?`, args: [payload.at_period_end ? "active" : "canceled", payload.at_period_end ? 1 : 0, now(), payload.id as string] });
      return { ok: true };
    }
    case "subscriptions.syncStripe": {
      const { rows } = await exec({ sql: `SELECT s.*, p.stripe_price_id FROM subscriptions s JOIN products p ON p.id = s.product_id WHERE s.id = ? LIMIT 1`, args: [payload.id as string] });
      const sub = rows[0];
      if (!sub) throw new Error("Subscription not found");
      if (!stripe) throw new Error("Stripe is not configured");
      const stripePriceId = sub.stripe_price_id as string | null;
      if (!stripePriceId) throw new Error("Product has no Stripe price — open Catalog, open this product, and click Save & Sync to Stripe first.");
      const customerId = await ensureStripeCustomer(sub.client_id as string);
      const method = (payload.collection_method as string) === "send_invoice" ? "send_invoice" : "charge_automatically";
      const stripeSub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePriceId, quantity: (sub.quantity as number) ?? 1 }],
        collection_method: method,
        ...(method === "send_invoice" ? { days_until_due: 30 } : {}),
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata: { crm_subscription_id: sub.id as string },
      });
      await exec({ sql: `UPDATE subscriptions SET stripe_subscription_id = ? WHERE id = ?`, args: [stripeSub.id, sub.id as string] });
      return { ok: true, stripe_subscription_id: stripeSub.id };
    }
    case "subscriptions.delete": {
      const { rows: subRows } = await exec({ sql: `SELECT stripe_subscription_id FROM subscriptions WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const stripeSub = subRows[0]?.stripe_subscription_id as string | null;
      if (stripe && stripeSub) {
        try { await stripe.subscriptions.cancel(stripeSub); } catch (e) { console.warn("Stripe subscription cancel failed:", e); }
      }
      await exec({ sql: `DELETE FROM subscriptions WHERE id = ?`, args: [payload.id as string] });
      return { ok: true };
    }

    case "invoices.create": {
      await assertClientAccess(ctx, payload.client_id as string);
      type LineItem = { description: string; quantity: number; unit_amount_cents: number; product_id?: string };
      const items = (payload.items as LineItem[]) ?? [];
      const subtotal = items.reduce((s, i) => s + (i.unit_amount_cents * (i.quantity || 1)), 0);
      const total = subtotal;
      const dueDays = (payload.due_days as number) ?? 14;
      const issuedAt = now();
      const dueAt = new Date(Date.now() + dueDays * 86400000).toISOString();
      const { rows: countRows } = await exec({ sql: `SELECT COUNT(*) as n FROM invoices` });
      const seq = Number(countRows[0]?.n ?? 0) + 1;
      const invoiceNum = `INV-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
      const id = uuid();
      await exec({ sql: `INSERT INTO invoices (id, client_id, agency_id, number, subtotal_cents, tax_cents, total_cents, amount_cents, amount_paid_cents, line_items, currency, status, issued_at, due_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, payload.client_id as string, ctx.agencyId, invoiceNum, subtotal, 0, total, total, 0, JSON.stringify(items), "CAD", "draft", issuedAt, dueAt] });
      return { id, number: invoiceNum };
    }
    case "invoices.send": {
      const { rows } = await exec({ sql: `SELECT * FROM invoices WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const inv = rows[0];
      if (!inv) throw new Error("Invoice not found");
      let hostedUrl = inv.hosted_invoice_url as string | null;
      let pdfUrl = inv.pdf_url as string | null;
      let stripeInvoiceId = inv.stripe_invoice_id as string | null;
      if (stripe) {
        try {
          const customerId = await ensureStripeCustomer(inv.client_id as string);
          type LineItem = { description: string; quantity: number; unit_amount_cents: number };
          const lineItems: LineItem[] = JSON.parse((inv.line_items as string) || "[]");
          const dueDays = Math.max(1, Math.round((new Date(inv.due_at as string).getTime() - Date.now()) / 86400000)) || 14;
          for (const item of lineItems) {
            await stripe.invoiceItems.create({ customer: customerId, amount: Math.round((item.unit_amount_cents ?? 0) * (item.quantity ?? 1)), currency: ((inv.currency as string) || "CAD").toLowerCase(), description: item.description || "Service" });
          }
          const stripeInv = await stripe.invoices.create({ customer: customerId, collection_method: "send_invoice", days_until_due: dueDays, metadata: { crm_invoice_id: inv.id as string } });
          stripeInvoiceId = stripeInv.id;
          const finalized = await stripe.invoices.finalizeInvoice(stripeInv.id);
          hostedUrl = finalized.hosted_invoice_url ?? null;
          pdfUrl = finalized.invoice_pdf ?? null;
          await stripe.invoices.sendInvoice(stripeInv.id);
        } catch (stripeErr) { console.error("Stripe invoice send failed:", stripeErr); }
      }
      await exec({ sql: `UPDATE invoices SET status = 'open', sent_at = ?, stripe_invoice_id = ?, hosted_invoice_url = ?, pdf_url = ? WHERE id = ?`, args: [now(), stripeInvoiceId, hostedUrl, pdfUrl, payload.id as string] });
      return { ok: true, hosted_invoice_url: hostedUrl, pdf_url: pdfUrl, stripe_invoice_id: stripeInvoiceId };
    }
    case "invoices.markPaid": {
      await exec({ sql: `UPDATE invoices SET status = 'paid', paid_at = ?, amount_paid_cents = total_cents WHERE id = ?`, args: [now(), payload.id as string] });
      return { ok: true };
    }
    case "invoices.markUnpaid": {
      await exec({ sql: `UPDATE invoices SET status = 'open', paid_at = NULL, amount_paid_cents = 0 WHERE id = ?`, args: [payload.id as string] });
      return { ok: true };
    }
    case "invoices.list": {
      const invWhere: string[] = ["1=1"]; const invArgs: SqlValue[] = [];
      if (payload.client_id) { invWhere.push("i.client_id = ?"); invArgs.push(payload.client_id as string); }
      if (payload.status) { invWhere.push("i.status = ?"); invArgs.push(payload.status as string); }
      const { rows } = await exec({ sql: `SELECT i.id, i.client_id, c.name as client_name, i.number, i.status, i.subtotal_cents, i.tax_cents, i.total_cents, i.amount_cents, i.amount_paid_cents, i.currency, i.line_items, i.issued_at, i.due_at as due_date, i.paid_at, i.sent_at, i.hosted_invoice_url, i.pdf_url, i.stripe_invoice_id, i.created_at FROM invoices i JOIN clients c ON c.id = i.client_id WHERE ${invWhere.join(" AND ")} ORDER BY i.issued_at DESC LIMIT 200`, args: invArgs });
      return { invoices: rows };
    }

    case "vault.list": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const [notes, creds, files] = await execMany([
        { sql: `SELECT * FROM vault_notes WHERE client_id = ? ORDER BY pinned DESC, updated_at DESC`, args: [clientId] },
        { sql: `SELECT id, client_id, agency_id, label, category, username, password, url, mfa_codes as mfa_notes, notes, visibility, created_by, created_at, updated_at FROM vault_credentials WHERE client_id = ? ORDER BY label ASC`, args: [clientId] },
        { sql: `SELECT * FROM vault_files WHERE client_id = ? ORDER BY created_at DESC`, args: [clientId] },
      ]);
      return { notes: notes.rows, credentials: creds.rows, files: files.rows };
    }
    case "vault.notes.upsert": {
      const id = (payload.id as string) || uuid();
      await assertClientAccess(ctx, payload.client_id as string);
      await exec({ sql: `INSERT INTO vault_notes (id, client_id, agency_id, title, body, visibility, pinned, created_by) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, visibility=excluded.visibility, pinned=excluded.pinned, updated_at=CURRENT_TIMESTAMP`, args: [id, payload.client_id as string, ctx.agencyId, payload.title as string, (payload.body as string) ?? null, (payload.visibility as string) ?? "agency_only", (payload.pinned as number) ?? 0, ctx.userId] });
      return { id };
    }
    case "vault.notes.delete": { await exec({ sql: `DELETE FROM vault_notes WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }
    case "vault.creds.upsert": {
      const id = (payload.id as string) || uuid();
      await assertClientAccess(ctx, payload.client_id as string);
      await exec({ sql: `INSERT INTO vault_credentials (id, client_id, agency_id, label, category, username, password, url, mfa_codes, notes, visibility, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label, category=excluded.category, username=excluded.username, password=excluded.password, url=excluded.url, mfa_codes=excluded.mfa_codes, notes=excluded.notes, visibility=excluded.visibility, updated_at=CURRENT_TIMESTAMP`, args: [id, payload.client_id as string, ctx.agencyId, payload.label as string, (payload.category as string) ?? null, (payload.username as string) ?? null, (payload.password as string) ?? null, (payload.url as string) ?? null, (payload.mfa_notes as string) ?? null, (payload.notes as string) ?? null, (payload.visibility as string) ?? "agency_only", ctx.userId] });
      return { id };
    }
    case "vault.creds.delete": { await exec({ sql: `DELETE FROM vault_credentials WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }
    case "vault.files.uploadUrl": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      try { await adminStorage.createBucket("vault", { public: false }); } catch { /* already exists */ }
      const fileId = uuid();
      const storagePath = `${ctx.agencyId}/${clientId}/${fileId}/${(payload.filename as string).replace(/[^\w.-]+/g, "_")}`;
      const { data, error } = await adminStorage.from("vault").createSignedUploadUrl(storagePath);
      if (error || !data) throw new Error(error?.message ?? "Failed to create upload URL");
      return { upload_url: data.signedUrl, token: data.token, storage_path: storagePath, file_id: fileId };
    }
    case "vault.files.confirm": {
      const id = (payload.file_id as string) || uuid();
      await assertClientAccess(ctx, payload.client_id as string);
      await exec({ sql: `INSERT OR REPLACE INTO vault_files (id, client_id, agency_id, storage_path, filename, mime_type, size_bytes, kind, visibility, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)`, args: [id, payload.client_id as string, ctx.agencyId, payload.storage_path as string, payload.filename as string, (payload.mime_type as string) ?? null, (payload.size_bytes as number) ?? null, (payload.kind as string) ?? "other", (payload.visibility as string) ?? "agency_only", ctx.userId] });
      return { id };
    }
    case "vault.files.download": {
      const { rows } = await exec({ sql: `SELECT storage_path, filename, mime_type FROM vault_files WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      if (!rows[0]) throw new Error("File not found");
      const { data, error } = await adminStorage.from("vault").createSignedUrl(rows[0].storage_path as string, 3600);
      if (error || !data) throw new Error(error?.message ?? "Failed to create download URL");
      return { url: data.signedUrl, filename: rows[0].filename, mime_type: rows[0].mime_type };
    }
    case "vault.files.delete": {
      const { rows } = await exec({ sql: `SELECT storage_path FROM vault_files WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      if (rows[0]) { await adminStorage.from("vault").remove([rows[0].storage_path as string]); await exec({ sql: `DELETE FROM vault_files WHERE id = ?`, args: [payload.id as string] }); }
      return { ok: true };
    }
    case "vault.files.update": {
      const fields: string[] = []; const args: SqlValue[] = [];
      if ("visibility" in payload) { fields.push("visibility = ?"); args.push(payload.visibility as string); }
      if ("kind" in payload) { fields.push("kind = ?"); args.push(payload.kind as string); }
      if (fields.length) { args.push(payload.id as string); await exec({ sql: `UPDATE vault_files SET ${fields.join(", ")} WHERE id = ?`, args }); }
      return { ok: true };
    }

    case "agencies.list": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const { rows } = await exec({ sql: `SELECT * FROM agencies ORDER BY name ASC` });
      return rows;
    }

    case "health.summary": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      return await summariseHealth(clientId);
    }
    case "health.refreshAuto": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      return { ok: true, ...(await summariseHealth(clientId)) };
    }
    case "health.runLighthouse": return { error: "Lighthouse audit temporarily disabled" };
    case "health.runCitations": return { error: "Citation scan temporarily disabled" };

    default: return { error: `unknown action: ${action}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing bearer token" });
    if (!BUNNY_URL || !BUNNY_TOKEN) return json({ error: "Bunny database not configured" });
    await bootstrap();
    await ensureSeedData();
    const ctxOrErr = await resolveAuth(token);
    if ("error" in ctxOrErr) return json(ctxOrErr);
    const body = await req.json().catch(() => ({}));
    const result = await handle(body.action as string, (body.payload as Record<string, unknown>) ?? {}, ctxOrErr);
    return json(result);
  } catch (err) {
    console.error("bunny-rpc error", err);
    return json({ error: (err as Error).message ?? "internal error" });
  }
});
