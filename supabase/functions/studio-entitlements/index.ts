// Read-only workspace entitlement mirror for the CityWide Social Studio.
//
// Route (relative to this function's URL; a leading /api is tolerated so a
// proxy can expose /api/v1/... unchanged):
//   GET /v1/workspaces/{workspaceId}/entitlements
//   GET /health
//
// Auth: `Authorization: Bearer <workspace token>`. Server-to-server only.
// Tokens are stored as SHA-256 hashes; the plaintext is shown once when issued
// in CED and is never logged.
//
// CED owns every value. The snapshot is assembled on each request from the CRM
// database (client, subscription, plan product) and the managed database
// (workspace settings, plan entitlements, live member list), so a plan change is
// visible on the next poll. Nothing is cached and nothing is written back.
//
// Request path: one database call authenticates, rate-limits and logs; then the
// CRM read and the member read run together, so the whole snapshot costs two
// round trips.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE = "cwd-ced-entitlements";
const VERSION = "1.1";
const SCHEMA_VERSION = "2026-11-01";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type PlanId = "starter" | "growth" | "pro";

interface WorkspaceCtx {
  workspace_id: string;
  crm_client_id: string;
  agency_id: string;
  timezone: string;
  gst_rate: number;
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
) => json({ error: { code, message, requestId } }, status, { "X-Request-Id": requestId, ...extraHeaders });

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

/** One HTTP pipeline call for every statement, so a snapshot costs one trip. */
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
  if (!res.ok) throw new Error(`CRM database HTTP ${res.status}`);

  const data = await res.json() as {
    results: Array<{
      type: string;
      response?: { result?: { cols: Array<{ name: string }>; rows: BunnyCell[][] } };
      error?: { message: string };
    }>;
  };

  return stmts.map((_, i) => {
    const r = data.results?.[i];
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
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Route parsing must survive whatever prefix the platform forwards: the function
 * name is kept in the path, and a proxy may add /api. Everything before the
 * first route token is dropped, so the same code works whether the caller sends
 * /functions/v1/<name>/v1/..., /<name>/api/v1/... or just /v1/....
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

  /** Log an outcome the guard did not see (bad method or malformed path). */
  const logDirect = async (status: number) => {
    try {
      await db.from("workspace_api_requests").insert({
        workspace_id: segments[1] ?? null,
        route: "workspaces.entitlements",
        status,
        duration_ms: Math.round(Date.now() - startedAt),
        request_id: requestId,
      });
    } catch { /* logging must never break a response */ }
  };

  const withBody = method === "HEAD"
    ? (res: Response) => emptyResponse(res.status, Object.fromEntries(res.headers))
    : (res: Response) => res;

  if (method !== "GET" && method !== "HEAD") {
    await logDirect(405);
    return apiError(405, "method_not_allowed", "Only GET is supported", requestId);
  }

  if (segments.length === 0 || segments[0] === "health") {
    return json(
      { ok: true, service: SERVICE, version: VERSION, schemaVersion: SCHEMA_VERSION },
      200,
      { "X-Request-Id": requestId },
    );
  }

  const path = segments;
  const shapeValid = path.length === 3 &&
    path[0] === "workspaces" &&
    path[1].length > 0 &&
    path[2] === "entitlements";

  if (!shapeValid) {
    const status = path[0] === "workspaces" ? 400 : 404;
    await logDirect(status);
    return status === 400
      ? apiError(400, "invalid_request", "Expected /v1/workspaces/{workspaceId}/entitlements", requestId)
      : apiError(404, "not_found", "Unknown route", requestId);
  }

  const requestedWorkspace = path[1];
  const token = (req.headers.get("Authorization") ?? "").trim().match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!token || !token.startsWith("cwd_ent_")) {
    await logDirect(401);
    return apiError(401, "unauthorized", "Missing or invalid bearer token", requestId);
  }

  let logged = false;
  const finishStatus = (status: number) => {
    if (!logged) return;
    // Fire and forget: the request must not wait on its own log entry.
    void db
      .from("workspace_api_requests")
      .update({ status, duration_ms: Math.round(Date.now() - startedAt) })
      .eq("request_id", requestId)
      .then(() => {}, () => {});
  };

  try {
    const hash = await sha256Hex(token);
    const guard = await db.rpc("workspace_api_guard", {
      p_token_hash: hash,
      p_workspace_id: requestedWorkspace,
      p_request_id: requestId,
    });
    if (guard.error) throw new Error(guard.error.message);

    const result = guard.data as {
      outcome: string;
      retryAfter?: number;
      workspace?: WorkspaceCtx;
      entitlements?: Record<string, {
        socialStudio: boolean;
        maxChannels: number;
        whiteLabel: boolean;
        aiMonthlyCapUsd: number;
      }>;
    };

    logged = result.outcome === "ok";

    if (result.outcome === "unauthorized") {
      return apiError(401, "unauthorized", "Missing or invalid bearer token", requestId);
    }
    if (result.outcome === "not_found") {
      return apiError(404, "not_found", "Unknown workspace", requestId);
    }
    if (result.outcome === "forbidden") {
      return apiError(403, "forbidden", "This token is not allowed for this workspace", requestId);
    }
    if (result.outcome === "rate_limited") {
      return apiError(
        429,
        "rate_limited",
        "Rate limit exceeded: 30 requests per hour per workspace",
        requestId,
        { "Retry-After": String(result.retryAfter ?? 60) },
      );
    }

    const workspace = result.workspace;
    if (!workspace) throw new Error("guard returned no workspace");

    const clientSql =
      `SELECT id, name, status, billing_email, plan, gbp_connection_id
         FROM clients WHERE id = ? LIMIT 1`;
    const subscriptionSql =
      `SELECT s.status AS sub_status, s.current_period_end, s.cancel_at_period_end,
              p.name AS product_name, p.unit_amount_cents, p.price_cents, p.currency
         FROM subscriptions s JOIN products p ON p.id = s.product_id
        WHERE s.client_id = ?
        ORDER BY CASE WHEN s.status IN ('active', 'trialing') THEN 0
                      WHEN s.status = 'pending' THEN 1 ELSE 2 END,
                 datetime(COALESCE(s.updated_at, s.created_at)) DESC
        LIMIT 1`;

    const [crm, initialMembers] = await Promise.all([
      execMany([
        { sql: clientSql, args: [workspace.crm_client_id] },
        { sql: subscriptionSql, args: [workspace.crm_client_id] },
      ]),
      db.rpc("workspace_member_snapshot", {
        p_workspace_id: workspace.workspace_id,
        p_client_id: workspace.crm_client_id,
        p_connection_id: null,
      }),
    ]);

    if (initialMembers.error) throw new Error(initialMembers.error.message);

    const clientRow = crm[0]?.[0];
    if (!clientRow) return unavailable("the mapped CED client does not exist", requestId, finishStatus);
    const subscriptionRow = crm[1]?.[0];
    if (!subscriptionRow) return unavailable("the workspace has no subscription in CED", requestId, finishStatus);

    const accountStatusValue = accountStatus(text(clientRow.status));
    if (!accountStatusValue) {
      return unavailable(`client status "${text(clientRow.status)}" has no contract mapping`, requestId, finishStatus);
    }

    const planId = planKey(text(subscriptionRow.product_name), text(clientRow.plan));
    if (!planId) {
      return unavailable("the subscription's plan cannot be mapped to starter, growth or pro", requestId, finishStatus);
    }

    const subStatus = subscriptionStatus(text(subscriptionRow.sub_status));
    if (!subStatus) {
      return unavailable(`subscription status "${text(subscriptionRow.sub_status)}" has no contract mapping`, requestId, finishStatus);
    }

    const entitlement = result.entitlements?.[planId];
    if (!entitlement) return unavailable(`no entitlement row exists for plan ${planId}`, requestId, finishStatus);

    const billingEmail = text(clientRow.billing_email);
    if (!billingEmail) return unavailable("the client has no billing email", requestId, finishStatus);

    const accountName = text(clientRow.name);
    if (!accountName) return unavailable("the client has no name", requestId, finishStatus);

    const priceCents = Number(subscriptionRow.unit_amount_cents ?? 0) ||
      Number(subscriptionRow.price_cents ?? 0);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return unavailable("the plan has no readable price", requestId, finishStatus);
    }

    const periodEnd = subStatus === "trialing" || subStatus === "canceled"
      ? null
      : iso(subscriptionRow.current_period_end);
    if (subStatus !== "trialing" && subStatus !== "canceled" && !periodEnd) {
      return unavailable("the subscription has no readable current period end", requestId, finishStatus);
    }

    const currency = (text(subscriptionRow.currency) || workspace.currency || "CAD").toUpperCase();
    const gstRate = Number(workspace.gst_rate);
    if (!Number.isFinite(gstRate)) {
      return unavailable("the workspace GST rate is not a number", requestId, finishStatus);
    }

    // A client with a Google Business Profile connection also has portal users;
    // include them so the studio sees the client's own people as approvers.
    let memberSnapshot = initialMembers.data as { members?: unknown[]; missingEmail?: number } | null;
    const connectionId = text(clientRow.gbp_connection_id);
    if (connectionId) {
      const withPortal = await db.rpc("workspace_member_snapshot", {
        p_workspace_id: workspace.workspace_id,
        p_client_id: workspace.crm_client_id,
        p_connection_id: connectionId,
      });
      if (withPortal.error) throw new Error(withPortal.error.message);
      memberSnapshot = withPortal.data as typeof memberSnapshot;
    }

    const members = (memberSnapshot?.members ?? []) as Array<Record<string, unknown>>;
    if (Number(memberSnapshot?.missingEmail ?? 0) > 0) {
      return unavailable("a member who must be listed has no email address", requestId, finishStatus);
    }

    const snapshot = {
      schemaVersion: SCHEMA_VERSION,
      workspaceId: workspace.workspace_id,
      account: {
        id: `acct_${workspace.crm_client_id}`,
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
        socialStudio: Boolean(entitlement.socialStudio),
        maxChannels: Number(entitlement.maxChannels),
        whiteLabel: Boolean(entitlement.whiteLabel),
        aiMonthlyCapUsd: Number(entitlement.aiMonthlyCapUsd),
      },
      members,
    };

    const fingerprint = await sha256Hex(JSON.stringify(snapshot));
    const etag = `W/"${fingerprint.slice(0, 32)}"`;
    const headers = { ETag: etag, "X-Request-Id": requestId };

    if (etagMatches(req.headers.get("If-None-Match"), etag)) {
      finishStatus(304);
      return emptyResponse(304, headers);
    }

    return withBody(json(
      { ...snapshot, syncedAt: new Date().toISOString(), etag },
      200,
      headers,
    ));
  } catch (e) {
    console.error(`entitlements error requestId=${requestId}: ${(e as Error).message}`);
    finishStatus(500);
    return apiError(500, "internal_error", "Internal server error", requestId);
  }
});

/** A complete snapshot cannot be built: refuse rather than return partial data. */
function unavailable(
  reason: string,
  requestId: string,
  finishStatus: (status: number) => void,
): Response {
  console.error(`entitlements 503 requestId=${requestId}: ${reason}`);
  finishStatus(503);
  return apiError(503, "snapshot_unavailable", `Snapshot unavailable: ${reason}`, requestId);
}
