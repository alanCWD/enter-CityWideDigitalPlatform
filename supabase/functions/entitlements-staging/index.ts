// Read-only workspace entitlement mirror for the CityWide Social Studio.
//
// Route (relative to this function's URL; a leading /api is tolerated so a
// proxy can expose /api/v1/... unchanged):
//   GET /v1/workspaces/{workspaceId}/entitlements
//   GET /health
//
// Auth: `Authorization: Bearer <workspace token>`. Server-to-server only, so no
// CORS headers are emitted. Tokens are stored as SHA-256 hashes; the plaintext
// is shown once when issued in CED and is never logged.
//
// CED owns every value. The snapshot is assembled on each request from the CRM
// database (client, subscription, plan product) and the managed database
// (workspace settings, plan entitlements, staff), so a plan change is visible on
// the next poll. Nothing is cached and nothing is written back.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE = "cwd-ced-entitlements";
const VERSION = "1.0";
const SCHEMA_VERSION = "2026-11-01";
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Role = "owner" | "approver" | "viewer";
type MemberStatus = "active" | "invited" | "disabled";
type PlanId = "starter" | "growth" | "pro";

interface OutMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  updatedAt: string;
}

interface WorkspaceRow {
  workspace_id: string;
  crm_client_id: string;
  agency_id: string;
  timezone: string;
  gst_rate: number | string;
  currency: string;
}

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      ...extraHeaders,
    },
  });

const emptyResponse = (status: number, extraHeaders: Record<string, string> = {}) =>
  new Response(null, { status, headers: { "Cache-Control": "private, no-store", ...extraHeaders } });

const apiError = (
  status: number,
  code: string,
  message: string,
  requestId: string,
  extraHeaders: Record<string, string> = {},
) =>
  json(
    { error: { code, message, requestId } },
    status,
    { "X-Request-Id": requestId, ...extraHeaders },
  );

// ── CRM database access ─────────────────────────────────────────────────────

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

async function exec(sql: string, args: SqlValue[] = []): Promise<Row[]> {
  if (!BUNNY_TOKEN) throw new Error("BUNNY_DB_AUTH_TOKEN not configured");
  const base = bunnyHttpBase();
  if (!base || base === "https://") throw new Error("BUNNY_DB_URL not configured");

  const res = await fetch(`${base}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
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
        },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`CRM database HTTP ${res.status}`);

  const data = await res.json() as {
    results: Array<{
      type: string;
      response?: { result?: { cols: Array<{ name: string }>; rows: BunnyCell[][] } };
      error?: { message: string };
    }>;
  };
  const r = data.results?.[0];
  if (!r) throw new Error("CRM database returned an incomplete response");
  if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "CRM database error");

  const cols = r.response?.result?.cols ?? [];
  return (r.response?.result?.rows ?? []).map((arr) => {
    const o: Row = {};
    cols.forEach((c, idx) => {
      const v = arr[idx];
      if (!v || v.type === "null") o[c.name] = null;
      else if (v.type === "integer" || v.type === "float") o[c.name] = Number(v.value);
      else o[c.name] = v.value ?? null;
    });
    return o;
  });
}

// ── Small helpers ───────────────────────────────────────────────────────────

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function iso(value: SqlValue | undefined | null): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  let s = raw.includes("T") ? raw : raw.replace(" ", "T");
  if (!/(z|[+-]\d{2}:?\d{2})$/i.test(s)) s += "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function text(value: SqlValue | undefined | null): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function displayName(name: string | null | undefined, email: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed;
  const local = email.split("@")[0] ?? "";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Unnamed member";
}

function planKey(...values: Array<string | null | undefined>): PlanId | null {
  for (const value of values) {
    const s = (value ?? "").toLowerCase();
    if (!s) continue;
    if (s.includes("starter")) return "starter";
    if (s.includes("growth")) return "growth";
    if (/\bpro\b/.test(s) || s.includes("professional")) return "pro";
  }
  return null;
}

function accountStatus(raw: string): "active" | "suspended" | "closed" | null {
  switch (raw.toLowerCase()) {
    case "active":
    case "trial":
    case "trialing":
    case "prospect":
    case "lead":
      return "active";
    case "paused":
    case "suspended":
      return "suspended";
    case "churned":
    case "archived":
    case "cancelled":
    case "canceled":
    case "closed":
    case "inactive":
      return "closed";
    default:
      return null;
  }
}

function subscriptionStatus(raw: string): "trialing" | "active" | "past_due" | "paused" | "canceled" | null {
  switch (raw.toLowerCase()) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "cancelled":
    case "deleted":
      return "canceled";
    case "pending":
      return "trialing";
    default:
      return null;
  }
}

const ROLE_RANK: Record<Role, number> = { owner: 3, approver: 2, viewer: 1 };
const STATUS_RANK: Record<MemberStatus, number> = { active: 3, invited: 2, disabled: 1 };

function higherRole(a: Role, b: Role): Role {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

function agencyRole(role: string): Role | null {
  switch (role.toLowerCase()) {
    case "super_admin":
    case "admin":
    case "agency":
      return "owner";
    case "agency_staff":
      return "approver";
    default:
      return null;
  }
}

function clientRole(role: string): Role {
  switch (role.toLowerCase()) {
    case "client_admin":
      return "owner";
    case "client":
      return "approver";
    default:
      return "viewer";
  }
}

function portalRole(role: string): Role {
  switch (role.toLowerCase()) {
    case "owner":
      return "owner";
    case "admin":
    case "manager":
    case "staff":
    case "agent":
      return "approver";
    default:
      return "viewer";
  }
}

// ── Members ─────────────────────────────────────────────────────────────────

interface Candidate {
  role: Role;
  email: string | null;
  name: string | null;
  signedIn: boolean;
  updatedAt: string | null;
  inviteStatus?: MemberStatus;
  banned?: boolean;
  bannedUntil?: string | null;
}

/**
 * Members are derived live from who can act on this client in CED:
 *   - agency staff (CED roles) can act on every workspace in their agency;
 *   - people bound to this client (client memberships, portal users);
 *   - people CED has invited to the workspace who have no login yet.
 * A removal in CED therefore disappears here on the next request.
 */
async function buildMembers(
  workspace: WorkspaceRow,
  connectionId: string | null,
): Promise<{ members: OutMember[]; problems: string[] }> {
  const problems: string[] = [];
  const candidates = new Map<string, Candidate>();

  const add = (key: string, c: Candidate) => {
    const existing = candidates.get(key);
    if (!existing) {
      candidates.set(key, c);
      return;
    }
    candidates.set(key, {
      ...existing,
      role: higherRole(existing.role, c.role),
      email: existing.email ?? c.email,
      name: existing.name ?? c.name,
      signedIn: existing.signedIn || c.signedIn,
      banned: existing.banned || c.banned,
      bannedUntil: existing.bannedUntil ?? c.bannedUntil,
      updatedAt: existing.updatedAt ?? c.updatedAt,
    });
  };

  const [rolesRes, membershipsRes, invitesRes] = await Promise.all([
    db.from("user_roles").select("user_id, role"),
    db.from("client_memberships").select("user_id, client_id").eq("client_id", workspace.crm_client_id),
    db
      .from("workspace_staff_invites")
      .select("id, name, email, role, status, updated_at")
      .eq("workspace_id", workspace.workspace_id),
  ]);

  for (const row of rolesRes.data ?? []) {
    const role = agencyRole(String(row.role ?? ""));
    if (role) add(`u:${row.user_id}`, { role, email: null, name: null, signedIn: false, updatedAt: null });
  }

  const roleByUser = new Map<string, string>();
  for (const row of rolesRes.data ?? []) roleByUser.set(String(row.user_id), String(row.role ?? ""));

  for (const row of membershipsRes.data ?? []) {
    const userId = String(row.user_id);
    add(`u:${userId}`, {
      role: clientRole(roleByUser.get(userId) ?? ""),
      email: null,
      name: null,
      signedIn: false,
      updatedAt: null,
    });
  }

  if (connectionId) {
    const portalRes = await db
      .from("portal_users")
      .select("user_id, role, created_at")
      .eq("connection_id", connectionId);
    for (const row of portalRes.data ?? []) {
      const userId = String(row.user_id);
      add(`u:${userId}`, {
        role: portalRole(String(row.role ?? "")),
        email: null,
        name: null,
        signedIn: false,
        updatedAt: iso(row.created_at as string | null),
      });
    }
  }

  const userIds = [...candidates.keys()].filter((k) => k.startsWith("u:")).map((k) => k.slice(2));
  if (userIds.length > 0) {
    const directory = await db
      .from("workspace_member_directory")
      .select("id, email, full_name, last_sign_in_at, banned_until, updated_at")
      .in("id", userIds);
    if (directory.error) throw new Error(directory.error.message);
    const byId = new Map((directory.data ?? []).map((u) => [String(u.id), u]));

    for (const userId of userIds) {
      const c = candidates.get(`u:${userId}`);
      if (!c) continue;
      const person = byId.get(userId);
      if (!person) {
        problems.push(`member ${userId} has no CED directory record`);
        continue;
      }
      c.email = person.email ? String(person.email) : null;
      c.name = person.full_name ? String(person.full_name) : null;
      if (person.last_sign_in_at) c.signedIn = true;
      c.bannedUntil = person.banned_until ? String(person.banned_until) : null;
      c.banned = !!c.bannedUntil && Date.parse(c.bannedUntil) > Date.now();
      c.updatedAt = iso(person.updated_at as string | null) ?? c.updatedAt;
    }
  }

  for (const row of invitesRes.data ?? []) {
    add(`i:${row.id}`, {
      role: (["owner", "approver", "viewer"].includes(String(row.role)) ? String(row.role) : "viewer") as Role,
      email: row.email ? String(row.email) : null,
      name: row.name ? String(row.name) : null,
      signedIn: false,
      updatedAt: iso(row.updated_at as string | null),
      inviteStatus: (["active", "invited", "disabled"].includes(String(row.status))
        ? String(row.status)
        : "invited") as MemberStatus,
    });
  }

  const members: OutMember[] = [];
  for (const [key, c] of candidates) {
    const email = (c.email ?? "").trim();
    if (!email) {
      problems.push(`${key} has no email address`);
      continue;
    }
    const status: MemberStatus = c.banned
      ? "disabled"
      : c.inviteStatus ?? (c.signedIn ? "active" : "invited");
    const updatedAt = c.updatedAt ?? new Date().toISOString();
    members.push({
      id: `usr_${key.slice(2).replace(/-/g, "")}`,
      name: displayName(c.name, email),
      email,
      role: c.role,
      status,
      updatedAt,
    });
  }

  members.sort(
    (a, b) =>
      ROLE_RANK[b.role] - ROLE_RANK[a.role] ||
      STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
      a.name.localeCompare(b.name),
  );

  return { members, problems };
}

// ── Snapshot ────────────────────────────────────────────────────────────────

interface SnapshotResult {
  body?: Record<string, unknown>;
  headers: Record<string, string>;
  problem?: string;
}

async function buildSnapshot(workspace: WorkspaceRow): Promise<SnapshotResult> {
  const [client, subs] = await Promise.all([
    exec(
      `SELECT id, name, status, billing_email, plan, gbp_connection_id, updated_at
       FROM clients WHERE id = ? LIMIT 1`,
      [workspace.crm_client_id],
    ),
    exec(
      `SELECT s.status AS sub_status, s.current_period_end, s.cancel_at_period_end,
              s.updated_at AS sub_updated_at,
              p.name AS product_name, p.unit_amount_cents, p.price_cents, p.currency
       FROM subscriptions s JOIN products p ON p.id = s.product_id
       WHERE s.client_id = ?
       ORDER BY CASE WHEN s.status IN ('active', 'trialing') THEN 0
                     WHEN s.status = 'pending' THEN 1 ELSE 2 END,
                datetime(COALESCE(s.updated_at, s.created_at)) DESC
       LIMIT 1`,
      [workspace.crm_client_id],
    ),
  ]);

  const clientRow = client[0];
  if (!clientRow) return { headers: {}, problem: "the mapped CED client does not exist" };

  const subscriptionRow = subs[0];
  if (!subscriptionRow) return { headers: {}, problem: "the workspace has no subscription in CED" };

  const accountStatusValue = accountStatus(text(clientRow.status));
  if (!accountStatusValue) {
    return { headers: {}, problem: `client status "${text(clientRow.status)}" has no contract mapping` };
  }

  const planId = planKey(text(subscriptionRow.product_name), text(clientRow.plan));
  if (!planId) {
    return { headers: {}, problem: "the subscription's plan cannot be mapped to starter, growth or pro" };
  }

  const subStatus = subscriptionStatus(text(subscriptionRow.sub_status));
  if (!subStatus) {
    return { headers: {}, problem: `subscription status "${text(subscriptionRow.sub_status)}" has no contract mapping` };
  }

  const { data: entitlementRows, error: entitlementError } = await db
    .from("workspace_plan_entitlements")
    .select("plan_id, social_studio, max_channels, white_label, ai_monthly_cap_usd")
    .eq("plan_id", planId)
    .limit(1);
  if (entitlementError) throw new Error(entitlementError.message);
  const entitlement = entitlementRows?.[0];
  if (!entitlement) return { headers: {}, problem: `no entitlement row exists for plan ${planId}` };

  const billingEmail = text(clientRow.billing_email);
  if (!billingEmail) return { headers: {}, problem: "the client has no billing email" };

  const accountName = text(clientRow.name);
  if (!accountName) return { headers: {}, problem: "the client has no name" };

  const priceCents = Number(subscriptionRow.unit_amount_cents ?? 0) ||
    Number(subscriptionRow.price_cents ?? 0);
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return { headers: {}, problem: "the plan has no readable price" };
  }

  const periodEnd = subStatus === "trialing" || subStatus === "canceled"
    ? null
    : iso(subscriptionRow.current_period_end);
  if (subStatus !== "trialing" && subStatus !== "canceled" && !periodEnd) {
    return { headers: {}, problem: "the subscription has no readable current period end" };
  }

  const currency = (text(subscriptionRow.currency) || workspace.currency || "CAD").toUpperCase();
  const gstRate = Number(workspace.gst_rate);
  if (!Number.isFinite(gstRate)) return { headers: {}, problem: "the workspace GST rate is not a number" };

  const { members, problems } = await buildMembers(
    workspace,
    text(clientRow.gbp_connection_id) || null,
  );
  if (problems.length > 0) {
    return { headers: {}, problem: problems.join("; ") };
  }

  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    workspaceId: workspace.workspace_id,
    account: {
      id: `acct_${text(clientRow.id)}`,
      name: accountName,
      status: accountStatusValue,
      billingEmail,
      timezone: workspace.timezone,
      currency,
    },
    subscription: {
      planId,
      planName: text(subscriptionRow.product_name) || planId,
      status: subStatus,
      priceCad: Math.round(priceCents) / 100,
      gstRate,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: Number(subscriptionRow.cancel_at_period_end ?? 0) === 1,
    },
    entitlements: {
      socialStudio: !!entitlement.social_studio,
      maxChannels: Number(entitlement.max_channels),
      whiteLabel: !!entitlement.white_label,
      aiMonthlyCapUsd: Number(entitlement.ai_monthly_cap_usd),
    },
    members,
  };

  const fingerprint = await sha256Hex(JSON.stringify(snapshot));
  const etag = `W/"${fingerprint.slice(0, 32)}"`;

  return {
    body: { ...snapshot, syncedAt: new Date().toISOString(), etag },
    headers: { ETag: etag },
  };
}

// ── Auth, limits, logging ───────────────────────────────────────────────────

function bearerToken(req: Request): string | null {
  const auth = (req.headers.get("Authorization") ?? "").trim();
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

interface TokenCtx { tokenId: string; workspaceId: string }

async function authenticate(
  req: Request,
  requestId: string,
): Promise<TokenCtx | Response> {
  const token = bearerToken(req);
  if (!token) return apiError(401, "unauthorized", "Missing or invalid bearer token", requestId);
  if (!token.startsWith("cwd_ent_")) {
    return apiError(401, "unauthorized", "Missing or invalid bearer token", requestId);
  }

  const hash = await sha256Hex(token);
  const { data, error } = await db
    .from("workspace_api_tokens")
    .select("id, workspace_id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) {
    return apiError(401, "unauthorized", "Missing or invalid bearer token", requestId);
  }

  return { tokenId: String(data.id), workspaceId: String(data.workspace_id) };
}

async function rateCheck(workspaceId: string, requestId: string): Promise<Response | null> {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { data, error } = await db
    .from("workspace_api_requests")
    .select("created_at")
    .eq("workspace_id", workspaceId)
    .neq("status", 429)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(RATE_LIMIT + 1);
  if (error) throw new Error(error.message);

  const recent = data ?? [];
  if (recent.length < RATE_LIMIT) return null;

  const oldestAt = Date.parse(String(recent[0]?.created_at));
  const elapsed = Number.isNaN(oldestAt) ? RATE_WINDOW_MS : Date.now() - oldestAt;
  const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - elapsed) / 1000));
  return apiError(
    429,
    "rate_limited",
    `Rate limit exceeded: ${RATE_LIMIT} requests per hour per workspace`,
    requestId,
    { "Retry-After": String(retryAfter) },
  );
}

async function logRequest(
  workspaceId: string | null,
  tokenId: string | null,
  route: string,
  status: number,
  durationMs: number,
  requestId: string,
) {
  // Status, duration and ids only: no payload, no email address, no token.
  try {
    await db.from("workspace_api_requests").insert({
      workspace_id: workspaceId,
      token_id: tokenId,
      route,
      status,
      duration_ms: Math.round(durationMs),
      request_id: requestId,
    });
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - LOG_RETENTION_MS).toISOString();
      await db.from("workspace_api_requests").delete().lt("created_at", cutoff);
    }
  } catch (e) {
    console.error(`entitlements log failed requestId=${requestId}: ${(e as Error).message}`);
  }
}

/**
 * Route parsing must survive whatever prefix the platform forwards: the
 * function name is kept in the path, and a proxy may add /api. Everything
 * before the first route token is dropped, so the same code works whether the
 * caller sends /functions/v1/<name>/v1/..., /<name>/api/v1/... or just /v1/....
 */
function parseSegments(rawPath: string): string[] {
  const decode = (s: string) => {
    try { return decodeURIComponent(s); } catch { return s; }
  };
  let segs = rawPath.split("/").filter(Boolean).map(decode);

  const fnIdx = segs.findIndex((s, i) => s === "functions" && segs[i + 1] === "v1");
  if (fnIdx >= 0) segs = segs.slice(fnIdx + 3); // functions, v1, function name

  const known = new Set(["health", "v1", "workspaces", "api"]);
  while (segs.length > 0 && !known.has(segs[0])) segs.shift();
  if (segs[0] === "api") segs.shift();
  if (segs[0] === "v1") segs.shift();
  return segs;
}

function etagMatches(header: string | null, current: string): boolean {
  if (!header) return false;
  const normalise = (v: string) => v.trim().replace(/^W\//i, "").replace(/"/g, "");
  const target = normalise(current);
  return header.split(",").some((part) => normalise(part) === target);
}

function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

// ── Server ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const requestId = newRequestId();
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  const segments = parseSegments(url.pathname);

  let workspaceId: string | null = null;
  let tokenId: string | null = null;

  const route = segments.length === 0 || segments[0] === "health"
    ? "health"
    : "workspaces.entitlements";

  const finish = async (res: Response): Promise<Response> => {
    await logRequest(workspaceId, tokenId, route, res.status, Date.now() - startedAt, requestId);
    return res;
  };

  if (method !== "GET" && method !== "HEAD") {
    return await finish(apiError(405, "method_not_allowed", "Only GET is supported", requestId));
  }

  const withBody = method === "HEAD"
    ? (res: Response) => emptyResponse(res.status, Object.fromEntries(res.headers))
    : (res: Response) => res;

  try {
    if (segments.length === 0 || segments[0] === "health") {
      return await finish(json(
        { ok: true, service: SERVICE, version: VERSION, schemaVersion: SCHEMA_VERSION },
        200,
        { "X-Request-Id": requestId },
      ));
    }

    const path = segments[0] === "v1" ? segments.slice(1) : segments;
    const shapeValid = path.length === 3 &&
      path[0] === "workspaces" &&
      path[1].length > 0 &&
      path[2] === "entitlements";

    if (!shapeValid) {
      if (path[0] === "workspaces") {
        return await finish(apiError(
          400,
          "invalid_request",
          "Expected /v1/workspaces/{workspaceId}/entitlements",
          requestId,
        ));
      }
      return await finish(apiError(404, "not_found", "Unknown route", requestId));
    }

    const auth = await authenticate(req, requestId);
    if (auth instanceof Response) return await finish(withBody(auth));
    tokenId = auth.tokenId;

    const requested = path[1];
    const { data: workspaceRow, error: workspaceError } = await db
      .from("workspace_entitlement_workspaces")
      .select("workspace_id, crm_client_id, agency_id, timezone, gst_rate, currency")
      .eq("workspace_id", requested)
      .maybeSingle();
    if (workspaceError) throw new Error(workspaceError.message);

    if (!workspaceRow) {
      return await finish(apiError(404, "not_found", "Unknown workspace", requestId));
    }
    workspaceId = String(workspaceRow.workspace_id);

    if (auth.workspaceId !== workspaceId) {
      return await finish(apiError(
        403,
        "forbidden",
        "This token is not allowed for this workspace",
        requestId,
      ));
    }

    const limited = await rateCheck(workspaceId, requestId);
    if (limited) return await finish(withBody(limited));

    try {
      await db
        .from("workspace_api_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", tokenId);
    } catch { /* last-used tracking is best effort */ }

    const snapshot = await buildSnapshot(workspaceRow as WorkspaceRow);

    if (!snapshot.body) {
      const reason = snapshot.problem ?? "CED could not build a complete snapshot";
      console.error(`entitlements 503 requestId=${requestId} workspace=${workspaceId}: ${reason}`);
      return await finish(apiError(
        503,
        "snapshot_unavailable",
        `Snapshot unavailable: ${reason}`,
        requestId,
      ));
    }

    const headers = { ...snapshot.headers, "X-Request-Id": requestId };

    if (etagMatches(req.headers.get("If-None-Match"), snapshot.headers["ETag"] ?? "")) {
      return await finish(emptyResponse(304, headers));
    }

    const res = json(snapshot.body, 200, headers);
    return await finish(withBody(res));
  } catch (e) {
    console.error(`entitlements error requestId=${requestId}: ${(e as Error).message}`);
    // Staging only: surface the failure so the snapshot can be fixed before the
    // clean endpoint is published. Never deployed as the production endpoint.
    return await finish(json(
      { error: { code: "internal_error", message: String((e as Error).message), requestId } },
      500,
      { "X-Request-Id": requestId, "X-Staging": "detail" },
    ));
  }
});
