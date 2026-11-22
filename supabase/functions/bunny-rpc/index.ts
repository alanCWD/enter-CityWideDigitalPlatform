// CRM gateway with Vault (notes, credentials, files) + multi-agency tenancy.
// (redeploy trigger: invoices.resend action)
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

// ── Inbox Pro handoff signing ───────────────────────────────────────────────
// The launch secret never leaves the server. Only the signed token is handed to
// the browser, which navigates straight to Inbox Pro with it.
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlEncodeText(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text));
}
async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

/** How the signed-in user should appear to Inbox Pro for this client. */
async function resolveLaunchRole(ctx: AuthCtx, connectionId: string | null): Promise<"admin" | "agent" | "customer"> {
  // Citywide staff provision and manage the client's Inbox Pro.
  if (ctx.isStaff) return "admin";
  if (!connectionId) return "customer";
  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data } = await adminClient
      .from("portal_users")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("connection_id", connectionId)
      .maybeSingle();
    const role = String((data as { role?: string } | null)?.role ?? "").toLowerCase();
    if (role === "owner" || role === "admin") return "admin";
    if (role === "staff" || role === "agent" || role === "member") return "agent";
    return "customer";
  } catch {
    return "customer";
  }
}

// ── Inbox Pro tenant sync ───────────────────────────────────────────────────
// Server-side only: the sync secret never reaches the browser. Each change is
// one upsert with a bounded timeout, retrying only transient failures.
const SYNC_TIMEOUT_MS = 10_000;
const SYNC_BACKOFF_MS = [300, 900, 2_000];

interface SyncAttempt {
  attempt: number;
  status: number | null;
  ok: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number;
}

interface TenantSyncOutcome {
  ok: boolean;
  attempts: SyncAttempt[];
  workspaceSlug: string | null;
  plan: string | null;
  seats: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function postTenantUpsert(body: Record<string, unknown>): Promise<TenantSyncOutcome> {
  const url = (Deno.env.get("INBOX_PRO_SYNC_URL") ?? "").trim();
  const secret = Deno.env.get("INBOX_PRO_SYNC_SECRET") ?? "";
  const attempts: SyncAttempt[] = [];

  // Missing configuration is a real failure, recorded like any other.
  if (!/^https?:\/\//i.test(url) || !secret) {
    return {
      ok: false,
      attempts,
      workspaceSlug: null,
      plan: null,
      seats: null,
      errorCode: "not_configured",
      errorMessage:
        "Inbox Pro sync is not configured on this server. Add the sync address and the sync secret in server secrets.",
    };
  }

  let successPayload: unknown = null;
  let last: SyncAttempt | null = null;

  for (let index = 0; index < 1 + SYNC_BACKOFF_MS.length; index++) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, SYNC_BACKOFF_MS[index - 1]));
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
    let status: number | null = null;
    let ok = false;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let parsed: unknown = null;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      status = response.status;
      const text = await response.text();
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
      if (response.ok) {
        ok = true;
        successPayload = parsed;
      } else {
        const record = (parsed ?? {}) as Record<string, unknown>;
        errorCode = String(response.status);
        errorMessage =
          readString(record.error) ?? readString(record.message) ?? `Inbox Pro responded ${response.status}.`;
      }
    } catch (e) {
      const err = e as Error;
      errorCode = "network";
      errorMessage = err.name === "AbortError"
        ? "Inbox Pro did not answer within 10 seconds."
        : `Could not reach Inbox Pro: ${err.message}`;
    } finally {
      clearTimeout(timer);
    }

    last = { attempt: index + 1, status, ok, errorCode, errorMessage, durationMs: Date.now() - started };
    attempts.push(last);
    if (ok) break;
    // A 4xx is a decision, not a blip: never retry it.
    if (status !== null && status < 500) break;
  }

  const envelope = (successPayload ?? {}) as Record<string, unknown>;
  const nest = (envelope.workspace ?? envelope.tenant ?? envelope.data ?? envelope) as Record<string, unknown>;
  const workspace = (nest.workspace && typeof nest.workspace === "object" ? nest.workspace : nest) as Record<string, unknown>;

  return {
    ok: last?.ok ?? false,
    attempts,
    workspaceSlug: readString(workspace.slug),
    plan: readString(workspace.plan),
    seats: readNumber(workspace.seats),
    errorCode: last?.errorCode ?? null,
    errorMessage: last?.errorMessage ?? null,
  };
}

// ── Inbox Pro live status ──────────────────────────────────────────────────
// A read, not a sync: one request, no retries (Refresh is the retry). Only the
// whitelisted fields below are ever handed to the browser.
interface InboxStatusOutcome {
  ok: boolean;
  linked: boolean;
  status: "active" | "paused" | "not_connected" | null;
  plan: string | null;
  seats: number | null;
  seatsUsed: number | null;
  openConversations: number | null;
  lastActivityAt: string | null;
  statusCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const STATUS_FIELDS_EMPTY = {
  plan: null,
  seats: null,
  seatsUsed: null,
  openConversations: null,
  lastActivityAt: null,
  statusCode: null,
};

async function fetchInboxStatus(citywideClientId: string): Promise<InboxStatusOutcome> {
  const url = (Deno.env.get("INBOX_PRO_SYNC_URL") ?? "").trim();
  const secret = Deno.env.get("INBOX_PRO_SYNC_SECRET") ?? "";

  if (!/^https?:\/\//i.test(url) || !secret) {
    return {
      ...STATUS_FIELDS_EMPTY,
      ok: false,
      linked: true,
      status: null,
      errorCode: "not_configured",
      errorMessage:
        "Inbox Pro is not configured on this server. Add its sync address and secret in server secrets.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ action: "status", client_id: citywideClientId }),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }

    if (!response.ok) {
      const record = (parsed ?? {}) as Record<string, unknown>;
      return {
        ...STATUS_FIELDS_EMPTY,
        ok: false,
        linked: true,
        status: null,
        statusCode: response.status,
        errorCode: String(response.status),
        errorMessage:
          readString(record.error) ?? readString(record.message) ?? `Inbox Pro responded ${response.status}.`,
      };
    }

    const envelope = (parsed ?? {}) as Record<string, unknown>;
    const nest = (envelope.workspace ?? envelope.tenant ?? envelope.data ?? envelope) as Record<string, unknown>;
    const ws = (nest.workspace && typeof nest.workspace === "object" ? nest.workspace : nest) as Record<string, unknown>;

    const linkedRaw = envelope.linked ?? ws.linked;
    if (linkedRaw === false) {
      return {
        ...STATUS_FIELDS_EMPTY,
        ok: true,
        linked: false,
        status: "not_connected",
        statusCode: response.status,
        errorCode: null,
        errorMessage: null,
      };
    }

    const statusRaw = (readString(ws.status) ?? readString(envelope.status) ?? "").toLowerCase();
    return {
      ok: true,
      linked: true,
      status: statusRaw === "paused" ? "paused" : statusRaw === "active" ? "active" : null,
      plan: readString(ws.plan) ?? readString(envelope.plan),
      seats: readNumber(ws.seats) ?? readNumber(envelope.seats),
      seatsUsed:
        readNumber(ws.seats_used) ?? readNumber(envelope.seats_used) ??
        readNumber(ws.seatsUsed) ?? readNumber(envelope.seatsUsed),
      openConversations:
        readNumber(ws.open_conversations) ?? readNumber(envelope.open_conversations) ??
        readNumber(ws.openConversations) ?? readNumber(envelope.openConversations),
      lastActivityAt:
        readString(ws.last_activity_at) ?? readString(envelope.last_activity_at) ??
        readString(ws.last_activity) ?? readString(envelope.last_activity) ??
        readString(ws.lastActivity) ?? readString(envelope.lastActivity),
      statusCode: response.status,
      errorCode: null,
      errorMessage: null,
    };
  } catch (e) {
    const err = e as Error;
    return {
      ...STATUS_FIELDS_EMPTY,
      ok: false,
      linked: true,
      status: null,
      errorCode: "network",
      errorMessage: err.name === "AbortError"
        ? "Inbox Pro did not answer the status read within 10 seconds."
        : `Could not reach Inbox Pro: ${err.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** The only shape the browser receives for a status read. */
function toStatusPayload(row: BunnyRow, error: string | null) {
  return {
    linked: String(row.status) !== "not_connected",
    status: (row.status as string | null) ?? "not_connected",
    plan: (row.plan as string | null) ?? null,
    seats: (row.seats as number | null) ?? null,
    seats_used: (row.seats_used as number | null) ?? null,
    open_conversations: (row.open_conversations as number | null) ?? null,
    last_activity_at: (row.last_activity_at as string | null) ?? null,
    last_checked_at: (row.last_checked_at as string | null) ?? null,
    status_ok_at: (row.status_ok_at as string | null) ?? null,
    error: error ?? (row.last_error as string | null) ?? null,
  };
}

type SyncIntent = "connect" | "sync" | "pause" | "resume" | "plan";

/**
 * One upsert for a client's Inbox Pro tenant. The permanent id is created once
 * and never changes, so repeating a sync can never produce a second workspace.
 */
async function syncClientApp(
  ctx: AuthCtx,
  clientId: string,
  intent: SyncIntent,
  overrides: { plan?: string | null; seats?: number | null } = {},
): Promise<{ status: "active" | "paused"; workspace_slug: string | null; plan: string | null; seats: number | null }> {
  if (!clientId) throw new Error("Choose a client before syncing Inbox Pro.");
  assertStaff(ctx);
  await assertClientAccess(ctx, clientId);

  const { rows: clientRows } = await exec({
    sql: `SELECT id, name, industry, plan, seats, agency_id FROM clients WHERE id = ? LIMIT 1`,
    args: [clientId],
  });
  const client = clientRows[0];
  if (!client) throw new Error(`client ${clientId} not found`);
  const agencyId = String(client.agency_id ?? "");

  const { rows: appRows } = await exec({
    sql: `SELECT id, citywide_client_id, workspace_slug, plan, seats, status FROM client_apps WHERE client_id = ? AND app_key = ? LIMIT 1`,
    args: [clientId, "inbox_pro"],
  });
  let app = appRows[0];

  if (app && intent === "connect" && app.status !== "not_connected") {
    throw new Error("This client's Inbox Pro is already connected. Use Retry sync instead of connecting again.");
  }
  if (!app && intent !== "connect") {
    throw new Error("This client has no Inbox Pro record yet. Connect Inbox Pro first.");
  }
  // Check the client record before creating anything, so a refused connect
  // leaves no half-made record behind.
  if (intent === "connect" && (!readString(client.plan) || readNumber(client.seats) === null)) {
    throw new Error(
      "Set this client's plan and seats on the client record before connecting Inbox Pro (Edit company details).",
    );
  }

  // Permanent for the life of the client; a retry reuses it.
  const citywideClientId = (app?.citywide_client_id as string | null) ?? uuid();

  if (!app) {
    const rowId = uuid();
    await exec({
      sql: `INSERT INTO client_apps (id, client_id, app_key, status, citywide_client_id) VALUES (?,?,?,?,?)`,
      args: [rowId, clientId, "inbox_pro", "not_connected", citywideClientId],
    });
    app = {
      id: rowId,
      citywide_client_id: citywideClientId,
      workspace_slug: null,
      plan: null,
      seats: null,
      status: "not_connected",
    };
  } else if (!app.citywide_client_id) {
    await exec({ sql: `UPDATE client_apps SET citywide_client_id = ? WHERE id = ?`, args: [citywideClientId, app.id] });
  }

  if (intent === "plan") {
    const plan = (overrides.plan ?? "").trim();
    const seats = overrides.seats;
    if (!plan) throw new Error("Enter the plan to send to Inbox Pro.");
    if (seats === null || seats === undefined || !Number.isFinite(seats) || seats < 0) {
      throw new Error("Seats must be a whole number of 0 or more.");
    }
    await exec({
      sql: `UPDATE clients SET plan = ?, seats = ?, updated_at = ? WHERE id = ?`,
      args: [plan, Math.trunc(seats), now(), clientId],
    });
  }

  const plan = intent === "plan"
    ? (overrides.plan ?? "").trim()
    : (readString(client.plan) ?? null);
  const seats = intent === "plan"
    ? Math.trunc(Number(overrides.seats))
    : readNumber(client.seats);

  // A new workspace needs a plan and a seat count to be useful.
  if ((intent === "connect" || intent === "plan" || intent === "sync") && (!plan || seats === null)) {
    throw new Error(
      "Set this client's plan and seats on the client record before syncing Inbox Pro (Edit company details).",
    );
  }

  // Retrying a paused workspace must not quietly resume it.
  const targetStatus: "active" | "paused" =
    intent === "pause" ? "paused" : (intent === "sync" && app.status === "paused" ? "paused" : "active");

  const outcome = await postTenantUpsert({
    action: "upsert",
    client_id: citywideClientId,
    name: client.name,
    industry: client.industry ?? null,
    plan,
    seats,
    status: targetStatus,
  });

  // Every attempt is logged, without the secret or any request header.
  try {
    const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const rows = outcome.attempts.length
      ? outcome.attempts.map((a) => ({
        agency_id: agencyId,
        client_id: clientId,
        citywide_client_id: citywideClientId,
        intent,
        attempt: a.attempt,
        outcome: a.ok ? "success" : "failure",
        status_code: a.status,
        error_code: a.errorCode,
        error_message: a.errorMessage,
        duration_ms: a.durationMs,
        user_id: ctx.userId,
      }))
      : [{
        agency_id: agencyId,
        client_id: clientId,
        citywide_client_id: citywideClientId,
        intent,
        attempt: 1,
        outcome: "failure",
        status_code: null,
        error_code: outcome.errorCode,
        error_message: outcome.errorMessage,
        duration_ms: null,
        user_id: ctx.userId,
      }];
    const { error } = await service.from("inbox_sync_log").insert(rows);
    if (error) console.error("inbox_sync_log insert failed:", error.message);
  } catch (e) {
    console.error("inbox_sync_log insert failed:", (e as Error).message);
  }

  if (!outcome.ok) {
    const message = outcome.errorMessage ?? "Inbox Pro did not confirm the sync.";
    // Never report Active on failure: the client needs a human to look at it.
    await exec({
      sql: `UPDATE client_apps SET status = 'needs_attention', last_error = ?, last_error_source = 'sync', updated_at = ? WHERE id = ?`,
      args: [message, now(), app.id],
    });
    throw new Error(message);
  }

  const savedSlug = outcome.workspaceSlug ?? (app.workspace_slug as string | null) ?? null;
  const savedPlan = outcome.plan ?? plan;
  const savedSeats = outcome.seats ?? seats;

  await exec({
    sql: `UPDATE client_apps SET status = ?, workspace_slug = ?, plan = ?, seats = ?, last_sync_at = ?, last_error = NULL, last_error_source = NULL, updated_at = ? WHERE id = ?`,
    args: [targetStatus, savedSlug, savedPlan, savedSeats, now(), now(), app.id],
  });

  return { status: targetStatus, workspace_slug: savedSlug, plan: savedPlan, seats: savedSeats };
}

/** SHA-256 hex digest — API keys are stored only as their hash. */async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    `ALTER TABLE clients ADD COLUMN website TEXT`,
    `ALTER TABLE clients ADD COLUMN industry TEXT`,
    `UPDATE clients SET agency_id = 'citywide' WHERE agency_id IS NULL OR agency_id = ''`,
    `CREATE INDEX IF NOT EXISTS clients_agency_idx ON clients(agency_id)`,
    // Read-only public API (seo-api function): the workspace status that can
    // disable that workspace's keys. Keys and request logs live in the managed
    // database (public.api_keys / public.api_requests).
    `ALTER TABLE agencies ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
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
    `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_id TEXT, client_id TEXT NOT NULL, amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'CAD', method TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'succeeded', stripe_payment_intent_id TEXT, paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE payments ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE payments ADD COLUMN notes TEXT`,
    `ALTER TABLE invoices ADD COLUMN payment_method TEXT`,
    `ALTER TABLE invoices ADD COLUMN payment_notes TEXT`,
    `CREATE TABLE IF NOT EXISTS vault_notes (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', title TEXT NOT NULL, body TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'agency_only', pinned INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS vault_credentials (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', label TEXT NOT NULL, category TEXT, username TEXT, password TEXT, url TEXT, mfa_method TEXT, mfa_codes TEXT, notes TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE vault_credentials ADD COLUMN mfa_method TEXT`,
    `ALTER TABLE vault_credentials ADD COLUMN mfa_codes TEXT`,
    `ALTER TABLE vault_credentials ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `CREATE TABLE IF NOT EXISTS vault_files (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', storage_path TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER, kind TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', uploaded_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS health_checks (client_id TEXT NOT NULL, agency_id TEXT NOT NULL DEFAULT 'citywide', key TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', weight INTEGER NOT NULL DEFAULT 1, auto INTEGER NOT NULL DEFAULT 1, client_visible INTEGER NOT NULL DEFAULT 1, evidence TEXT, evidence_url TEXT, metric_value TEXT, updated_by TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (client_id, key))`,
    `CREATE TABLE IF NOT EXISTS health_audits (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, url TEXT NOT NULL, strategy TEXT NOT NULL, performance INTEGER, seo INTEGER, accessibility INTEGER, best_practices INTEGER, lcp_ms INTEGER, cls REAL, inp_ms INTEGER, cwv_pass INTEGER, error TEXT, raw_report_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS health_citations (client_id TEXT NOT NULL, directory TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', listing_url TEXT, evidence TEXT, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (client_id, directory))`,
    // ── App catalog ────────────────────────────────────────────────────────
    // Citywide is the hub: it owns each client's plan, seats and which apps
    // they have. A client's plan/seats are separate from an app's plan/seats.
    `ALTER TABLE clients ADD COLUMN plan TEXT`,
    `ALTER TABLE clients ADD COLUMN seats INTEGER`,
    `CREATE TABLE IF NOT EXISTS apps (app_key TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `INSERT OR IGNORE INTO apps (app_key, name, description, sort_order) VALUES ('inbox_pro', 'Inbox Pro', 'Shared team inbox for client conversations, broadcasts and follow-ups.', 1)`,
    // One row per client per app. `status` is only ever set from a real
    // Inbox Pro response; nothing is inferred. `citywide_client_id` is the id
    // Inbox Pro uses for this client. No delete path exists for these rows:
    // a workspace is paused, never removed.
    `CREATE TABLE IF NOT EXISTS client_apps (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, app_key TEXT NOT NULL DEFAULT 'inbox_pro', status TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected','active','paused','needs_attention')), citywide_client_id TEXT, workspace_slug TEXT, plan TEXT, seats INTEGER, seats_used INTEGER, open_conversations INTEGER, last_activity_at TEXT, last_sync_at TEXT, last_checked_at TEXT, status_ok_at TEXT, last_error_source TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE client_apps ADD COLUMN seats_used INTEGER`,
    `ALTER TABLE client_apps ADD COLUMN open_conversations INTEGER`,
    `ALTER TABLE client_apps ADD COLUMN last_activity_at TEXT`,
    `ALTER TABLE client_apps ADD COLUMN status_ok_at TEXT`,
    `ALTER TABLE client_apps ADD COLUMN last_error_source TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS client_apps_client_app_uq ON client_apps(client_id, app_key)`,
    `CREATE INDEX IF NOT EXISTS client_apps_app_idx ON client_apps(app_key)`,
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
  seedEnsured = true;
}

interface AuthCtx {
  userId: string;
  email: string;
  name: string;
  /** Postgres `user_roles.role` values for this user. */
  roles: string[];
  /** Agency-level super admin: may read and act on any client. */
  isSuperAdmin: boolean;
  /** Citywide or agency staff. Client users are never staff. */
  isStaff: boolean;
  /** Null for a client user — they are never given an agency identity. */
  agencyId: string | null;
  /** The clients a client user may touch (their own portal links). */
  clientIds: string[];
}
async function resolveAuth(token: string): Promise<AuthCtx | { error: string }> {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !userData?.user) return { error: "Invalid token" };
  const userId = userData.user.id;
  // The owning account stays a super admin; ADMIN_EMAIL can extend this.
  const OWNER_EMAIL = "alan@citywidedigital.ca";
  const adminEmails = (Deno.env.get("ADMIN_EMAIL") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const email = (userData.user.email ?? "").toLowerCase();
  const meta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
  const metaName = [meta.full_name, meta.name].find((v) => typeof v === "string" && v.trim());
  const name = typeof metaName === "string" ? metaName.trim() : (email.split("@")[0] || "Citywide user");

  // Roles live in Postgres; the enum's own values decide authority.
  let roles: string[] = [];
  try {
    const { data } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
    roles = (data ?? []).map((row) => String((row as { role?: string }).role ?? ""));
  } catch { /* treat as no roles */ }

  const isSuperAdmin =
    roles.includes("super_admin") || email === OWNER_EMAIL || adminEmails.includes(email);

  let agencyId: string | null = null;
  let hasAgencyMembership = false;
  try {
    const { rows } = await exec({ sql: `SELECT agency_id FROM agency_members WHERE user_id = ? LIMIT 1`, args: [userId] });
    if (rows[0]?.agency_id) { agencyId = rows[0].agency_id as string; hasAgencyMembership = true; }
  } catch { /* no membership */ }

  const isStaff =
    isSuperAdmin ||
    hasAgencyMembership ||
    roles.includes("admin") ||
    roles.includes("agency") ||
    roles.includes("agency_staff");

  // No implicit agency identity for client users. A super admin, however, has
  // no agency_members row by design, and client-scoped writes (vault, invoices)
  // require a concrete agency_id — give them the default workspace.
  // Agency staff without a membership still get no scope at all.
  if (isSuperAdmin && !agencyId) agencyId = "citywide";

  let clientIds: string[] = [];
  if (!isStaff) {
    // Explicit binding first: a client role is bound to exactly one client.
    try {
      const { data: membership } = await adminClient
        .from("client_memberships")
        .select("client_id")
        .eq("user_id", userId)
        .maybeSingle();
      const bound = String((membership as { client_id?: string } | null)?.client_id ?? "");
      if (bound) clientIds = [bound];
    } catch { /* fall back to portal linkage */ }

    if (clientIds.length === 0) {
      try {
        const { data: links } = await adminClient
          .from("portal_users")
          .select("connection_id")
          .eq("user_id", userId);
        const connectionIds = (links ?? [])
          .map((link) => String((link as { connection_id?: string }).connection_id ?? ""))
          .filter(Boolean);
        if (connectionIds.length) {
          const placeholders = connectionIds.map(() => "?").join(",");
          const { rows } = await exec({
            // A client user is bound to exactly one client, even if their
            // history has more than one portal link.
            sql: `SELECT id FROM clients WHERE gbp_connection_id IN (${placeholders}) ORDER BY id ASC LIMIT 1`,
            args: connectionIds,
          });
          clientIds = rows.slice(0, 1).map((row) => String(row.id));
        }
      } catch { clientIds = []; }
    }
  }

  return { userId, email, name, roles, isSuperAdmin, isStaff, agencyId, clientIds };
}

/** Agency staff only. Client users may never mutate the client book. */
function assertStaff(ctx: AuthCtx): void {
  if (!ctx.isStaff) throw new Error("Forbidden: agency staff only");
}

function tenantScope(ctx: AuthCtx): { sql: string; args: SqlValue[] } {
  if (ctx.isSuperAdmin) return { sql: "1=1", args: [] };
  if (ctx.agencyId) return { sql: "agency_id = ?", args: [ctx.agencyId] };
  // A client user has no agency scope: bulk listing returns nothing.
  return { sql: "1=0", args: [] };
}

async function assertClientAccess(ctx: AuthCtx, clientId: string): Promise<void> {
  const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
  if (!rows[0]) throw new Error(`client ${clientId} not found`);
  if (ctx.isSuperAdmin) return;
  if (ctx.isStaff && ctx.agencyId && rows[0].agency_id === ctx.agencyId) return;
  if (ctx.clientIds.includes(clientId)) return;
  throw new Error("Forbidden: this client is not in your account");
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
    console.warn(`Stripe customer ${client.stripe_customer_id} not found, creating fresh`);
    return createFresh();
  }
}

let cachedGstTaxRateId: string | null = null;
async function ensureGstTaxRate(): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");
  if (cachedGstTaxRateId) return cachedGstTaxRateId;
  const { data: rates } = await stripe.taxRates.list({ active: true, limit: 20 });
  const existing = rates.find((r) => Math.abs(r.percentage - 5) < 0.01 && !r.inclusive && (r.country === "CA" || (r.display_name ?? "").toUpperCase().includes("GST")));
  if (existing) { cachedGstTaxRateId = existing.id; return existing.id; }
  const created = await stripe.taxRates.create({
    display_name: "GST", description: "Canadian Goods and Services Tax",
    jurisdiction: "CA", percentage: 5, inclusive: false, country: "CA", tax_type: "gst",
  });
  cachedGstTaxRateId = created.id;
  return created.id;
}

async function sendSubscriptionInvoice(
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
  clientId: string,
  agencyId: string,
): Promise<void> {
  if (!stripeSub.latest_invoice) return;
  const invoiceId = typeof stripeSub.latest_invoice === "string" ? stripeSub.latest_invoice : (stripeSub.latest_invoice as { id: string }).id;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  if (invoice.status === "paid" || invoice.status === "void") return;

  let hostedUrl: string | null = null;
  let pdfUrl: string | null = null;

  if (invoice.status === "draft") {
    const yr = new Date().getFullYear();
    const { rows: seqRows } = await exec({ sql: `SELECT COALESCE(MAX(CAST(SUBSTR(number, 5 + INSTR(SUBSTR(number, 5), '-')) AS INTEGER)), 999) AS max_seq FROM invoices WHERE number LIKE 'INV-%'` });
    const seq = Math.max(999, Number(seqRows[0]?.max_seq ?? 999)) + 1;
    const invoiceNum = `INV-${yr}-${seq}`;
    await stripe.invoices.update(invoice.id, { custom_fields: [{ name: "Invoice No.", value: invoiceNum }] });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    hostedUrl = finalized.hosted_invoice_url ?? null;
    pdfUrl = finalized.invoice_pdf ?? null;
    try {
      const crmInvoiceId = uuid();
      const dueAt = finalized.due_date ? new Date(finalized.due_date * 1000).toISOString() : null;
      await exec({ sql: `INSERT OR IGNORE INTO invoices (id, client_id, agency_id, number, subtotal_cents, tax_cents, total_cents, amount_cents, amount_paid_cents, currency, status, issued_at, due_at, sent_at, stripe_invoice_id, hosted_invoice_url, pdf_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [crmInvoiceId, clientId, agencyId, invoiceNum, invoice.subtotal ?? 0, invoice.tax ?? 0, invoice.total ?? 0, invoice.total ?? 0, 0, "CAD", "open", now(), dueAt, now(), invoice.id, hostedUrl, pdfUrl] });
    } catch (e) { console.warn("Failed to save CRM invoice record:", e); }
  }
  await stripe.invoices.sendInvoice(invoice.id);
}

const adminStorage = createClient(SUPABASE_URL, SERVICE_KEY).storage;

// Content Studio: queue a recorder push when a CRM client changes. Best effort —
// a recorder problem must never fail the CRM write. The queue processor (and the
// nightly reconciliation) owns retries.
const recorderDb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
async function enqueueRecorder(crmClientId: string | null | undefined, reason: string): Promise<void> {
  if (!crmClientId) return;
  try {
    const { error } = await recorderDb.rpc("recorder_enqueue_client", {
      p_crm_client_id: crmClientId,
      p_reason: reason,
    });
    if (error) console.warn("recorder enqueue failed:", error.message);
  } catch (e) {
    console.warn("recorder enqueue failed:", (e as Error).message);
  }
}

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

/**
 * What a client user (a portal account with no staff role) may call at all.
 * Everything else is staff-only: it is refused before any handler runs, so a
 * client session can never reach the client book, billing or another client.
 */
const CLIENT_USER_ACTIONS = new Set([
  "ping",
  "clients.get",
  "clientApps.list",
  "clientApps.status",
]);

async function handle(action: string, payload: Record<string, unknown>, ctx: AuthCtx): Promise<unknown> {
  if (!ctx.isStaff && !CLIENT_USER_ACTIONS.has(action)) {
    throw new Error("Forbidden: this action requires an agency seat");
  }
  // A staff role with no agency membership has no workspace to act in.
  if (ctx.isStaff && !ctx.isSuperAdmin && !ctx.agencyId && action !== "ping") {
    throw new Error("Forbidden: this account has no agency workspace assigned");
  }
  const ts = tenantScope(ctx);
  switch (action) {
    case "ping": return { ok: true, agency_id: ctx.agencyId, super_admin: ctx.isSuperAdmin, is_staff: ctx.isStaff, roles: ctx.roles, client_ids: ctx.clientIds };

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
              stripeProductId = null; stripePriceId = null;
              const sp = await stripe.products.create({ name: productName, description: (payload.description as string) || undefined, metadata: { crm_product_id: id } });
              stripeProductId = sp.id;
            }
          }
          const priceChanged = !ex || ex.unit_amount_cents !== cents || ex.interval !== interval || !stripePriceId;
          if (priceChanged && stripeProductId) {
            if (stripePriceId) { try { await stripe.prices.update(stripePriceId, { active: false }); } catch { /* ignore */ } }
            const priceParams: Stripe.PriceCreateParams = { product: stripeProductId, unit_amount: cents, currency };
            if (productType === "subscription" && interval) priceParams.recurring = { interval: interval as "month" | "year" };
            const sp = await stripe.prices.create(priceParams);
            stripePriceId = sp.id;
          }
        } catch (stripeErr) { console.error("Stripe product sync failed:", stripeErr); }
      }
      await exec({ sql: `INSERT INTO products (id, name, description, type, price_cents, unit_amount_cents, currency, interval, stripe_product_id, stripe_price_id, active) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, type=excluded.type, price_cents=excluded.price_cents, unit_amount_cents=excluded.unit_amount_cents, currency=excluded.currency, interval=excluded.interval, stripe_product_id=excluded.stripe_product_id, stripe_price_id=excluded.stripe_price_id, active=excluded.active`, args: [id, productName, (payload.description as string) ?? null, productType, cents, cents, (payload.currency as string) ?? "CAD", interval, stripeProductId, stripePriceId, active] });
      return { id, stripe_product_id: stripeProductId, stripe_price_id: stripePriceId };
    }

    case "clients.list": {
      const status = payload.status as string | undefined;
      const search = (payload.q ?? payload.search) as string | undefined;
      // Super-admin can pass agency_id to scope the query; 'all' means no scope
      const payloadAgency = payload.agency_id as string | undefined;
      let effectiveTsSql = ts.sql;
      let effectiveTsArgs: SqlValue[] = [...ts.args];
      if (ctx.isSuperAdmin && payloadAgency && payloadAgency !== "all") {
        effectiveTsSql = "agency_id = ?";
        effectiveTsArgs = [payloadAgency];
      }
      const where: string[] = [effectiveTsSql]; const args: SqlValue[] = [...effectiveTsArgs];
      if (status && status !== "all") { where.push("status = ?"); args.push(status); }
      else if (!status) { where.push("status != 'archived'"); }
      if (search) { where.push("(name LIKE ? OR billing_email LIKE ? OR city LIKE ?)"); const s = `%${search}%`; args.push(s, s, s); }
      const limit = Math.min(Number(payload.limit ?? 100), 500);
      const offset = Number(payload.offset ?? 0);
      const whereClause = where.join(" AND ");
      const [{ rows }, { rows: countRows }] = await execMany([
        { sql: `SELECT id, name, status, plan, seats, billing_email, phone, city, region, gbp_connection_id, agency_id, created_at, updated_at FROM clients WHERE ${whereClause} ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'prospect' THEN 2 WHEN 'lead' THEN 3 WHEN 'paused' THEN 4 WHEN 'churned' THEN 5 ELSE 6 END, name ASC LIMIT ? OFFSET ?`, args: [...args, limit, offset] },
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
      // Super-admin can stamp a specific agency; otherwise use authenticated agency
      const agencyId = (ctx.isSuperAdmin && payload.agency_id) ? (payload.agency_id as string) : ctx.agencyId;
      await exec({ sql: `INSERT INTO clients (id, name, status, source, owner_id, billing_email, phone, address_line1, city, region, postal_code, country, gbp_connection_id, website, industry, notes, agency_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, payload.name as string, (payload.status as string) ?? "lead", (payload.source as string) ?? null, (payload.owner_id as string) ?? null, (payload.billing_email as string) ?? null, (payload.phone as string) ?? null, (payload.address_line1 as string) ?? null, (payload.city as string) ?? null, (payload.region as string) ?? null, (payload.postal_code as string) ?? null, (payload.country as string) ?? null, (payload.gbp_connection_id as string) ?? null, (payload.website as string) ?? null, (payload.industry as string) ?? null, (payload.notes as string) ?? null, agencyId] });
      if (((payload.status as string) ?? "lead") === "active") await enqueueRecorder(id, "crm-create");
      return { id };
    }
    case "clients.update": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      if (("plan" in payload || "seats" in payload) && !ctx.isSuperAdmin) {
        throw new Error("Only a super admin can change a client's plan or seat count.");
      }
      const fields: string[] = []; const args: SqlValue[] = [];
      const updatable = ["name","status","source","owner_id","billing_email","phone","address_line1","city","region","postal_code","country","gbp_connection_id","stripe_customer_id","website","industry","notes","plan","seats"];
      // Super-admin can re-assign a client to a different agency
      if (ctx.isSuperAdmin) updatable.push("agency_id");
      for (const k of updatable) if (k in payload) { fields.push(`${k} = ?`); args.push((payload[k] as SqlValue) ?? null); }
      fields.push("updated_at = ?"); args.push(now()); args.push(id);
      await exec({ sql: `UPDATE clients SET ${fields.join(", ")} WHERE id = ?`, args });
      await enqueueRecorder(id, "crm-update");
      if (stripe && "billing_email" in payload && payload.billing_email) {
        try {
          const { rows: cr } = await exec({ sql: `SELECT stripe_customer_id FROM clients WHERE id = ? LIMIT 1`, args: [id] });
          if (cr[0]?.stripe_customer_id) await stripe.customers.update(cr[0].stripe_customer_id as string, { email: payload.billing_email as string });
        } catch (e) { console.warn("Stripe customer email sync failed:", e); }
      }
      return { ok: true };
    }
    case "clients.archive": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      await exec({ sql: `UPDATE clients SET status = 'archived', updated_at = ? WHERE id = ?`, args: [now(), id] });
      await enqueueRecorder(id, "crm-archive");
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
          await exec({ sql: `INSERT INTO clients (id, name, status, source, billing_email, phone, address_line1, city, region, postal_code, country, website, industry, notes, agency_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, (r.name as string) ?? "Untitled", (r.status as string) ?? "lead", (r.source as string) ?? "import", (r.billing_email as string) ?? null, (r.phone as string) ?? null, (r.address_line1 as string) ?? null, (r.city as string) ?? null, (r.region as string) ?? null, (r.postal_code as string) ?? null, (r.country as string) ?? null, (r.website as string) ?? null, (r.industry as string) ?? null, (r.notes as string) ?? null, ctx.agencyId] });
          created++;
          if (((r.status as string) ?? "lead") === "active") await enqueueRecorder(id, "crm-import");
        } catch { skipped++; }
      }
      return { created, skipped };
    }

    // ── App catalog ────────────────────────────────────────────────────────
    // Read-only in this step. Provisioning, status reads, sync and pause are
    // added separately; nothing here contacts Inbox Pro.
    case "apps.list": {
      const { rows } = await exec({ sql: `SELECT app_key, name, description, sort_order FROM apps ORDER BY sort_order ASC, name ASC` });
      return { apps: rows };
    }
    case "clientApps.list": {
      const appKey = (payload.app_key as string) || "inbox_pro";
      const clientId = payload.client_id as string | undefined;
      const where: string[] = ["ca.app_key = ?"];
      const args: SqlValue[] = [appKey];
      if (!ctx.isSuperAdmin) {
        if (ctx.agencyId) { where.push("c.agency_id = ?"); args.push(ctx.agencyId); }
        else if (ctx.clientIds.length) {
          where.push(`ca.client_id IN (${ctx.clientIds.map(() => "?").join(",")})`);
          args.push(...ctx.clientIds);
        } else where.push("1=0");
      }
      if (clientId) {
        await assertClientAccess(ctx, clientId);
        where.push("ca.client_id = ?");
        args.push(clientId);
      }
      const { rows } = await exec({
        sql: `SELECT ca.id, ca.client_id, ca.app_key, ca.status, ca.citywide_client_id, ca.workspace_slug, ca.plan, ca.seats, ca.seats_used, ca.open_conversations, ca.last_activity_at, ca.last_sync_at, ca.last_checked_at, ca.status_ok_at, ca.last_error, ca.created_at, ca.updated_at, c.name AS client_name, c.status AS client_status, c.plan AS client_plan, c.seats AS client_seats, c.billing_email AS client_email, c.agency_id FROM client_apps ca JOIN clients c ON c.id = ca.client_id WHERE ${where.join(" AND ")} ORDER BY c.name ASC LIMIT 500`,
        args,
      });
      return { client_apps: rows };
    }

    // One-click launch: signs the signed-in user into that client's Inbox Pro
    // workspace. The token is single-use, expires in minutes, and is never
    // logged, stored or audited — only its id and the outcome are recorded.
    case "clientApps.launch": {
      const clientId = payload.client_id as string;
      if (!clientId) throw new Error("Choose a client before launching Inbox Pro.");
      assertStaff(ctx);

      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      const { rows: clientRows } = await exec({
        sql: `SELECT id, name, agency_id, gbp_connection_id FROM clients WHERE id = ? LIMIT 1`,
        args: [clientId],
      });
      const client = clientRows[0];
      if (!client) throw new Error(`client ${clientId} not found`);
      if (!ctx.isSuperAdmin && client.agency_id !== ctx.agencyId) {
        throw new Error("Forbidden: client belongs to another agency");
      }

      const { rows: appRows } = await exec({
        sql: `SELECT status, workspace_slug FROM client_apps WHERE client_id = ? AND app_key = ? LIMIT 1`,
        args: [clientId, "inbox_pro"],
      });
      const app = appRows[0];
      const agencyId = String(client.agency_id ?? "");
      const slug = (app?.workspace_slug as string | null) ?? null;
      const role = await resolveLaunchRole(ctx, (client.gbp_connection_id as string | null) ?? null);

      const record = async (
        result: "issued" | "rejected",
        errorCode: string | null,
        errorMessage: string | null,
        jti: string | null,
      ) => {
        const { error } = await adminClient.from("inbox_launch_audit").insert({
          agency_id: agencyId,
          client_id: clientId,
          app_key: "inbox_pro",
          workspace_slug: slug,
          user_id: ctx.userId,
          user_email: ctx.email,
          role,
          result,
          error_code: errorCode,
          error_message: errorMessage,
          jti,
        });
        // Every launch must be accountable, including refusals.
        if (error) throw new Error(`Launch audit could not be written: ${error.message}`);
      };
      const refuse = async (message: string, code: string): Promise<never> => {
        await record("rejected", code, message, null);
        throw new Error(message);
      };

      if (!app) {
        await refuse(
          "This client has no Inbox Pro workspace yet, so there is nothing to launch. Connect Inbox Pro first.",
          "404",
        );
      }
      if (app.status === "paused") {
        await refuse(
          "This Inbox Pro workspace is paused, so launch is disabled. Resume the workspace first — Citywide pauses workspaces and never deletes them.",
          "403",
        );
      }
      if (!slug) {
        await refuse(
          "This client has no Inbox Pro workspace address yet, so launch is disabled.",
          "404",
        );
      }

      const launchSecret = Deno.env.get("INBOX_PRO_LAUNCH_SECRET");
      const origin = (Deno.env.get("INBOX_PRO_ORIGIN") ?? "").trim().replace(/\/+$/, "");
      if (!launchSecret || !/^https?:\/\//i.test(origin)) {
        await refuse(
          "Inbox Pro is not configured on this server. Add the launch secret and its origin, then try again.",
          "503",
        );
      }

      // At most five minutes ahead, and a fresh id for every launch.
      const exp = Math.floor(Date.now() / 1000) + 240;
      const jti = uuid();
      const encodedPayload = base64UrlEncodeText(JSON.stringify({
        email: ctx.email,
        name: ctx.name,
        workspace_slug: slug,
        role,
        exp,
        jti,
      }));
      const signature = await hmacSha256Base64Url(String(launchSecret), encodedPayload);
      const token = `${encodedPayload}.${signature}`;

      await record("issued", null, null, jti);

      return {
        url: `${origin}/sso?token=${encodeURIComponent(token)}`,
        expires_at: exp,
        role,
        workspace_slug: slug,
      };
    }

    case "clientApps.status": {
      const clientId = payload.client_id as string;
      const forceRefresh = payload.refresh === true;
      if (!clientId) throw new Error("Choose a client to read its Inbox Pro status.");
      await assertClientAccess(ctx, clientId);

      const { rows } = await exec({
        sql: `SELECT ca.*, c.agency_id FROM client_apps ca JOIN clients c ON c.id = ca.client_id WHERE ca.client_id = ? AND ca.app_key = ? LIMIT 1`,
        args: [clientId, "inbox_pro"],
      });
      const app = rows[0];

      if (!app || !app.citywide_client_id) {
        return {
          linked: false,
          status: "not_connected",
          plan: null,
          seats: null,
          seats_used: null,
          open_conversations: null,
          last_activity_at: null,
          last_checked_at: (app?.last_checked_at as string | null) ?? null,
          status_ok_at: (app?.status_ok_at as string | null) ?? null,
          error: null,
        };
      }

      const citywideClientId = String(app.citywide_client_id);
      const agencyId = String(app.agency_id ?? "");

      // Cached for a minute; an explicit Refresh always reads Inbox Pro.
      const lastAttempt = app.last_checked_at ? Date.parse(String(app.last_checked_at)) : Number.NaN;
      if (!forceRefresh && Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 60_000) {
        return toStatusPayload(app, null);
      }

      const outcome = await fetchInboxStatus(citywideClientId);

      try {
        const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
        const { error } = await service.from("inbox_sync_log").insert({
          agency_id: agencyId,
          client_id: clientId,
          citywide_client_id: citywideClientId,
          intent: "status",
          attempt: 1,
          outcome: outcome.ok ? "success" : "failure",
          status_code: outcome.statusCode,
          error_code: outcome.errorCode,
          error_message: outcome.errorMessage,
          duration_ms: null,
          user_id: ctx.userId,
        });
        if (error) console.error("inbox_sync_log insert failed:", error.message);
      } catch (e) {
        console.error("inbox_sync_log insert failed:", (e as Error).message);
      }

      // A pending sync failure outranks a status read: the workspace may be up,
      // but its plan/seats are not known to be in step with Inbox Pro.
      const syncErrorPending = String(app.last_error_source ?? "") === "sync";

      if (!outcome.ok) {
        const message = outcome.errorMessage ?? "Inbox Pro did not answer the status read.";
        // The last known numbers are deliberately left untouched, and a sync
        // failure's reason is not replaced by a read failure.
        await exec({
          sql: syncErrorPending
            ? `UPDATE client_apps SET status = 'needs_attention', last_checked_at = ?, updated_at = ? WHERE id = ?`
            : `UPDATE client_apps SET status = 'needs_attention', last_checked_at = ?, last_error = ?, last_error_source = 'status', updated_at = ? WHERE id = ?`,
          args: syncErrorPending ? [now(), now(), app.id] : [now(), message, now(), app.id],
        });
        const shownError = syncErrorPending
          ? ((app.last_error as string | null) ?? message)
          : message;
        return {
          ...toStatusPayload(app, shownError),
          status: "needs_attention",
          last_checked_at: now(),
          error: shownError,
        };
      }

      if (!outcome.linked) {
        // Inbox Pro says there is no workspace for this id, so old numbers no
        // longer describe anything.
        await exec({
          sql: `UPDATE client_apps SET status = 'not_connected', seats_used = NULL, open_conversations = NULL, last_activity_at = NULL, last_checked_at = ?, status_ok_at = ?, last_error = NULL, last_error_source = NULL, updated_at = ? WHERE id = ?`,
          args: [now(), now(), now(), app.id],
        });
        return {
          linked: false,
          status: "not_connected",
          plan: (app.plan as string | null) ?? null,
          seats: (app.seats as number | null) ?? null,
          seats_used: null,
          open_conversations: null,
          last_activity_at: null,
          last_checked_at: now(),
          status_ok_at: now(),
          error: null,
        };
      }

      // Explicit "paused" always wins; a read can never turn a paused workspace active.
      const stored = String(app.status ?? "");
      const nextStatus = outcome.status ?? (stored === "paused" ? "paused" : "active");

      const plan = outcome.plan ?? (app.plan as string | null) ?? null;
      const seats = outcome.seats ?? (app.seats as number | null) ?? null;
      const seatsUsed = outcome.seatsUsed ?? (app.seats_used as number | null) ?? null;
      const openConversations = outcome.openConversations ?? (app.open_conversations as number | null) ?? null;
      const lastActivity = outcome.lastActivityAt ?? (app.last_activity_at as string | null) ?? null;

      if (syncErrorPending) {
        // Fresh numbers, but the record still needs a person: the last sync failed.
        await exec({
          sql: `UPDATE client_apps SET plan = ?, seats = ?, seats_used = ?, open_conversations = ?, last_activity_at = ?, last_checked_at = ?, status_ok_at = ?, updated_at = ? WHERE id = ?`,
          args: [plan, seats, seatsUsed, openConversations, lastActivity, now(), now(), now(), app.id],
        });
        return {
          linked: true,
          status: "needs_attention",
          plan,
          seats,
          seats_used: seatsUsed,
          open_conversations: openConversations,
          last_activity_at: lastActivity,
          last_checked_at: now(),
          status_ok_at: now(),
          error: (app.last_error as string | null) ?? null,
        };
      }

      await exec({
        sql: `UPDATE client_apps SET status = ?, plan = ?, seats = ?, seats_used = ?, open_conversations = ?, last_activity_at = ?, last_checked_at = ?, status_ok_at = ?, last_error = NULL, last_error_source = NULL, updated_at = ? WHERE id = ?`,
        args: [nextStatus, plan, seats, seatsUsed, openConversations, lastActivity, now(), now(), now(), app.id],
      });

      return {
        linked: true,
        status: nextStatus,
        plan,
        seats,
        seats_used: seatsUsed,
        open_conversations: openConversations,
        last_activity_at: lastActivity,
        last_checked_at: now(),
        status_ok_at: now(),
        error: null,
      };
    }

    case "clientApps.connect": {
      const result = await syncClientApp(ctx, payload.client_id as string, "connect");
      return { ok: true, ...result };
    }
    case "clientApps.sync": {
      const result = await syncClientApp(ctx, payload.client_id as string, "sync");
      return { ok: true, ...result };
    }
    case "clientApps.pause": {
      const result = await syncClientApp(ctx, payload.client_id as string, "pause");
      return { ok: true, ...result };
    }
    case "clientApps.resume": {
      const result = await syncClientApp(ctx, payload.client_id as string, "resume");
      return { ok: true, ...result };
    }
    case "clientApps.plan": {
      // Agency staff may run the workspace but only a super admin may resize it.
      if (!ctx.isSuperAdmin) {
        throw new Error("Only a super admin can change a client's plan or seat count.");
      }
      const rawSeats = payload.seats;
      const seats = rawSeats === null || rawSeats === undefined || rawSeats === ""
        ? null
        : Number(rawSeats);
      const result = await syncClientApp(ctx, payload.client_id as string, "plan", {
        plan: (payload.plan as string) ?? null,
        seats: seats !== null && Number.isFinite(seats) ? seats : null,
      });
      return { ok: true, ...result };
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
            const gstRateId = await ensureGstTaxRate().catch((e) => { console.warn("GST tax rate fetch failed:", e); return null; });
            const stripeSub = await stripe.subscriptions.create({
              customer: customerId,
              items: [{ price: stripePriceId, quantity: (payload.quantity as number) ?? 1 }],
              collection_method: method,
              ...(method === "send_invoice" ? { days_until_due: 30 } : {}),
              payment_settings: { save_default_payment_method: "on_subscription" },
              ...(gstRateId ? { default_tax_rates: [gstRateId] } : {}),
              metadata: { crm_subscription_id: id },
            });
            await exec({ sql: `UPDATE subscriptions SET stripe_subscription_id = ? WHERE id = ?`, args: [stripeSub.id, id] });
            if (method === "send_invoice") {
              try { await sendSubscriptionInvoice(stripe, stripeSub, payload.client_id as string, ctx.agencyId); } catch (e) { console.warn("Failed to send first invoice:", e); }
            }
          }
        } catch (stripeErr) {
          console.error("Stripe subscription create failed:", stripeErr);
          const msg = (stripeErr as Error).message ?? "Stripe sync failed";
          stripeWarning = msg.includes("No such price") || msg.includes("resource_missing")
            ? "The product's Stripe price is stale. Go to Catalog → open the product → Save & Sync to Stripe, then re-create this subscription."
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
          if (payload.at_period_end) { await stripe.subscriptions.update(stripeSub, { cancel_at_period_end: true }); }
          else { await stripe.subscriptions.cancel(stripeSub); }
        } catch (e) { console.warn("Stripe subscription cancel failed:", e); }
      }
      await exec({ sql: `UPDATE subscriptions SET status = ?, cancel_at_period_end = ?, updated_at = ? WHERE id = ?`, args: [payload.at_period_end ? "active" : "canceled", payload.at_period_end ? 1 : 0, now(), payload.id as string] });
      return { ok: true };
    }
    case "subscriptions.pause": {
      // Pauses billing without canceling: Stripe stops generating invoices for
      // this subscription entirely (behavior: "void") until resumed. The
      // subscription itself stays alive in Stripe; only invoicing is paused.
      const { rows: subRows } = await exec({ sql: `SELECT stripe_subscription_id, status FROM subscriptions WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const sub = subRows[0];
      if (!sub) throw new Error("Subscription not found");
      if (sub.status === "canceled") throw new Error("Cannot pause a canceled subscription.");
      if (!sub.stripe_subscription_id) throw new Error("Subscription not yet synced to Stripe — sync it first before pausing billing.");
      if (!stripe) throw new Error("Stripe is not configured");
      await stripe.subscriptions.update(sub.stripe_subscription_id as string, { pause_collection: { behavior: "void" } });
      await exec({ sql: `UPDATE subscriptions SET status = 'paused', updated_at = ? WHERE id = ?`, args: [now(), payload.id as string] });
      return { ok: true };
    }
    case "subscriptions.resume": {
      const { rows: subRows } = await exec({ sql: `SELECT stripe_subscription_id FROM subscriptions WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const sub = subRows[0];
      if (!sub) throw new Error("Subscription not found");
      if (!stripe) throw new Error("Stripe is not configured");
      if (sub.stripe_subscription_id) {
        await stripe.subscriptions.update(sub.stripe_subscription_id as string, { pause_collection: null });
      }
      await exec({ sql: `UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?`, args: [now(), payload.id as string] });
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
      const gstRateId = await ensureGstTaxRate().catch((e) => { console.warn("GST tax rate fetch failed:", e); return null; });
      const stripeSub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePriceId, quantity: (sub.quantity as number) ?? 1 }],
        collection_method: method,
        ...(method === "send_invoice" ? { days_until_due: 30 } : {}),
        payment_settings: { save_default_payment_method: "on_subscription" },
        ...(gstRateId ? { default_tax_rates: [gstRateId] } : {}),
        metadata: { crm_subscription_id: sub.id as string },
      });
      await exec({ sql: `UPDATE subscriptions SET stripe_subscription_id = ? WHERE id = ?`, args: [stripeSub.id, sub.id as string] });
      if (method === "send_invoice") {
        try { await sendSubscriptionInvoice(stripe, stripeSub, sub.client_id as string, ctx.agencyId); } catch (e) { console.warn("Failed to send first invoice (syncStripe):", e); }
      }
      return { ok: true, stripe_subscription_id: stripeSub.id };
    }
    case "subscriptions.resendInvoice": {
      const { rows } = await exec({ sql: `SELECT stripe_subscription_id, client_id FROM subscriptions WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const sub = rows[0];
      if (!sub) throw new Error("Subscription not found");
      if (!stripe) throw new Error("Stripe not configured");
      if (!sub.stripe_subscription_id) throw new Error("Subscription not yet synced to Stripe.");
      const { rows: clientRows } = await exec({ sql: `SELECT stripe_customer_id, billing_email FROM clients WHERE id = ? LIMIT 1`, args: [sub.client_id as string] });
      const cl = clientRows[0];
      if (cl?.stripe_customer_id && cl?.billing_email) {
        try { await stripe.customers.update(cl.stripe_customer_id as string, { email: cl.billing_email as string }); } catch (e) { console.warn("Stripe customer email update failed:", e); }
      }
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
      const latestInvoiceId = stripeSub.latest_invoice as string | null;
      if (!latestInvoiceId) throw new Error("No invoice found for this subscription in Stripe");
      const invoice = await stripe.invoices.retrieve(latestInvoiceId);
      if (invoice.status === "paid" || invoice.status === "void") throw new Error(`Invoice is already ${invoice.status} — nothing to send.`);
      if (invoice.status === "draft") await stripe.invoices.finalizeInvoice(invoice.id);
      await stripe.invoices.sendInvoice(invoice.id);
      return { ok: true, invoice_id: invoice.id, sent_to: cl?.billing_email };
    }
    case "subscriptions.delete": {
      const { rows: subRows } = await exec({ sql: `SELECT stripe_subscription_id FROM subscriptions WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const stripeSub = subRows[0]?.stripe_subscription_id as string | null;
      if (stripe && stripeSub) { try { await stripe.subscriptions.cancel(stripeSub); } catch (e) { console.warn("Stripe subscription cancel failed:", e); } }
      await exec({ sql: `DELETE FROM subscriptions WHERE id = ?`, args: [payload.id as string] });
      return { ok: true };
    }

    case "invoices.create": {
      await assertClientAccess(ctx, payload.client_id as string);
      type LineItem = { description: string; quantity: number; unit_amount_cents: number; product_id?: string };
      const items = (payload.items as LineItem[]) ?? [];
      const subtotal = items.reduce((s, i) => s + (i.unit_amount_cents * (i.quantity || 1)), 0);
      const dueDays = (payload.due_days as number) ?? 14;
      const issuedAt = now();
      const dueAt = new Date(Date.now() + dueDays * 86400000).toISOString();
      const yr = new Date().getFullYear();
      const { rows: seqRows } = await exec({ sql: `SELECT COALESCE(MAX(CAST(SUBSTR(number, 5 + INSTR(SUBSTR(number, 5), '-')) AS INTEGER)), 999) AS max_seq FROM invoices WHERE number LIKE 'INV-%'` });
      const seq = Math.max(999, Number(seqRows[0]?.max_seq ?? 999)) + 1;
      const invoiceNum = `INV-${yr}-${seq}`;
      const id = uuid();
      await exec({ sql: `INSERT INTO invoices (id, client_id, agency_id, number, subtotal_cents, tax_cents, total_cents, amount_cents, amount_paid_cents, line_items, currency, status, issued_at, due_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, payload.client_id as string, ctx.agencyId, invoiceNum, subtotal, 0, subtotal, subtotal, 0, JSON.stringify(items), "CAD", "draft", issuedAt, dueAt] });
      return { id, number: invoiceNum };
    }
    case "invoices.send": {
      const { rows } = await exec({ sql: `SELECT * FROM invoices WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const inv = rows[0];
      if (!inv) throw new Error("Invoice not found");
      let hostedUrl = inv.hosted_invoice_url as string | null;
      let pdfUrl = inv.pdf_url as string | null;
      let stripeInvoiceId = inv.stripe_invoice_id as string | null;
      let stripeStatus = "open";
      let stripeTotal = inv.total_cents as number;
      if (stripe) {
        const customerId = await ensureStripeCustomer(inv.client_id as string);
        type LineItem = { description: string; quantity: number; unit_amount_cents: number };
        const lineItems: LineItem[] = JSON.parse((inv.line_items as string) || "[]");
        const dueDays = Math.max(1, Math.round((new Date(inv.due_at as string).getTime() - Date.now()) / 86400000)) || 14;
        for (const item of lineItems) {
          await stripe.invoiceItems.create({ customer: customerId, amount: Math.round((item.unit_amount_cents ?? 0) * (item.quantity ?? 1)), currency: ((inv.currency as string) || "CAD").toLowerCase(), description: item.description || "Service" });
        }
        const stripeInv = await stripe.invoices.create({ customer: customerId, collection_method: "send_invoice", days_until_due: dueDays, pending_invoice_items_behavior: "include", custom_fields: [{ name: "Invoice No.", value: inv.number as string }], metadata: { crm_invoice_id: inv.id as string } });
        stripeInvoiceId = stripeInv.id;
        const finalized = await stripe.invoices.finalizeInvoice(stripeInv.id);
        // Safety check: a $0 finalized invoice means the line items never attached to it (Stripe
        // auto-marks $0 invoices "paid" and there is nothing to collect) — do not email the client.
        if ((finalized.total ?? 0) <= 0 && (inv.total_cents as number) > 0) {
          try { await stripe.invoices.voidInvoice(stripeInv.id); } catch { /* best effort */ }
          throw new Error("Stripe created this invoice with a $0 total (line items failed to attach). The invoice was voided and NOT sent — please try again.");
        }
        hostedUrl = finalized.hosted_invoice_url ?? null;
        pdfUrl = finalized.invoice_pdf ?? null;
        stripeStatus = finalized.status ?? "open";
        stripeTotal = finalized.total ?? stripeTotal;
        await stripe.invoices.sendInvoice(stripeInv.id);
      }
      await exec({ sql: `UPDATE invoices SET status = ?, total_cents = ?, amount_cents = ?, sent_at = ?, stripe_invoice_id = ?, hosted_invoice_url = ?, pdf_url = ? WHERE id = ?`, args: [stripeStatus, stripeTotal, stripeTotal, now(), stripeInvoiceId, hostedUrl, pdfUrl, payload.id as string] });
      return { ok: true, hosted_invoice_url: hostedUrl, pdf_url: pdfUrl, stripe_invoice_id: stripeInvoiceId };
    }
    case "invoices.resend": {
      const { rows } = await exec({ sql: `SELECT * FROM invoices WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const inv = rows[0];
      if (!inv) throw new Error("Invoice not found");
      if (!stripe) throw new Error("Stripe is not configured.");

      const existingStripeId = inv.stripe_invoice_id as string | null;
      let brokenZeroTotal = false;
      if (existingStripeId) {
        try {
          const existing = await stripe.invoices.retrieve(existingStripeId);
          // A linked Stripe invoice with $0 total while the CRM record expects a real amount means
          // the line items never attached when it was created (see invoices.send safety check).
          brokenZeroTotal = (existing.total ?? 0) <= 0 && (inv.total_cents as number) > 0;
          if (!brokenZeroTotal) {
            if (existing.status === "paid" || existing.status === "void") {
              throw new Error(`This invoice is already ${existing.status} in Stripe — nothing to resend.`);
            }
            await stripe.invoices.sendInvoice(existingStripeId);
            await exec({ sql: `UPDATE invoices SET sent_at = ? WHERE id = ?`, args: [now(), payload.id as string] });
            return { ok: true, stripe_invoice_id: existingStripeId, hosted_invoice_url: existing.hosted_invoice_url ?? inv.hosted_invoice_url };
          }
          // Void the broken $0 invoice before creating its replacement.
          try { await stripe.invoices.voidInvoice(existingStripeId); } catch { /* may already be finalized/paid at $0, ignore */ }
        } catch (e) {
          if (!brokenZeroTotal) throw e;
        }
      }

      // No usable Stripe invoice yet, or the linked one was broken — create a fresh one from the
      // CRM's stored line items (same path invoices.send uses).
      const customerId = await ensureStripeCustomer(inv.client_id as string);
      type LineItem = { description: string; quantity: number; unit_amount_cents: number };
      const lineItems: LineItem[] = JSON.parse((inv.line_items as string) || "[]");
      if (lineItems.length === 0) throw new Error("This invoice has no stored line items — cannot recreate it in Stripe. Contact support.");
      const dueDays = Math.max(1, Math.round((new Date(inv.due_at as string).getTime() - Date.now()) / 86400000)) || 14;
      for (const item of lineItems) {
        await stripe.invoiceItems.create({ customer: customerId, amount: Math.round((item.unit_amount_cents ?? 0) * (item.quantity ?? 1)), currency: ((inv.currency as string) || "CAD").toLowerCase(), description: item.description || "Service" });
      }
      const stripeInv = await stripe.invoices.create({ customer: customerId, collection_method: "send_invoice", days_until_due: dueDays, pending_invoice_items_behavior: "include", custom_fields: [{ name: "Invoice No.", value: inv.number as string }], metadata: { crm_invoice_id: inv.id as string } });
      const finalized = await stripe.invoices.finalizeInvoice(stripeInv.id);
      if ((finalized.total ?? 0) <= 0) {
        try { await stripe.invoices.voidInvoice(stripeInv.id); } catch { /* best effort */ }
        throw new Error("Stripe created this replacement invoice with a $0 total again. The invoice was voided and NOT sent — please check the product price and try again.");
      }
      await stripe.invoices.sendInvoice(stripeInv.id);
      await exec({
        sql: `UPDATE invoices SET status = 'open', total_cents = ?, amount_cents = ?, amount_paid_cents = 0, paid_at = NULL, sent_at = ?, stripe_invoice_id = ?, hosted_invoice_url = ?, pdf_url = ? WHERE id = ?`,
        args: [finalized.total ?? inv.total_cents, finalized.total ?? inv.amount_cents, now(), stripeInv.id, finalized.hosted_invoice_url ?? null, finalized.invoice_pdf ?? null, payload.id as string],
      });
      return { ok: true, stripe_invoice_id: stripeInv.id, hosted_invoice_url: finalized.hosted_invoice_url, recreated: true };
    }
    case "invoices.markPaid": {
      const paidAt = (payload.paid_at as string) || now();
      const paymentMethod = (payload.payment_method as string) || null;
      const paymentNotes = (payload.notes as string) || null;
      const { rows: invRows } = await exec({ sql: `SELECT total_cents, currency, client_id FROM invoices WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const inv = invRows[0];
      await execMany([
        { sql: `UPDATE invoices SET status = 'paid', paid_at = ?, amount_paid_cents = total_cents, payment_method = ?, payment_notes = ? WHERE id = ?`, args: [paidAt, paymentMethod, paymentNotes, payload.id as string] },
        ...(inv ? [{ sql: `INSERT INTO payments (id, invoice_id, client_id, amount_cents, currency, method, notes, status, paid_at) VALUES (?,?,?,?,?,?,?,?,?)`, args: [uuid(), payload.id as string, inv.client_id as string, inv.total_cents as number, (inv.currency as string) || "CAD", paymentMethod, paymentNotes, "succeeded", paidAt] }] : []),
      ]);
      return { ok: true };
    }
    case "invoices.markUnpaid": {
      // Undo a manual mark-as-paid: remove the manual payment record (Stripe-sourced
      // payments have a payment intent id and are left untouched) and clear the
      // payment details so the invoice reads as genuinely open again.
      await execMany([
        { sql: `DELETE FROM payments WHERE invoice_id = ? AND stripe_payment_intent_id IS NULL`, args: [payload.id as string] },
        { sql: `UPDATE invoices SET status = 'open', paid_at = NULL, amount_paid_cents = 0, payment_method = NULL, payment_notes = NULL WHERE id = ?`, args: [payload.id as string] },
      ]);
      return { ok: true };
    }
    case "invoices.checkStripe": {
      const { rows } = await exec({ sql: `SELECT id, stripe_invoice_id FROM invoices WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const inv = rows[0];
      if (!inv?.stripe_invoice_id) throw new Error("No Stripe invoice is linked to this record.");
      if (!stripe) throw new Error("Stripe is not configured on this account.");
      const stripeInv = await stripe.invoices.retrieve(inv.stripe_invoice_id as string);
      const stripeStatus = stripeInv.status ?? "open";
      const crmStatus = stripeStatus === "paid" ? "paid" : stripeStatus === "void" ? "void" : "open";
      // Only update CRM if Stripe's status is more advanced (don't un-mark a manually paid invoice)
      await exec({
        sql: `UPDATE invoices SET amount_paid_cents = ?, hosted_invoice_url = COALESCE(?, hosted_invoice_url), pdf_url = COALESCE(?, pdf_url), status = CASE WHEN ? IN ('paid','void') THEN ? ELSE status END, paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN ? ELSE paid_at END WHERE id = ?`,
        args: [stripeInv.amount_paid ?? 0, stripeInv.hosted_invoice_url ?? null, stripeInv.invoice_pdf ?? null, crmStatus, crmStatus, crmStatus, now(), inv.id as string],
      });
      return { ok: true, stripe_status: stripeStatus, amount_paid: stripeInv.amount_paid, number: stripeInv.number };
    }
    case "invoices.markStripePaid": {
      const { rows } = await exec({ sql: `SELECT id, stripe_invoice_id FROM invoices WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      const inv = rows[0];
      if (!inv?.stripe_invoice_id) throw new Error("No Stripe invoice linked to this record.");
      if (!stripe) throw new Error("Stripe is not configured.");
      try {
        // paid_out_of_band = true marks the invoice paid without charging the customer through Stripe
        await stripe.invoices.pay(inv.stripe_invoice_id as string, { paid_out_of_band: true });
      } catch (e) {
        const msg = ((e as Error).message ?? "").toLowerCase();
        // Ignore "already paid" — that's our desired end state
        if (!msg.includes("already") && !msg.includes("is paid")) throw e;
      }
      await exec({ sql: `UPDATE invoices SET status = 'paid', amount_paid_cents = total_cents, paid_at = COALESCE(paid_at, ?) WHERE id = ?`, args: [now(), inv.id as string] });
      return { ok: true };
    }
    case "invoices.closeStripeByInvoiceNumber": {
      if (!stripe) throw new Error("Stripe is not configured.");
      const crmInvoiceId = payload.id as string;
      const stripeNumber = ((payload.stripe_number as string) ?? "").trim();
      if (!stripeNumber) throw new Error("Stripe invoice number is required.");
      const { rows: crmRows } = await exec({ sql: `SELECT id FROM invoices WHERE id = ? LIMIT 1`, args: [crmInvoiceId] });
      if (!crmRows[0]) throw new Error("CRM invoice not found.");
      // Search Stripe for the invoice by number
      let stripeInv: Stripe.Invoice | null = null;
      try {
        const results = await stripe.invoices.search({ query: `number:"${stripeNumber}"`, limit: 1 });
        stripeInv = results.data[0] ?? null;
      } catch {
        // Fallback: list recent invoices if search API is unavailable
        const list = await stripe.invoices.list({ limit: 100 });
        stripeInv = list.data.find((i) => i.number === stripeNumber) ?? null;
      }
      if (!stripeInv) throw new Error(`No Stripe invoice found with number "${stripeNumber}". Check the number in your Stripe dashboard.`);
      if (stripeInv.status === "void") throw new Error("This Stripe invoice is voided and cannot be marked as paid.");
      if (stripeInv.status === "open") {
        await stripe.invoices.pay(stripeInv.id, { paid_out_of_band: true });
      }
      // Link and update the CRM record
      await exec({ sql: `UPDATE invoices SET stripe_invoice_id = ?, status = 'paid', amount_paid_cents = total_cents, paid_at = COALESCE(paid_at, ?), hosted_invoice_url = COALESCE(?, hosted_invoice_url), pdf_url = COALESCE(?, pdf_url) WHERE id = ?`, args: [stripeInv.id, now(), stripeInv.hosted_invoice_url ?? null, stripeInv.invoice_pdf ?? null, crmInvoiceId] });
      return { ok: true, stripe_status: "paid", stripe_invoice_id: stripeInv.id };
    }
    case "invoices.updatePaymentDetails": {
      const { rows } = await exec({ sql: `SELECT id FROM invoices WHERE id = ? LIMIT 1`, args: [payload.id as string] });
      if (!rows[0]) throw new Error("Invoice not found.");
      await execMany([
        { sql: `UPDATE invoices SET payment_method = ?, payment_notes = ? WHERE id = ?`, args: [(payload.payment_method as string) ?? null, (payload.notes as string) ?? null, payload.id as string] },
        // Keep the payment ledger row in sync so the Payment tab shows the same
        // method and bank/e-Transfer reference. Stripe-sourced payments are left alone.
        { sql: `UPDATE payments SET method = ?, notes = ? WHERE invoice_id = ? AND stripe_payment_intent_id IS NULL`, args: [(payload.payment_method as string) ?? null, (payload.notes as string) ?? null, payload.id as string] },
      ]);
      return { ok: true };
    }
    case "invoices.list": {
      const invWhere: string[] = ["1=1"]; const invArgs: SqlValue[] = [];
      if (payload.client_id) { invWhere.push("i.client_id = ?"); invArgs.push(payload.client_id as string); }
      if (payload.status) { invWhere.push("i.status = ?"); invArgs.push(payload.status as string); }
      const { rows } = await exec({ sql: `SELECT i.id, i.client_id, c.name as client_name, i.number, i.status, i.subtotal_cents, i.tax_cents, i.total_cents, i.amount_cents, i.amount_paid_cents, i.currency, i.line_items, i.issued_at, i.due_at as due_date, i.paid_at, i.sent_at, i.hosted_invoice_url, i.pdf_url, i.stripe_invoice_id, i.payment_method, i.payment_notes, i.created_at FROM invoices i JOIN clients c ON c.id = i.client_id WHERE ${invWhere.join(" AND ")} ORDER BY i.issued_at DESC LIMIT 200`, args: invArgs });
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

    // ── Brand assets (client_brand_assets table in Supabase + public brand-assets bucket) ──
    case "brand.get": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data, error } = await adminClient.from("client_brand_assets").select("*").eq("crm_client_id", clientId).maybeSingle();
      if (error) throw new Error(error.message);
      return { assets: data ?? null };
    }
    case "brand.uploadUrl": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      try { await adminStorage.createBucket("brand-assets", { public: true }); } catch { /* already exists */ }
      const slot = (payload.slot as string) || "misc";
      const fileId = uuid();
      const safeName = ((payload.filename as string) || "asset").replace(/[^\w.-]+/g, "_");
      const storagePath = `${ctx.agencyId}/${clientId}/${slot}/${fileId}/${safeName}`;
      const { data, error } = await adminStorage.from("brand-assets").createSignedUploadUrl(storagePath);
      if (error || !data) throw new Error(error?.message ?? "Failed to create brand upload URL");
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/brand-assets/${storagePath}`;
      return { upload_url: data.signedUrl, token: data.token, storage_path: storagePath, public_url: publicUrl };
    }
    case "brand.save": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
      const fields = ["logo_square_url", "logo_rect_url", "logo_square_dark_url", "logo_rect_dark_url", "tagline"];
      const row: Record<string, unknown> = { crm_client_id: clientId, updated_at: now() };
      for (const f of fields) if (f in payload) row[f] = (payload[f] as string | null) ?? null;
      const { error } = await adminClient.from("client_brand_assets").upsert(row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case "agencies.list": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const { rows } = await exec({ sql: `SELECT * FROM agencies ORDER BY name ASC` });
      return rows;
    }

    // ─── Read-only public API keys (consumed by the seo-api function) ──────
    case "apiKeys.list": {
      const payloadAgency = payload.agency_id as string | undefined;
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
      let query = adminClient
        .from("api_keys")
        .select("id, agency_id, label, key_prefix, scopes, created_at, last_used_at, revoked_at")
        .order("created_at", { ascending: false });
      if (!ctx.isSuperAdmin) query = query.eq("agency_id", ctx.agencyId);
      else if (payloadAgency && payloadAgency !== "all") query = query.eq("agency_id", payloadAgency);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { keys: data ?? [] };
    }
    case "apiKeys.create": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const label = ((payload.label as string) ?? "").trim().slice(0, 80) || "Untitled key";
      const agencyId = ((payload.agency_id as string) || "citywide").trim();
      const { rows: agency } = await exec({ sql: `SELECT id, status FROM agencies WHERE id = ? LIMIT 1`, args: [agencyId] });
      if (!agency[0]) return { error: `Workspace ${agencyId} not found` };
      if (String(agency[0].status ?? "active").toLowerCase() === "cancelled") {
        return { error: "This workspace is cancelled — its API keys cannot be used" };
      }

      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const key = `cwd_live_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
      const id = `key_${uuid().slice(0, 8)}`;
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
      const { error } = await adminClient.from("api_keys").insert({
        id,
        agency_id: agencyId,
        label,
        key_prefix: key.slice(0, 16),
        key_hash: await sha256Hex(key),
        scopes: "clients:read",
      });
      if (error) return { error: error.message };
      // The plaintext key is returned once and never stored.
      return { id, key, key_prefix: key.slice(0, 16), label, agency_id: agencyId, scopes: "clients:read" };
    }
    case "apiKeys.revoke": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const id = payload.id as string;
      if (!id) return { error: "missing key id" };
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
      const { error } = await adminClient
        .from("api_keys")
        .update({ revoked_at: now() })
        .eq("id", id)
        .is("revoked_at", null);
      if (error) return { error: error.message };
      return { ok: true };
    }
    case "apiKeys.backfillProfiles": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const { rows: targets } = await exec({
        sql: `SELECT id, gbp_connection_id FROM clients
              WHERE gbp_connection_id IS NOT NULL AND gbp_connection_id <> ''
                AND (website IS NULL OR website = '' OR industry IS NULL OR industry = '')`,
      });
      if (targets.length === 0) return { examined: 0, updated: 0 };

      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: profiles, error } = await adminClient
        .from("gbp_connections")
        .select("id, website, category");
      if (error) return { error: error.message };
      const byId = new Map<string, { website: string | null; category: string | null }>();
      for (const p of profiles ?? []) {
        byId.set(String(p.id), {
          website: (p.website as string | null) ?? null,
          category: (p.category as string | null) ?? null,
        });
      }

      let updated = 0;
      const stamp = now();
      for (const t of targets) {
        const profile = byId.get(String(t.gbp_connection_id));
        if (!profile) continue;
        await exec({
          sql: `UPDATE clients SET website = COALESCE(NULLIF(website, ''), ?), industry = COALESCE(NULLIF(industry, ''), ?), updated_at = ? WHERE id = ?`,
          args: [profile.website, profile.category, stamp, String(t.id)],
        });
        updated++;
      }
      return { examined: targets.length, updated };
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
