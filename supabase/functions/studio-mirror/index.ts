// CityWide Social Studio — entitlement mirror sync.
//
// Pulls the read-only snapshot CED publishes and stores the studio's local copy.
// CED stays the source of truth: this function only ever reads it, validates the
// contract and replaces the mirrored snapshot as a whole. A response that fails
// validation never overwrites the last good copy.
//
// Actions (POST JSON):
//   { action: "status" }                          → mirror, last run, configuration state
//   { action: "sync", workspace_id }              → sync one workspace
//   { action: "syncAll" }                         → sync every enabled target
//
// Authorization: a CED staff session (super admin, admin, agency or agency
// staff) verified inside this function, or a scheduler credential sent in
// `x-studio-scheduler` for unattended polling. The gateway JWT check is off so
// the scheduler path can reach the function; both paths are authorised here.
//
// Configuration (backend secrets, never in code):
//   CED_API_TOKEN   workspace token issued in CED (required)
//   CED_BASE_URL    base URL of the CED publisher (optional; defaults to this
//                   project's own CED endpoint)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SCHEMA_MAJOR = "2026-";
const DEFAULT_CED_BASE = `${SUPABASE_URL}/functions/v1/studio-entitlements`;
const STAFF_ROLES = new Set(["super_admin", "admin", "agency", "agency_staff"]);
const PLAN_IDS = new Set(["starter", "growth", "pro"]);
const ACCOUNT_STATUSES = new Set(["active", "suspended", "closed"]);
const SUBSCRIPTION_STATUSES = new Set(["trialing", "active", "past_due", "paused", "canceled"]);
const MEMBER_ROLES = new Set(["owner", "approver", "viewer"]);
const MEMBER_STATUSES = new Set(["active", "invited", "disabled"]);

const CED_TOKEN = (Deno.env.get("CED_API_TOKEN") ?? "").trim();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-studio-scheduler",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function cedBase(): string {
  const configured = (Deno.env.get("CED_BASE_URL") ?? "").trim();
  return (configured || DEFAULT_CED_BASE).replace(/\/+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Contract validation ─────────────────────────────────────────────────────

interface MirrorRow {
  workspace_id: string;
  schema_version: string;
  account_id: string;
  account_name: string;
  account_status: string;
  billing_email: string;
  timezone: string;
  currency: string;
  plan_id: string;
  plan_name: string;
  subscription_status: string;
  price_cad: number;
  gst_rate: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  social_studio: boolean;
  max_channels: number;
  white_label: boolean;
  ai_monthly_cap_usd: number;
  members: Array<Record<string, string>>;
  etag: string;
  source_synced_at: string;
}

/**
 * Validates a full snapshot against the published contract and maps it onto the
 * mirror row. Returns every problem instead of guessing: the studio must never
 * mirror a partial or malformed snapshot.
 */
function validateSnapshot(
  payload: unknown,
  workspaceId: string,
): { errors: string[]; row?: MirrorRow } {
  const errors: string[] = [];
  if (!isRecord(payload)) return { errors: ["response is not a JSON object"] };

  if (typeof payload.schemaVersion !== "string" || !payload.schemaVersion.startsWith(SCHEMA_MAJOR)) {
    errors.push("schemaVersion is missing or not a supported 2026- major");
  }
  if (payload.workspaceId !== workspaceId) errors.push("workspaceId does not match the requested workspace");

  const account = isRecord(payload.account) ? payload.account : null;
  const subscription = isRecord(payload.subscription) ? payload.subscription : null;
  const entitlements = isRecord(payload.entitlements) ? payload.entitlements : null;

  if (!account) errors.push("account is missing");
  if (!subscription) errors.push("subscription is missing");
  if (!entitlements) errors.push("entitlements is missing");

  const accountStatus = account ? String(account.status ?? "") : "";
  const planId = subscription ? String(subscription.planId ?? "") : "";
  const subStatus = subscription ? String(subscription.status ?? "") : "";
  const priceCad = subscription ? Number(subscription.priceCad) : NaN;
  const gstRate = subscription ? Number(subscription.gstRate) : NaN;
  const maxChannels = entitlements ? Number(entitlements.maxChannels) : NaN;
  const aiCap = entitlements ? Number(entitlements.aiMonthlyCapUsd) : NaN;

  if (account) {
    for (const key of ["id", "name", "billingEmail", "timezone", "currency"] as const) {
      if (typeof account[key] !== "string" || !String(account[key]).trim()) {
        errors.push(`account.${key} is missing`);
      }
    }
    if (!ACCOUNT_STATUSES.has(accountStatus)) errors.push(`account.status "${accountStatus}" is not one of active, suspended, closed`);
  }

  if (subscription) {
    if (!PLAN_IDS.has(planId)) errors.push(`subscription.planId "${planId}" is not one of starter, growth, pro`);
    if (!SUBSCRIPTION_STATUSES.has(subStatus)) errors.push(`subscription.status "${subStatus}" is not a supported status`);
    if (typeof subscription.planName !== "string" || !subscription.planName.trim()) errors.push("subscription.planName is missing");
    if (!Number.isFinite(priceCad) || priceCad < 0) errors.push("subscription.priceCad is not a number");
    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1) errors.push("subscription.gstRate is not a fraction between 0 and 1");
    if (typeof subscription.cancelAtPeriodEnd !== "boolean") errors.push("subscription.cancelAtPeriodEnd is not a boolean");
    const periodRaw = subscription.currentPeriodEnd;
    if (periodRaw !== null && isoOrNull(periodRaw) === null) errors.push("subscription.currentPeriodEnd is neither null nor an ISO timestamp");
  }

  if (entitlements) {
    if (typeof entitlements.socialStudio !== "boolean") errors.push("entitlements.socialStudio is not a boolean");
    if (!Number.isInteger(maxChannels) || maxChannels < 0 || maxChannels > 50) errors.push("entitlements.maxChannels is not an integer between 0 and 50");
    if (typeof entitlements.whiteLabel !== "boolean") errors.push("entitlements.whiteLabel is not a boolean");
    if (!Number.isFinite(aiCap) || aiCap < 0) errors.push("entitlements.aiMonthlyCapUsd is not a number");
  }

  const members = payload.members;
  const cleanMembers: Array<Record<string, string>> = [];
  if (!Array.isArray(members)) {
    errors.push("members is not an array");
  } else {
    const seen = new Set<string>();
    members.forEach((member, index) => {
      if (!isRecord(member)) {
        errors.push(`members[${index}] is not an object`);
        return;
      }
      const id = String(member.id ?? "");
      const role = String(member.role ?? "");
      const status = String(member.status ?? "");
      if (!id) errors.push(`members[${index}].id is missing`);
      if (seen.has(id)) errors.push(`members[${index}].id is duplicated`);
      seen.add(id);
      if (typeof member.name !== "string" || !member.name.trim()) errors.push(`members[${index}].name is missing`);
      if (typeof member.email !== "string" || !member.email.includes("@")) errors.push(`members[${index}].email is not an email address`);
      if (!MEMBER_ROLES.has(role)) errors.push(`members[${index}].role "${role}" is not one of owner, approver, viewer`);
      if (!MEMBER_STATUSES.has(status)) errors.push(`members[${index}].status "${status}" is not one of active, invited, disabled`);
      const updatedAt = isoOrNull(member.updatedAt);
      if (!updatedAt) errors.push(`members[${index}].updatedAt is not an ISO timestamp`);
      cleanMembers.push({
        id,
        name: String(member.name ?? ""),
        email: String(member.email ?? ""),
        role,
        status,
        updatedAt: updatedAt ?? "",
      });
    });
  }

  const etag = typeof payload.etag === "string" ? payload.etag : "";
  if (!etag) errors.push("etag is missing");
  const syncedAt = isoOrNull(payload.syncedAt);
  if (!syncedAt) errors.push("syncedAt is not an ISO timestamp");

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    row: {
      workspace_id: workspaceId,
      schema_version: String(payload.schemaVersion),
      account_id: String(account!.id),
      account_name: String(account!.name),
      account_status: accountStatus,
      billing_email: String(account!.billingEmail),
      timezone: String(account!.timezone),
      currency: String(account!.currency),
      plan_id: planId,
      plan_name: String(subscription!.planName),
      subscription_status: subStatus,
      price_cad: priceCad,
      gst_rate: gstRate,
      current_period_end: isoOrNull(subscription!.currentPeriodEnd),
      cancel_at_period_end: subscription!.cancelAtPeriodEnd === true,
      social_studio: entitlements!.socialStudio === true,
      max_channels: maxChannels,
      white_label: entitlements!.whiteLabel === true,
      ai_monthly_cap_usd: aiCap,
      members: cleanMembers,
      etag,
      source_synced_at: syncedAt!,
    },
  };
}

// ── Sync ────────────────────────────────────────────────────────────────────

interface SyncOutcome {
  workspace_id: string;
  status: "ok" | "not_modified" | "error";
  http_status: number | null;
  duration_ms: number;
  message: string | null;
  etag: string | null;
}

async function recordRun(outcome: SyncOutcome): Promise<void> {
  try {
    await db.from("studio_sync_runs").insert({
      workspace_id: outcome.workspace_id,
      status: outcome.status,
      http_status: outcome.http_status,
      duration_ms: outcome.duration_ms,
      etag: outcome.etag,
      message: outcome.message,
    });
  } catch (e) {
    console.error(`studio sync log failed: ${(e as Error).message}`);
  }
}

function cedErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.error)) return null;
  const message = payload.error.message;
  return typeof message === "string" ? message.slice(0, 300) : null;
}

async function syncWorkspace(workspaceId: string): Promise<SyncOutcome> {
  const started = Date.now();
  const base = { workspace_id: workspaceId, http_status: null as number | null, etag: null as string | null };

  if (!CED_TOKEN) {
    const outcome: SyncOutcome = {
      ...base,
      status: "error",
      duration_ms: 0,
      message: "CED_API_TOKEN is not configured, so CED cannot be read",
    };
    await recordRun(outcome);
    return outcome;
  }

  const { data: existing } = await db
    .from("studio_workspace_mirror")
    .select("etag")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const knownEtag = existing?.etag ? String(existing.etag) : "";

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${CED_TOKEN}`,
    "Accept": "application/json",
  };
  if (knownEtag) headers["If-None-Match"] = knownEtag;

  let response: Response;
  try {
    response = await fetch(`${cedBase()}/v1/workspaces/${encodeURIComponent(workspaceId)}/entitlements`, { headers });
  } catch (e) {
    const outcome: SyncOutcome = {
      ...base,
      status: "error",
      duration_ms: Date.now() - started,
      message: `CED could not be reached: ${(e as Error).message}`,
    };
    await recordRun(outcome);
    return outcome;
  }

  const duration = Date.now() - started;

  if (response.status === 304) {
    const outcome: SyncOutcome = {
      ...base,
      status: "not_modified",
      http_status: 304,
      duration_ms: duration,
      etag: knownEtag || null,
      message: "CED reports no change",
    };
    await db
      .from("studio_workspace_mirror")
      .update({ mirrored_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId);
    await recordRun(outcome);
    return outcome;
  }

  const raw = await response.text();
  let payload: unknown = null;
  try { payload = JSON.parse(raw); } catch { /* handled below */ }

  if (!response.ok) {
    const message = cedErrorMessage(payload) ?? `CED returned ${response.status}`;
    const outcome: SyncOutcome = {
      ...base,
      status: "error",
      http_status: response.status,
      duration_ms: duration,
      message,
    };
    console.error(`studio sync rejected by CED (${response.status}): ${message}`);
    await recordRun(outcome);
    return outcome;
  }

  const { errors, row } = validateSnapshot(payload, workspaceId);
  if (!row) {
    const outcome: SyncOutcome = {
      ...base,
      status: "error",
      http_status: response.status,
      duration_ms: duration,
      message: `Snapshot rejected: ${errors.slice(0, 5).join("; ")}`,
    };
    console.error(`studio sync rejected snapshot: ${errors.slice(0, 5).join("; ")}`);
    await recordRun(outcome);
    return outcome;
  }

  const now = new Date().toISOString();
  const { error } = await db.from("studio_workspace_mirror").upsert(
    { ...row, mirrored_at: now, updated_at: now },
    { onConflict: "workspace_id" },
  );
  if (error) {
    const outcome: SyncOutcome = {
      ...base,
      status: "error",
      http_status: response.status,
      duration_ms: duration,
      message: `Could not store the snapshot: ${error.message}`,
    };
    await recordRun(outcome);
    return outcome;
  }

  const outcome: SyncOutcome = {
    ...base,
    status: "ok",
    http_status: 200,
    duration_ms: duration,
    etag: row.etag,
    message: null,
  };
  await recordRun(outcome);
  return outcome;
}

// ── Status ──────────────────────────────────────────────────────────────────

async function loadStatus(workspaceId: string | null) {
  const { data: targets, error: targetError } = await db
    .from("studio_mirror_targets")
    .select("workspace_id, label, enabled")
    .order("workspace_id", { ascending: true });
  if (targetError) throw new Error(targetError.message);

  const selected = workspaceId ?? targets?.[0]?.workspace_id ?? null;

  let mirror = null;
  if (selected) {
    const { data, error } = await db
      .from("studio_workspace_mirror")
      .select("*")
      .eq("workspace_id", selected)
      .maybeSingle();
    if (error) throw new Error(error.message);
    mirror = data;
  }

  let lastRun = null;
  if (selected) {
    const { data, error } = await db
      .from("studio_sync_runs")
      .select("id, status, http_status, duration_ms, message, created_at")
      .eq("workspace_id", selected)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    lastRun = data?.[0] ?? null;
  }

  return {
    workspaces: targets ?? [],
    workspace_id: selected,
    mirror,
    last_run: lastRun,
    configuration: {
      ced_token_configured: CED_TOKEN.length > 0,
      ced_base_url: cedBase(),
      schema_major: SCHEMA_MAJOR,
    },
  };
}

// ── Server ──────────────────────────────────────────────────────────────────

async function schedulerAllowed(req: Request): Promise<boolean> {
  const provided = (req.headers.get("x-studio-scheduler") ?? "").trim();
  if (!provided) return false;
  const { data } = await db.from("studio_internal").select("scheduler_secret_hash").eq("id", 1).maybeSingle();
  const expected = data?.scheduler_secret_hash ? String(data.scheduler_secret_hash) : "";
  if (!expected) return false;
  return (await sha256Hex(provided)) === expected;
}

async function staffAllowed(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return false;
  const { data: roles, error: roleError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  if (roleError) return false;
  return (roles ?? []).some((r) => STAFF_ROLES.has(String(r.role)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Only POST is supported" }, 405);

  try {
    const authorised = (await schedulerAllowed(req)) || (await staffAllowed(req));
    if (!authorised) return json({ error: "Forbidden: CED staff session or scheduler credential required" }, 403);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "status");
    const requested = typeof body.workspace_id === "string" ? body.workspace_id.trim() : "";

    if (action === "status") {
      const status = await loadStatus(requested || null);
      return json({ ok: true, ...status });
    }

    if (action === "sync") {
      if (!requested) return json({ error: "workspace_id is required" }, 400);
      const { data: target, error } = await db
        .from("studio_mirror_targets")
        .select("workspace_id, enabled")
        .eq("workspace_id", requested)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!target) return json({ error: "Unknown mirror target" }, 404);
      if (!target.enabled) return json({ error: "This mirror target is disabled" }, 400);

      const outcome = await syncWorkspace(requested);
      const status = await loadStatus(requested);
      return json({
        ok: outcome.status !== "error",
        outcome,
        ...status,
      });
    }

    if (action === "syncAll") {
      const { data: targets, error } = await db
        .from("studio_mirror_targets")
        .select("workspace_id")
        .eq("enabled", true);
      if (error) return json({ error: error.message }, 500);

      const outcomes: SyncOutcome[] = [];
      for (const target of targets ?? []) {
        outcomes.push(await syncWorkspace(String(target.workspace_id)));
      }
      const status = await loadStatus(requested || null);
      return json({
        ok: outcomes.every((o) => o.status !== "error"),
        outcomes,
        ...status,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error(`studio mirror error: ${(e as Error).message}`);
    return json({ error: "Internal server error" }, 500);
  }
});
