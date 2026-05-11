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
const STORAGE_BUCKET = "client-files";

type SqlValue = string | number | null;
interface ExecRequest { sql: string; args?: SqlValue[] }
interface BunnyRow { [k: string]: SqlValue }

function bunnyHttpBase(): string { let u = (BUNNY_URL ?? "").trim().replace(/\/$/, ""); u = u.replace(/^libsql:\/\//i, "https://"); if (!/^https?:\/\//i.test(u)) u = `https://${u}`; return u; }

async function exec(req: ExecRequest) { return (await execMany([req]))[0]; }
async function execMany(stmts: ExecRequest[]) {
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [...stmts.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.args ?? []).map((v) => v === null || v === undefined ? { type: "null" } : typeof v === "number" ? { type: "integer", value: String(v) } : { type: "text", value: String(v) }) } })), { type: "close" }] }),
  });
  if (!res.ok) { const text = await res.text(); throw new Error(`Bunny HTTP ${res.status}: ${text.slice(0, 500)}`); }
  const data = await res.json() as { results: Array<{ type: string; response?: { result?: { cols: { name: string }[]; rows: Array<Array<{ type: string; value?: string }>>; affected_row_count?: number } }; error?: { message: string } }> };
  const out: { rows: BunnyRow[]; affected: number }[] = [];
  for (let i = 0; i < stmts.length; i++) {
    const r = data.results[i]; if (!r) throw new Error("missing bunny response");
    if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "unknown bunny error");
    const cols = r.response?.result?.cols ?? [];
    const rows = (r.response?.result?.rows ?? []).map((rowArr) => { const obj: BunnyRow = {}; cols.forEach((c, i) => { const v = rowArr[i]; if (!v || v.type === "null") obj[c.name] = null; else if (v.type === "integer" || v.type === "float") obj[c.name] = Number(v.value); else obj[c.name] = v.value ?? null; }); return obj; });
    out.push({ rows, affected: r.response?.result?.affected_row_count ?? 0 });
  }
  return out;
}
async function tryExec(sql: string) { try { await exec({ sql }); } catch { /* ignore */ } }

let bootstrapped = false;
async function bootstrap() {
  if (bootstrapped) return;
  await execMany([
    { sql: `CREATE TABLE IF NOT EXISTS agencies (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE TABLE IF NOT EXISTS agency_members (user_id TEXT NOT NULL, agency_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, agency_id))` },
    { sql: `INSERT OR IGNORE INTO agencies (id, name, slug, is_primary) VALUES ('citywide', 'CityWide Digital', 'citywide', 1)` },
    { sql: `CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', gbp_connection_id TEXT, stripe_customer_id TEXT, billing_email TEXT, phone TEXT, address_line1 TEXT, address_line2 TEXT, city TEXT, region TEXT, postal_code TEXT, country TEXT DEFAULT 'CA', notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS clients_gbp_idx ON clients(gbp_connection_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(status)` },
    { sql: `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, full_name TEXT NOT NULL, email TEXT, phone TEXT, role TEXT, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS contacts_client_idx ON contacts(client_id)` },
    { sql: `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, type TEXT NOT NULL, unit_amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'CAD', interval TEXT, stripe_product_id TEXT, stripe_price_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL, current_period_start TEXT, current_period_end TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, stripe_subscription_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS subs_client_idx ON subscriptions(client_id)` },
    { sql: `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, number TEXT, status TEXT NOT NULL, subtotal_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL DEFAULT 0, amount_paid_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'CAD', stripe_invoice_id TEXT UNIQUE, hosted_invoice_url TEXT, pdf_url TEXT, due_date TEXT, issued_at TEXT, paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices(client_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status)` },
    { sql: `CREATE TABLE IF NOT EXISTS invoice_items (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, product_id TEXT REFERENCES products(id), description TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit_amount_cents INTEGER NOT NULL, amount_cents INTEGER NOT NULL)` },
    { sql: `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'CAD', method TEXT, stripe_payment_id TEXT UNIQUE, paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS payments_client_idx ON payments(client_id)` },
    { sql: `CREATE TABLE IF NOT EXISTS vault_notes (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, agency_id TEXT NOT NULL DEFAULT 'citywide', title TEXT NOT NULL, body TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', pinned INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS vault_notes_client_idx ON vault_notes(client_id)` },
    { sql: `CREATE TABLE IF NOT EXISTS vault_credentials (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, agency_id TEXT NOT NULL DEFAULT 'citywide', label TEXT NOT NULL, category TEXT, url TEXT, username TEXT, password TEXT, mfa_notes TEXT, notes TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS vault_credentials_client_idx ON vault_credentials(client_id)` },
    { sql: `CREATE TABLE IF NOT EXISTS vault_files (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, agency_id TEXT NOT NULL DEFAULT 'citywide', storage_path TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER, kind TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', uploaded_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` },
    { sql: `CREATE INDEX IF NOT EXISTS vault_files_client_idx ON vault_files(client_id)` },
  ]);
  await tryExec(`ALTER TABLE clients ADD COLUMN agency_id TEXT`);
  await tryExec(`CREATE INDEX IF NOT EXISTS clients_agency_idx ON clients(agency_id)`);
  await exec({ sql: `UPDATE clients SET agency_id = 'citywide' WHERE agency_id IS NULL OR agency_id = ''` });
  bootstrapped = true;
}

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-04-10" }) : null;

async function ensureStripeCustomer(clientId: string): Promise<string | null> {
  if (!stripe) return null;
  const { rows } = await exec({ sql: `SELECT * FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
  const c = rows[0]; if (!c) throw new Error("client not found");
  if (c.stripe_customer_id) return c.stripe_customer_id as string;
  const customer = await stripe.customers.create({ name: c.name as string, email: (c.billing_email as string) ?? undefined, phone: (c.phone as string) ?? undefined, metadata: { cwd_client_id: clientId } });
  await exec({ sql: `UPDATE clients SET stripe_customer_id = ?, updated_at = ? WHERE id = ?`, args: [customer.id, now(), clientId] });
  return customer.id;
}
async function syncProductToStripe(productId: string) {
  if (!stripe) return;
  const { rows } = await exec({ sql: `SELECT * FROM products WHERE id = ? LIMIT 1`, args: [productId] });
  const p = rows[0]; if (!p) return;
  let stripeProductId = p.stripe_product_id as string | null;
  if (!stripeProductId) { const sp = await stripe.products.create({ name: p.name as string, description: (p.description as string) ?? undefined, metadata: { cwd_product_id: productId } }); stripeProductId = sp.id; }
  const priceParams: Stripe.PriceCreateParams = { product: stripeProductId, unit_amount: p.unit_amount_cents as number, currency: ((p.currency as string) ?? "cad").toLowerCase() };
  if (p.type === "subscription" && p.interval) priceParams.recurring = { interval: p.interval as Stripe.PriceCreateParams.Recurring.Interval };
  const price = await stripe.prices.create(priceParams);
  await exec({ sql: `UPDATE products SET stripe_product_id = ?, stripe_price_id = ? WHERE id = ?`, args: [stripeProductId, price.id, productId] });
}

interface AuthCtx { userId: string; isSuperAdmin: boolean; agencyId: string; }
async function resolveAuth(token: string): Promise<AuthCtx | { error: string }> {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return { error: `Invalid token: ${userErr?.message ?? "no user"}` };
  const userId = userData.user.id;
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  const { data: isAgency, error: agencyErr } = await userClient.rpc("has_role", { _user_id: userId, _role: "agency" });
  if (adminErr || agencyErr) return { error: `Role check failed: ${adminErr?.message ?? agencyErr?.message}` };
  if (!isAdmin && !isAgency) return { error: `Forbidden: agency only (uid=${userId}, isAdmin=${isAdmin}, isAgency=${isAgency})` };
  const isSuperAdmin = !!isAdmin;
  let agencyId = "citywide";
  try { const { rows } = await exec({ sql: `SELECT agency_id FROM agency_members WHERE user_id = ? LIMIT 1`, args: [userId] }); if (rows[0]?.agency_id) agencyId = rows[0].agency_id as string; } catch { /* may not exist */ }
  return { userId, isSuperAdmin, agencyId };
}
function tenantScope(ctx: AuthCtx, alias = "") {
  if (ctx.isSuperAdmin) return { sql: "", args: [] as SqlValue[] };
  const col = alias ? `${alias}.agency_id` : "agency_id";
  return { sql: `${col} = ?`, args: [ctx.agencyId] };
}
async function assertClientAccess(ctx: AuthCtx, clientId: string) {
  if (ctx.isSuperAdmin) return;
  const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
  if (!rows[0]) throw new Error("client not found");
  if (rows[0].agency_id !== ctx.agencyId) throw new Error("Forbidden: cross-agency access denied");
}

const adminStorage = createClient(SUPABASE_URL, SERVICE_KEY).storage;
function safeName(name: string) { return name.replace(/[^\w.-]+/g, "_").slice(0, 200); }

async function handle(action: string, payload: Record<string, unknown>, ctx: AuthCtx) {
  switch (action) {
    case "ping": { await exec({ sql: `SELECT 1 as ok` }); return { ok: true, bunny_host: bunnyHttpBase(), me: { user_id: ctx.userId, agency_id: ctx.agencyId, super_admin: ctx.isSuperAdmin } }; }
    case "metrics.summary": {
      const t = tenantScope(ctx); const where = t.sql ? `WHERE ${t.sql}` : "";
      const [active, mrr, outstanding, overdue] = await execMany([
        { sql: `SELECT COUNT(*) AS n FROM clients ${where ? where + " AND status='active'" : "WHERE status='active'"}`, args: t.args },
        { sql: `SELECT COALESCE(SUM(p.unit_amount_cents * s.quantity), 0) AS mrr FROM subscriptions s JOIN products p ON p.id = s.product_id JOIN clients c ON c.id = s.client_id WHERE s.status IN ('active','trialing') AND p.interval = 'month'${t.sql ? " AND c." + t.sql : ""}`, args: t.args },
        { sql: `SELECT COALESCE(SUM(i.total_cents - i.amount_paid_cents), 0) AS amt FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.status IN ('open','past_due','uncollectible')${t.sql ? " AND c." + t.sql : ""}`, args: t.args },
        { sql: `SELECT COUNT(*) AS n FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.status = 'open' AND i.due_date IS NOT NULL AND i.due_date < ?${t.sql ? " AND c." + t.sql : ""}`, args: [now(), ...t.args] },
      ]);
      return { active_clients: active.rows[0]?.n ?? 0, mrr_cents: mrr.rows[0]?.mrr ?? 0, outstanding_cents: outstanding.rows[0]?.amt ?? 0, overdue_count: overdue.rows[0]?.n ?? 0 };
    }
    case "clients.list": {
      const q = (payload.q as string | undefined)?.trim(); const status = payload.status as string | undefined;
      const where: string[] = []; const args: SqlValue[] = [];
      const t = tenantScope(ctx); if (t.sql) { where.push(t.sql); args.push(...t.args); }
      if (q) { where.push(`(name LIKE ? OR billing_email LIKE ?)`); args.push(`%${q}%`, `%${q}%`); }
      if (status) { where.push(`status = ?`); args.push(status); }
      const { rows } = await exec({ sql: `SELECT * FROM clients ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 1500`, args });
      return { clients: rows };
    }
    case "clients.get": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      const [c, contacts, subs, invs, pays] = await execMany([
        { sql: `SELECT * FROM clients WHERE id = ? LIMIT 1`, args: [id] },
        { sql: `SELECT * FROM contacts WHERE client_id = ? ORDER BY is_primary DESC, full_name`, args: [id] },
        { sql: `SELECT s.*, p.name AS product_name, p.unit_amount_cents, p.currency, p.interval FROM subscriptions s JOIN products p ON p.id = s.product_id WHERE s.client_id = ? ORDER BY s.created_at DESC`, args: [id] },
        { sql: `SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC LIMIT 50`, args: [id] },
        { sql: `SELECT * FROM payments WHERE client_id = ? ORDER BY paid_at DESC LIMIT 50`, args: [id] },
      ]);
      if (!c.rows[0]) return { error: "not found" };
      return { client: c.rows[0], contacts: contacts.rows, subscriptions: subs.rows, invoices: invs.rows, payments: pays.rows };
    }
    case "clients.create": {
      const id = uuid();
      const agencyId = (ctx.isSuperAdmin && payload.agency_id) ? (payload.agency_id as string) : ctx.agencyId;
      const fields = ["id","name","status","gbp_connection_id","billing_email","phone","address_line1","address_line2","city","region","postal_code","country","notes","agency_id","created_at","updated_at"];
      const args: SqlValue[] = [id, (payload.name as string) ?? "Untitled", (payload.status as string) ?? "active", (payload.gbp_connection_id as string) ?? null, (payload.billing_email as string) ?? null, (payload.phone as string) ?? null, (payload.address_line1 as string) ?? null, (payload.address_line2 as string) ?? null, (payload.city as string) ?? null, (payload.region as string) ?? null, (payload.postal_code as string) ?? null, (payload.country as string) ?? "CA", (payload.notes as string) ?? null, agencyId, now(), now()];
      await exec({ sql: `INSERT INTO clients (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`, args });
      return { id };
    }
    case "clients.update": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      const allowed = ["name","status","gbp_connection_id","billing_email","phone","address_line1","address_line2","city","region","postal_code","country","notes"];
      if (ctx.isSuperAdmin) allowed.push("agency_id");
      const sets: string[] = []; const args: SqlValue[] = [];
      for (const k of allowed) if (k in payload) { sets.push(`${k} = ?`); args.push((payload[k] as SqlValue) ?? null); }
      sets.push(`updated_at = ?`); args.push(now()); args.push(id);
      await exec({ sql: `UPDATE clients SET ${sets.join(", ")} WHERE id = ?`, args });
      return { ok: true };
    }
    case "clients.archive": { await assertClientAccess(ctx, payload.id as string); await exec({ sql: `UPDATE clients SET status = 'churned', updated_at = ? WHERE id = ?`, args: [now(), payload.id as string] }); return { ok: true }; }
    case "clients.bulkImport": {
      const incoming = (payload.rows as Array<Record<string, string | null | undefined>>) ?? [];
      if (!Array.isArray(incoming) || !incoming.length) return { error: "no rows" };
      const targetAgency = (ctx.isSuperAdmin && payload.agency_id) ? (payload.agency_id as string) : ctx.agencyId;
      const existing = await exec({ sql: `SELECT gbp_connection_id FROM clients WHERE gbp_connection_id IS NOT NULL` });
      const seen = new Set<string>(existing.rows.map((r) => (r.gbp_connection_id as string)).filter(Boolean));
      let inserted = 0; let skipped = 0;
      const errors: Array<{ index: number; name?: string; message: string }> = [];
      const fields = ["id","name","status","gbp_connection_id","billing_email","phone","address_line1","address_line2","city","region","postal_code","country","notes","agency_id","created_at","updated_at"];
      const insertSql = `INSERT INTO clients (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`;
      const CHUNK = 50;
      for (let i = 0; i < incoming.length; i += CHUNK) {
        const chunk = incoming.slice(i, i + CHUNK); const stmts: ExecRequest[] = []; const meta: Array<{ index: number; name: string }> = [];
        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j]; const name = (row.name ?? "").toString().trim(); const gbp = (row.gbp_connection_id ?? "").toString().trim() || null;
          if (!name) { errors.push({ index: i + j, message: "missing name" }); continue; }
          if (gbp && seen.has(gbp)) { skipped++; continue; }
          if (gbp) seen.add(gbp);
          stmts.push({ sql: insertSql, args: [uuid(), name, (row.status as string) || "prospect", gbp, (row.billing_email as string) || null, (row.phone as string) || null, (row.address_line1 as string) || null, (row.address_line2 as string) || null, (row.city as string) || null, (row.region as string) || null, (row.postal_code as string) || null, (row.country as string) || "CA", (row.notes as string) || null, targetAgency, now(), now()] });
          meta.push({ index: i + j, name });
        }
        if (!stmts.length) continue;
        try { await execMany(stmts); inserted += stmts.length; }
        catch { for (let k = 0; k < stmts.length; k++) { try { await exec(stmts[k]); inserted++; } catch (e2) { errors.push({ index: meta[k].index, name: meta[k].name, message: (e2 as Error).message }); } } }
      }
      return { inserted, skipped, errors: errors.slice(0, 50), error_count: errors.length, total: incoming.length };
    }
    case "contacts.upsert": {
      await assertClientAccess(ctx, payload.client_id as string);
      const id = (payload.id as string) || uuid();
      const exists = payload.id ? (await exec({ sql: `SELECT id FROM contacts WHERE id = ?`, args: [id] })).rows[0] : null;
      if (exists) await exec({ sql: `UPDATE contacts SET full_name = ?, email = ?, phone = ?, role = ?, is_primary = ? WHERE id = ?`, args: [payload.full_name as string, (payload.email as string) ?? null, (payload.phone as string) ?? null, (payload.role as string) ?? null, payload.is_primary ? 1 : 0, id] });
      else await exec({ sql: `INSERT INTO contacts (id, client_id, full_name, email, phone, role, is_primary) VALUES (?,?,?,?,?,?,?)`, args: [id, payload.client_id as string, payload.full_name as string, (payload.email as string) ?? null, (payload.phone as string) ?? null, (payload.role as string) ?? null, payload.is_primary ? 1 : 0] });
      return { id };
    }
    case "contacts.delete": { await exec({ sql: `DELETE FROM contacts WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }
    case "products.list": { const { rows } = await exec({ sql: `SELECT * FROM products ORDER BY active DESC, name` }); return { products: rows }; }
    case "products.upsert": {
      const id = (payload.id as string) || uuid();
      const exists = payload.id ? (await exec({ sql: `SELECT id FROM products WHERE id = ?`, args: [id] })).rows[0] : null;
      if (exists) await exec({ sql: `UPDATE products SET name=?, description=?, type=?, unit_amount_cents=?, currency=?, interval=?, active=? WHERE id=?`, args: [payload.name as string, (payload.description as string) ?? null, payload.type as string, payload.unit_amount_cents as number, ((payload.currency as string) ?? "CAD").toUpperCase(), (payload.interval as string) ?? null, payload.active === false ? 0 : 1, id] });
      else await exec({ sql: `INSERT INTO products (id, name, description, type, unit_amount_cents, currency, interval, active) VALUES (?,?,?,?,?,?,?,?)`, args: [id, payload.name as string, (payload.description as string) ?? null, payload.type as string, payload.unit_amount_cents as number, ((payload.currency as string) ?? "CAD").toUpperCase(), (payload.interval as string) ?? null, payload.active === false ? 0 : 1] });
      if (stripe) try { await syncProductToStripe(id); } catch (e) { console.warn("stripe sync", e); }
      return { id };
    }
    case "products.archive": { await exec({ sql: `UPDATE products SET active = 0 WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }
    case "subscriptions.create": {
      if (!stripe) return { error: "Stripe not configured" };
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const productId = payload.product_id as string; const qty = (payload.quantity as number) ?? 1;
      const customerId = await ensureStripeCustomer(clientId); if (!customerId) return { error: "could not create stripe customer" };
      const { rows: prodRows } = await exec({ sql: `SELECT * FROM products WHERE id = ?`, args: [productId] });
      const product = prodRows[0]; if (!product) return { error: "product not found" };
      if (!product.stripe_price_id) await syncProductToStripe(productId);
      const refreshed = (await exec({ sql: `SELECT stripe_price_id FROM products WHERE id = ?`, args: [productId] })).rows[0];
      const priceId = refreshed?.stripe_price_id as string;
      const stripeSub = await stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId, quantity: qty }], metadata: { cwd_client_id: clientId, cwd_product_id: productId } });
      const id = uuid();
      await exec({ sql: `INSERT INTO subscriptions (id, client_id, product_id, quantity, status, current_period_start, current_period_end, stripe_subscription_id) VALUES (?,?,?,?,?,?,?,?)`, args: [id, clientId, productId, qty, stripeSub.status, new Date(stripeSub.current_period_start * 1000).toISOString(), new Date(stripeSub.current_period_end * 1000).toISOString(), stripeSub.id] });
      return { id };
    }
    case "subscriptions.cancel": {
      if (!stripe) return { error: "Stripe not configured" };
      const id = payload.id as string; const atPeriodEnd = !!payload.at_period_end;
      const { rows } = await exec({ sql: `SELECT * FROM subscriptions WHERE id = ?`, args: [id] }); const sub = rows[0]; if (!sub) return { error: "not found" };
      if (atPeriodEnd) { await stripe.subscriptions.update(sub.stripe_subscription_id as string, { cancel_at_period_end: true }); await exec({ sql: `UPDATE subscriptions SET cancel_at_period_end = 1 WHERE id = ?`, args: [id] }); }
      else { await stripe.subscriptions.cancel(sub.stripe_subscription_id as string); await exec({ sql: `UPDATE subscriptions SET status = 'canceled' WHERE id = ?`, args: [id] }); }
      return { ok: true };
    }
    case "invoices.list": {
      const where: string[] = []; const args: SqlValue[] = [];
      const t = tenantScope(ctx, "c"); if (t.sql) { where.push(t.sql); args.push(...t.args); }
      if (payload.client_id) { where.push(`i.client_id = ?`); args.push(payload.client_id as string); }
      if (payload.status) { where.push(`i.status = ?`); args.push(payload.status as string); }
      const { rows } = await exec({ sql: `SELECT i.*, c.name AS client_name FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY i.created_at DESC LIMIT 200`, args });
      return { invoices: rows };
    }
    case "invoices.get": {
      const id = payload.id as string;
      const [inv, items] = await execMany([{ sql: `SELECT * FROM invoices WHERE id = ?`, args: [id] }, { sql: `SELECT * FROM invoice_items WHERE invoice_id = ?`, args: [id] }]);
      if (inv.rows[0]) await assertClientAccess(ctx, inv.rows[0].client_id as string);
      return { invoice: inv.rows[0] ?? null, items: items.rows };
    }
    case "invoices.create": {
      if (!stripe) return { error: "Stripe not configured" };
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const items = (payload.items as Array<{ description: string; quantity: number; unit_amount_cents: number; product_id?: string }>) ?? [];
      const dueDays = (payload.due_days as number) ?? 14;
      if (!items.length) return { error: "at least one line item required" };
      const customerId = await ensureStripeCustomer(clientId); if (!customerId) return { error: "could not create stripe customer" };
      for (const item of items) await stripe.invoiceItems.create({ customer: customerId, amount: item.unit_amount_cents * (item.quantity ?? 1), currency: "cad", description: item.description, quantity: item.quantity ?? 1 });
      const stripeInvoice = await stripe.invoices.create({ customer: customerId, collection_method: "send_invoice", days_until_due: dueDays, metadata: { cwd_client_id: clientId } });
      const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
      const id = uuid(); const subtotal = items.reduce((s, i) => s + i.unit_amount_cents * (i.quantity ?? 1), 0);
      await exec({ sql: `INSERT INTO invoices (id, client_id, number, status, subtotal_cents, total_cents, currency, stripe_invoice_id, hosted_invoice_url, pdf_url, due_date, issued_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, clientId, finalized.number ?? null, finalized.status ?? "open", subtotal, finalized.total ?? subtotal, (finalized.currency ?? "cad").toUpperCase(), finalized.id, finalized.hosted_invoice_url ?? null, finalized.invoice_pdf ?? null, finalized.due_date ? new Date(finalized.due_date * 1000).toISOString() : null, new Date().toISOString()] });
      for (const item of items) await exec({ sql: `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_amount_cents, amount_cents) VALUES (?,?,?,?,?,?,?)`, args: [uuid(), id, item.product_id ?? null, item.description, item.quantity ?? 1, item.unit_amount_cents, item.unit_amount_cents * (item.quantity ?? 1)] });
      return { id, hosted_invoice_url: finalized.hosted_invoice_url, stripe_invoice_id: finalized.id };
    }
    case "invoices.send": { if (!stripe) return { error: "Stripe not configured" }; const { rows } = await exec({ sql: `SELECT stripe_invoice_id FROM invoices WHERE id = ?`, args: [payload.id as string] }); const sid = rows[0]?.stripe_invoice_id as string | null; if (!sid) return { error: "invoice has no stripe id" }; await stripe.invoices.sendInvoice(sid); return { ok: true }; }
    case "invoices.void": { if (!stripe) return { error: "Stripe not configured" }; const { rows } = await exec({ sql: `SELECT stripe_invoice_id FROM invoices WHERE id = ?`, args: [payload.id as string] }); const sid = rows[0]?.stripe_invoice_id as string | null; if (sid) await stripe.invoices.voidInvoice(sid); await exec({ sql: `UPDATE invoices SET status = 'void' WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }
    case "payments.list": { const args: SqlValue[] = []; const where: string[] = []; if (payload.client_id) { where.push(`client_id = ?`); args.push(payload.client_id as string); } const { rows } = await exec({ sql: `SELECT * FROM payments ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY paid_at DESC LIMIT 200`, args }); return { payments: rows }; }

    case "vault.list": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const [notes, creds, files] = await execMany([
        { sql: `SELECT * FROM vault_notes WHERE client_id = ? ORDER BY pinned DESC, updated_at DESC`, args: [clientId] },
        { sql: `SELECT * FROM vault_credentials WHERE client_id = ? ORDER BY label`, args: [clientId] },
        { sql: `SELECT * FROM vault_files WHERE client_id = ? ORDER BY created_at DESC`, args: [clientId] },
      ]);
      return { notes: notes.rows, credentials: creds.rows, files: files.rows };
    }
    case "vault.notes.upsert": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const id = (payload.id as string) || uuid();
      const exists = payload.id ? (await exec({ sql: `SELECT id FROM vault_notes WHERE id = ?`, args: [id] })).rows[0] : null;
      const visibility = (payload.visibility as string) === "client_visible" ? "client_visible" : "agency_only";
      const pinned = payload.pinned ? 1 : 0;
      if (exists) await exec({ sql: `UPDATE vault_notes SET title=?, body=?, visibility=?, pinned=?, updated_at=? WHERE id=?`, args: [(payload.title as string) ?? "Untitled", (payload.body as string) ?? null, visibility, pinned, now(), id] });
      else { const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ?`, args: [clientId] }); const agencyId = (rows[0]?.agency_id as string) || ctx.agencyId; await exec({ sql: `INSERT INTO vault_notes (id, client_id, agency_id, title, body, visibility, pinned, created_by) VALUES (?,?,?,?,?,?,?,?)`, args: [id, clientId, agencyId, (payload.title as string) ?? "Untitled", (payload.body as string) ?? null, visibility, pinned, ctx.userId] }); }
      return { id };
    }
    case "vault.notes.delete": { await exec({ sql: `DELETE FROM vault_notes WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }
    case "vault.creds.upsert": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const id = (payload.id as string) || uuid();
      const exists = payload.id ? (await exec({ sql: `SELECT id FROM vault_credentials WHERE id = ?`, args: [id] })).rows[0] : null;
      const visibility = (payload.visibility as string) === "client_visible" ? "client_visible" : "agency_only";
      if (exists) await exec({ sql: `UPDATE vault_credentials SET label=?, category=?, url=?, username=?, password=?, mfa_notes=?, notes=?, visibility=?, updated_at=? WHERE id=?`, args: [(payload.label as string) ?? "", (payload.category as string) ?? null, (payload.url as string) ?? null, (payload.username as string) ?? null, (payload.password as string) ?? null, (payload.mfa_notes as string) ?? null, (payload.notes as string) ?? null, visibility, now(), id] });
      else { const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ?`, args: [clientId] }); const agencyId = (rows[0]?.agency_id as string) || ctx.agencyId; await exec({ sql: `INSERT INTO vault_credentials (id, client_id, agency_id, label, category, url, username, password, mfa_notes, notes, visibility, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, clientId, agencyId, (payload.label as string) ?? "", (payload.category as string) ?? null, (payload.url as string) ?? null, (payload.username as string) ?? null, (payload.password as string) ?? null, (payload.mfa_notes as string) ?? null, (payload.notes as string) ?? null, visibility, ctx.userId] }); }
      return { id };
    }
    case "vault.creds.delete": { await exec({ sql: `DELETE FROM vault_credentials WHERE id = ?`, args: [payload.id as string] }); return { ok: true }; }
    case "vault.files.uploadUrl": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const filename = safeName((payload.filename as string) || "file");
      const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ?`, args: [clientId] });
      const agencyId = (rows[0]?.agency_id as string) || ctx.agencyId;
      const fileId = uuid();
      const storagePath = `${agencyId}/${clientId}/${fileId}/${filename}`;
      const { data, error } = await adminStorage.from(STORAGE_BUCKET).createSignedUploadUrl(storagePath);
      if (error) return { error: `Storage signed-upload URL failed: ${error.message}` };
      return { upload_url: data.signedUrl, token: data.token, storage_path: storagePath, file_id: fileId };
    }
    case "vault.files.confirm": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const id = (payload.file_id as string) || uuid();
      const visibility = (payload.visibility as string) === "client_visible" ? "client_visible" : "agency_only";
      const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ?`, args: [clientId] });
      const agencyId = (rows[0]?.agency_id as string) || ctx.agencyId;
      await exec({ sql: `INSERT INTO vault_files (id, client_id, agency_id, storage_path, filename, mime_type, size_bytes, kind, visibility, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)`, args: [id, clientId, agencyId, payload.storage_path as string, payload.filename as string, (payload.mime_type as string) ?? null, (payload.size_bytes as number) ?? null, (payload.kind as string) ?? "other", visibility, ctx.userId] });
      return { id };
    }
    case "vault.files.download": {
      const id = payload.id as string;
      const { rows } = await exec({ sql: `SELECT * FROM vault_files WHERE id = ? LIMIT 1`, args: [id] });
      const f = rows[0]; if (!f) return { error: "not found" };
      await assertClientAccess(ctx, f.client_id as string);
      const { data, error } = await adminStorage.from(STORAGE_BUCKET).createSignedUrl(f.storage_path as string, 300);
      if (error) return { error: `Signed URL failed: ${error.message}` };
      return { url: data.signedUrl, filename: f.filename, mime_type: f.mime_type };
    }
    case "vault.files.delete": {
      const id = payload.id as string;
      const { rows } = await exec({ sql: `SELECT * FROM vault_files WHERE id = ? LIMIT 1`, args: [id] });
      const f = rows[0]; if (!f) return { error: "not found" };
      await assertClientAccess(ctx, f.client_id as string);
      await adminStorage.from(STORAGE_BUCKET).remove([f.storage_path as string]);
      await exec({ sql: `DELETE FROM vault_files WHERE id = ?`, args: [id] });
      return { ok: true };
    }
    case "vault.files.update": {
      const id = payload.id as string;
      const { rows } = await exec({ sql: `SELECT client_id FROM vault_files WHERE id = ? LIMIT 1`, args: [id] });
      if (!rows[0]) return { error: "not found" };
      await assertClientAccess(ctx, rows[0].client_id as string);
      const visibility = (payload.visibility as string) === "client_visible" ? "client_visible" : "agency_only";
      await exec({ sql: `UPDATE vault_files SET visibility=?, kind=COALESCE(?, kind) WHERE id=?`, args: [visibility, (payload.kind as string) ?? null, id] });
      return { ok: true };
    }
    case "agencies.list": { if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" }; const { rows } = await exec({ sql: `SELECT * FROM agencies ORDER BY is_primary DESC, name` }); return { agencies: rows }; }
    case "agencies.create": { if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" }; const id = uuid(); await exec({ sql: `INSERT INTO agencies (id, name, slug, is_primary) VALUES (?,?,?,0)`, args: [id, payload.name as string, (payload.slug as string).toLowerCase()] }); return { id }; }
    case "agencies.invite": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const email = (payload.email as string).toLowerCase();
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) return { error: listErr.message };
      const user = list.users.find((u) => u.email?.toLowerCase() === email);
      if (!user) return { error: `No user with email ${email}. Have them sign up first.` };
      await exec({ sql: `INSERT OR REPLACE INTO agency_members (user_id, agency_id, role) VALUES (?,?,?)`, args: [user.id, payload.agency_id as string, (payload.role as string) ?? "member"] });
      return { ok: true, user_id: user.id };
    }
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
