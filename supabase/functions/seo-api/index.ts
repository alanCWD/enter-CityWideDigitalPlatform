// Read-only SEO monitoring API.
//
// Purpose: lets the separate SEO monitoring app import the client directory.
// It can only read clients — every write path is unreachable from here.
//
// Routes (relative to this function's URL; a leading /api is also tolerated so
// an edge proxy can expose dashboard.citywidedigital.ca/api/* unchanged):
//   GET /health
//   GET /clients?page=&per_page=&updated_since=
//   GET /clients/{id}
//
// Auth: `Authorization: Bearer <key>` or `x-api-key: <key>`. Never cookies.
// Server-to-server only, so no CORS headers are emitted.
//
// Storage: keys and the request log live in the managed database (RLS on, no
// policies — only the service role used here can read them). CRM records live
// in the CRM database and are read only through the queries below.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE = "cwd-dashboard";
const VERSION = "1.0";
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
const MAX_PER_PAGE = 500;
const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });

const apiError = (status: number, code: string, message: string, extraHeaders: Record<string, string> = {}) =>
  json({ error: { code, message } }, status, extraHeaders);

function bunnyHttpBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";

type SqlValue = string | number | null;
type Row = Record<string, SqlValue>;

interface BunnyCell { type: string; value?: string }

async function execMany(stmts: Array<{ sql: string; args?: SqlValue[] }>): Promise<Row[][]> {
  if (!BUNNY_TOKEN) throw new Error("BUNNY_DB_AUTH_TOKEN not configured");
  const base = bunnyHttpBase();
  if (!base || base === "https://") throw new Error("BUNNY_DB_URL not configured");

  const res = await fetch(`${base}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        ...stmts.map((s) => ({
          type: "execute",
          stmt: {
            sql: s.sql,
            args: (s.args ?? []).map((v) =>
              v === null || v === undefined
                ? { type: "null" }
                : typeof v === "number"
                ? { type: "integer", value: String(v) }
                : { type: "text", value: String(v) }
            ),
          },
        })),
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Bunny HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = await res.json() as {
    results: Array<{
      type: string;
      response?: { result?: { cols: Array<{ name: string }>; rows: BunnyCell[][] } };
      error?: { message: string };
    }>;
  };

  const out: Row[][] = [];
  for (let i = 0; i < stmts.length; i++) {
    const r = data.results?.[i];
    if (!r) throw new Error("Bunny returned an incomplete pipeline response");
    if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "bunny error");
    const cols = r.response?.result?.cols ?? [];
    const rows = (r.response?.result?.rows ?? []).map((arr) => {
      const o: Row = {};
      cols.forEach((c, idx) => {
        const v = arr[idx];
        if (!v || v.type === "null") o[c.name] = null;
        else if (v.type === "integer" || v.type === "float") o[c.name] = Number(v.value);
        else o[c.name] = v.value ?? null;
      });
      return o;
    });
    out.push(rows);
  }
  return out;
}

async function exec(sql: string, args: SqlValue[] = []): Promise<Row[]> {
  return (await execMany([{ sql, args }]))[0];
}

const nowIso = () => new Date().toISOString();

/** Normalise an ISO 8601 timestamp to `YYYY-MM-DDTHH:MM:SS.sssZ`. */
function iso(v: SqlValue | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  const raw = String(v).trim();
  let s = raw.includes("T") ? raw : raw.replace(" ", "T");
  if (!/(z|[+-]\d{2}:?\d{2})$/i.test(s)) s += "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
}

function planLabel(v: SqlValue | undefined): string | null {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.includes("starter")) return "Starter";
  if (s.includes("growth")) return "Growth";
  if (/\bpro\b/.test(s)) return "Pro";
  return null;
}

function mapStatus(v: SqlValue | undefined): string {
  switch (String(v ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "churned":
    case "cancelled":
    case "canceled":
    case "archived":
      return "cancelled";
    default:
      return "trial";
  }
}

function displayCity(row: Row): string | null {
  const parts = [row.city, row.region].map((p) => (p == null ? "" : String(p).trim())).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function textOrNull(v: SqlValue | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Some CRM records store phone numbers as `tel:` URIs — the API returns the
 *  dialable number, matching the documented `+16045550132` shape. */
function phoneValue(v: SqlValue | undefined): string | null {
  const s = textOrNull(v);
  if (!s) return null;
  return s.replace(/^tel:/i, "").trim() || null;
}

interface ClientObject {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  plan: string | null;
  status: string;
  archived: boolean;
  created_at: string | null;
  updated_at: string | null;
}

function toClient(row: Row): ClientObject {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: textOrNull(row.primary_email) ?? textOrNull(row.billing_email),
    phone: phoneValue(row.primary_phone) ?? phoneValue(row.phone),
    website: textOrNull(row.website),
    industry: textOrNull(row.industry),
    city: displayCity(row),
    plan: planLabel(row.plan_name),
    status: mapStatus(row.status),
    archived: String(row.status ?? "").toLowerCase() === "archived",
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at ?? row.created_at),
  };
}

const CLIENT_SELECT = `
  SELECT c.id, c.name, c.billing_email, c.phone, c.city, c.region, c.status,
         c.website, c.industry, c.created_at, c.updated_at,
         (SELECT ct.email FROM contacts ct
           WHERE ct.client_id = c.id AND ct.is_primary = 1 AND TRIM(COALESCE(ct.email, '')) <> ''
           ORDER BY ct.full_name ASC LIMIT 1) AS primary_email,
         (SELECT ct.phone FROM contacts ct
           WHERE ct.client_id = c.id AND ct.is_primary = 1 AND TRIM(COALESCE(ct.phone, '')) <> ''
           ORDER BY ct.full_name ASC LIMIT 1) AS primary_phone,
         (SELECT p.name FROM subscriptions s JOIN products p ON p.id = s.product_id
           WHERE s.client_id = c.id AND s.status IN ('active', 'trialing', 'pending')
           ORDER BY s.created_at DESC LIMIT 1) AS plan_name
  FROM clients c`;

let bootstrapped = false;
/** Additive only: the columns the API reads must exist even if the dashboard
 *  backend has not run its own bootstrap yet. Failures are ignored. */
async function bootstrap(): Promise<void> {
  if (bootstrapped) return;
  for (const sql of [
    `ALTER TABLE clients ADD COLUMN website TEXT`,
    `ALTER TABLE clients ADD COLUMN industry TEXT`,
    `ALTER TABLE agencies ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
  ]) {
    try {
      await exec(sql);
    } catch { /* column already exists */ }
  }
  bootstrapped = true;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractKey(req: Request): string | null {
  const auth = (req.headers.get("Authorization") ?? "").trim();
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : auth;
  }
  const xApiKey = (req.headers.get("x-api-key") ?? "").trim();
  return xApiKey || null;
}

interface KeyCtx { keyId: string; agencyId: string }

/** Route label used in the request log. Never includes client identifiers. */
function routeLabel(segments: string[]): string {
  if (segments.length === 0 || segments[0] === "health") return "health";
  if (segments[0] === "clients") return segments.length > 1 ? "clients.get" : "clients.list";
  return "unknown";
}

async function logRequest(keyId: string | null, route: string, method: string, status: number, durationMs: number) {
  // Logging must never break a response, and must never contain client data.
  try {
    await db.from("api_requests").insert({
      key_id: keyId,
      route,
      method,
      status,
      duration_ms: Math.round(durationMs),
    });
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - LOG_RETENTION_MS).toISOString();
      await db.from("api_requests").delete().lt("created_at", cutoff);
    }
  } catch (e) {
    console.error("seo-api request log failed:", (e as Error).message);
  }
}

async function authenticate(req: Request): Promise<KeyCtx | Response> {
  const key = extractKey(req);
  if (!key) return apiError(401, "unauthorized", "Missing API key");
  if (!key.startsWith("cwd_")) return apiError(401, "unauthorized", "Invalid API key");

  const hash = await sha256Hex(key);
  const { data, error } = await db
    .from("api_keys")
    .select("id, agency_id, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) return apiError(401, "unauthorized", "Invalid API key");

  const agencyRows = await exec(`SELECT status FROM agencies WHERE id = ? LIMIT 1`, [String(data.agency_id)]);
  const workspaceStatus = String(agencyRows[0]?.status ?? "active").toLowerCase();
  if (["cancelled", "canceled", "suspended", "archived"].includes(workspaceStatus)) {
    return apiError(403, "forbidden", "This workspace is no longer active");
  }

  return { keyId: String(data.id), agencyId: String(data.agency_id) };
}

async function rateCheck(keyId: string): Promise<Response | null> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  // Read at most RATE_LIMIT rows: when we get a full page, the limit is spent.
  const { data, error } = await db
    .from("api_requests")
    .select("created_at")
    .eq("key_id", keyId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(RATE_LIMIT);
  if (error) throw new Error(error.message);

  const recent = data ?? [];
  if (recent.length < RATE_LIMIT) return null;

  const oldestAt = Date.parse(String(recent[0]?.created_at));
  const elapsed = Number.isNaN(oldestAt) ? WINDOW_MS : Date.now() - oldestAt;
  const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000));
  return apiError(429, "rate_limited", `Rate limit exceeded: ${RATE_LIMIT} requests per minute`, {
    "Retry-After": String(retryAfter),
  });
}

function parsePositiveInt(raw: string | null, fallback: number): number | null {
  if (raw === null || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

async function handleList(ctx: KeyCtx, url: URL): Promise<Response> {
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  if (page === null) return apiError(400, "invalid_parameter", "page must be a positive integer");

  const requestedPerPage = parsePositiveInt(url.searchParams.get("per_page"), 100);
  if (requestedPerPage === null) return apiError(400, "invalid_parameter", "per_page must be a positive integer");
  const perPage = Math.min(requestedPerPage, MAX_PER_PAGE);

  const updatedSinceRaw = url.searchParams.get("updated_since");
  let updatedSince: string | null = null;
  if (updatedSinceRaw !== null && updatedSinceRaw.trim() !== "") {
    const parsed = new Date(updatedSinceRaw.trim());
    if (Number.isNaN(parsed.getTime())) {
      return apiError(400, "invalid_parameter", "updated_since must be an ISO 8601 timestamp");
    }
    updatedSince = parsed.toISOString();
  }

  const where = ["c.agency_id = ?"];
  const args: SqlValue[] = [ctx.agencyId];
  if (updatedSince) {
    // datetime() parses both `YYYY-MM-DD HH:MM:SS` and ISO `...T...Z` values, so
    // historically stored rows still compare correctly. The filter is inclusive.
    where.push("datetime(COALESCE(c.updated_at, c.created_at)) >= datetime(?)");
    args.push(updatedSince);
  }
  const whereClause = where.join(" AND ");
  const offset = (page - 1) * perPage;

  const [rows, countRows] = await execMany([
    {
      sql: `${CLIENT_SELECT} WHERE ${whereClause}
            ORDER BY datetime(COALESCE(c.updated_at, c.created_at)) ASC, c.id ASC
            LIMIT ? OFFSET ?`,
      args: [...args, perPage, offset],
    },
    { sql: `SELECT COUNT(*) AS total FROM clients c WHERE ${whereClause}`, args },
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const data = rows.map(toClient);
  return json({
    data,
    meta: { page, per_page: perPage, total, has_more: offset + data.length < total },
  });
}

async function handleGetOne(ctx: KeyCtx, id: string): Promise<Response> {
  const rows = await exec(
    `${CLIENT_SELECT} WHERE c.id = ? AND c.agency_id = ? LIMIT 1`,
    [id, ctx.agencyId],
  );
  if (!rows[0]) return apiError(404, "not_found", `No client with id ${id}`);
  return json(toClient(rows[0]));
}

function parseSegments(rawPath: string): string[] {
  let rest = rawPath;
  const marker = "/seo-api";
  const idx = rest.indexOf(marker);
  if (idx >= 0) rest = rest.slice(idx + marker.length);
  if (rest === "/api" || rest.startsWith("/api/")) rest = rest.slice(4);
  return rest.split("/").filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  const segments = parseSegments(url.pathname);
  const route = routeLabel(segments);
  let keyId: string | null = null;

  const finish = async (res: Response): Promise<Response> => {
    await logRequest(keyId, route, method, res.status, Date.now() - startedAt);
    return res;
  };

  if (method !== "GET" && method !== "HEAD") {
    return await finish(apiError(405, "method_not_allowed", "Only GET is supported"));
  }

  try {
    await bootstrap();

    // Health is public: it exposes service identity only, never data.
    if (segments.length === 0 || segments[0] === "health") {
      return await finish(json({ ok: true, service: SERVICE, version: VERSION }));
    }

    if (segments[0] !== "clients" || segments.length > 2) {
      return await finish(apiError(404, "not_found", "Unknown route"));
    }

    const auth = await authenticate(req);
    if (auth instanceof Response) return await finish(auth);
    keyId = auth.keyId;

    const limited = await rateCheck(auth.keyId);
    if (limited) return await finish(limited);

    try {
      await db.from("api_keys").update({ last_used_at: nowIso() }).eq("id", auth.keyId);
    } catch { /* last-used tracking is best-effort */ }

    const res = segments.length === 2
      ? await handleGetOne(auth, segments[1])
      : await handleList(auth, url);
    return await finish(res);
  } catch (e) {
    console.error("seo-api error:", (e as Error).message);
    return await finish(apiError(500, "internal_error", "Internal server error"));
  }
});
