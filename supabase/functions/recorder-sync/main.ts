/**
 * Content Studio backend service.
 *
 * Staff actions used by the dashboard (profiles, locations, campaigns, manual
 * pushes, pull-token management) and trusted scheduler actions used by the
 * nightly reconciliation and the queue worker.
 *
 * Credentials: the recorder intake address and key come from server secrets
 * only. The pull token is generated here, stored hashed and shown once.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCrmClient } from "./lib/crm.ts";
import { isPublicHttpsUrl, suggestTrade } from "./lib/payload.ts";
import { processDueJobs, pushBundle, reconcileAll, ensureCompanyForClient, loadBundle } from "./lib/store.ts";
import type { Trade } from "./lib/types.ts";
import { TRADES } from "./lib/types.ts";
import { handlePull, pullCorsHeaders } from "./pull.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-recorder-scheduler",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const bad = (message: string): never => {
  throw new HttpError(message, 400);
};

function textValue(value: unknown, field: string, max = 500, required = false): string | null {
  if (value === null || value === undefined) {
    if (required) bad(`${field} is required.`);
    return null;
  }
  const s = String(value).trim();
  if (!s) {
    if (required) bad(`${field} is required.`);
    return null;
  }
  if (s.length > max) bad(`${field} must be ${max} characters or fewer.`);
  return s;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function colorValue(value: unknown, field: string): string | null {
  const s = textValue(value, field, 7);
  if (s === null) return null;
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) bad(`${field} must be a #RRGGBB colour.`);
  return s.toUpperCase();
}

function imageValue(value: unknown, field: string): string | null {
  const s = textValue(value, field, 2000);
  if (s === null) return null;
  if (!isPublicHttpsUrl(s)) bad(`${field} must be a public HTTPS image address.`);
  return s;
}

function websiteValue(value: unknown): string | null {
  const s = textValue(value, "website", 500);
  if (s === null) return null;
  if (!/^https?:\/\//i.test(s)) bad("website must start with http:// or https://");
  return s;
}

function tradeValue(value: unknown, fallback: Trade = "general"): Trade {
  const s = String(value ?? "").trim() as Trade;
  return TRADES.includes(s) ? s : fallback;
}

function isoValue(value: unknown, field: string): string | null {
  const s = textValue(value, field, 50);
  if (s === null) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T12:00:00.000Z`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) bad(`${field} must be an ISO date or date/time.`);
  return d.toISOString();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `cwd_pull_${b64}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface StaffContext {
  userId: string;
  isSuperAdmin: boolean;
}

async function requireStaff(req: Request): Promise<StaffContext> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError("Missing bearer token.", 401);
  if (token.split(".").length !== 3) throw new HttpError("Invalid session.", 401);

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw new HttpError("Invalid session.", 401);

  const isSuperAdmin = Boolean(ADMIN_EMAIL) && data.user.email === ADMIN_EMAIL;
  const { data: roleRow, error: roleError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .in("role", ["admin", "agency"])
    .limit(1)
    .maybeSingle();
  if (roleError) throw new HttpError("Could not verify staff access.", 500);
  if (!roleRow && !isSuperAdmin) throw new HttpError("Forbidden: staff access required.", 403);

  return { userId: data.user.id, isSuperAdmin };
}

async function isScheduler(req: Request): Promise<boolean> {
  const provided = (req.headers.get("x-recorder-scheduler") ?? "").trim();
  if (!provided) return false;
  const { data, error } = await db.from("recorder_internal").select("scheduler_secret").eq("id", 1).maybeSingle();
  if (error || !data?.scheduler_secret) return false;
  return constantTimeEqual(provided, String(data.scheduler_secret));
}

async function configState() {
  const intakeUrl = (Deno.env.get("RECORDER_INTAKE_URL") ?? "").trim();
  const intakeKey = (Deno.env.get("RECORDER_INTAKE_KEY") ?? "").trim();
  let intakeUrlValid = false;
  try {
    intakeUrlValid = new URL(intakeUrl).protocol === "https:";
  } catch { /* reported below without exposing the value */ }
  return {
    intake_url_configured: Boolean(intakeUrl),
    intake_url_valid: intakeUrlValid,
    intake_key_configured: Boolean(intakeKey),
    configured: Boolean(intakeUrlValid && intakeKey),
    pull_endpoint: `${SUPABASE_URL}/functions/v1/recorder-sync/companies`,
  };
}

async function nextStableId(): Promise<string> {
  return `net_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

async function loadCompanyDetail(companyId: string) {
  const { data: company, error } = await db.from("recorder_companies").select("*").eq("id", companyId).maybeSingle();
  if (error) throw new HttpError(error.message, 500);
  if (!company) throw new HttpError("Company not found.", 404);

  const { data: locations, error: locationError } = await db
    .from("recorder_locations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (locationError) throw new HttpError(locationError.message, 500);

  let branding: { data: Record<string, unknown> | null } = { data: null };
  if (company.crm_client_id) {
    const { data } = await db
      .from("client_brand_assets")
      .select("logo_square_url, logo_rect_url, tagline")
      .eq("crm_client_id", company.crm_client_id)
      .maybeSingle();
    branding = { data: (data ?? null) as Record<string, unknown> | null };
  }

  const locationRows = locations ?? [];
  const locationIds = locationRows.map((l) => String(l.id));
  let campaignRows: Array<Record<string, unknown>> = [];
  if (locationIds.length > 0) {
    const { data: campaigns, error: campaignError } = await db
      .from("recorder_campaigns")
      .select("*")
      .in("location_id", locationIds)
      .order("created_at", { ascending: false });
    if (campaignError) throw new HttpError(campaignError.message, 500);
    campaignRows = (campaigns ?? []) as Array<Record<string, unknown>>;
  }

  let sceneRows: Array<Record<string, unknown>> = [];
  if (campaignRows.length > 0) {
    const { data: scenes, error: sceneError } = await db
      .from("recorder_scenes")
      .select("*")
      .in("campaign_id", campaignRows.map((c) => String(c.id)))
      .order("position", { ascending: true });
    if (sceneError) throw new HttpError(sceneError.message, 500);
    sceneRows = (scenes ?? []) as Array<Record<string, unknown>>;
  }

  const scenesByCampaign = new Map<string, Array<Record<string, unknown>>>();
  for (const scene of sceneRows) {
    const id = String(scene.campaign_id);
    const list = scenesByCampaign.get(id) ?? [];
    list.push(scene);
    scenesByCampaign.set(id, list);
  }
  const campaignsByLocation = new Map<string, Array<Record<string, unknown>>>();
  for (const campaign of campaignRows) {
    const id = String(campaign.location_id);
    const list = campaignsByLocation.get(id) ?? [];
    list.push({ ...campaign, scenes: scenesByCampaign.get(String(campaign.id)) ?? [] });
    campaignsByLocation.set(id, list);
  }

  return {
    company,
    locations: locationRows.map((l) => ({ ...l, campaigns: campaignsByLocation.get(String(l.id)) ?? [] })),
    branding: branding.data ?? null,
  };
}

async function validateCompanyAssets(companyId: string) {
  const { data: company } = await db.from("recorder_companies").select("*").eq("id", companyId).maybeSingle();
  if (!company) throw new HttpError("Company not found.", 404);
  return company;
}

async function handleAction(action: string, payload: Record<string, unknown>, staff: StaffContext | null) {
  switch (action) {
    // ── Connection / overview ──────────────────────────────────────────────
    case "status": {
      const config = await configState();
      const [{ data: companies }, { data: locations }, { data: pending }, { data: recent }, { data: tokens }] = await Promise.all([
        db.from("recorder_companies").select("id, enabled"),
        db.from("recorder_locations").select("id, active"),
        db.from("recorder_push_jobs").select("id").eq("status", "pending"),
        db.from("recorder_push_log").select("*").order("created_at", { ascending: false }).limit(8),
        db.from("recorder_pull_tokens").select("id, label, token_prefix, created_at, last_used_at, revoked_at"),
      ]);
      return {
        ...config,
        companies_total: (companies ?? []).length,
        companies_enabled: (companies ?? []).filter((c) => c.enabled).length,
        locations_active: (locations ?? []).filter((l) => l.active).length,
        pending_pushes: (pending ?? []).length,
        pull_tokens: tokens ?? [],
        recent_pushes: recent ?? [],
      };
    }

    case "activity.list": {
      const companyId = textValue(payload.company_id, "company_id", 80);
      let query = db.from("recorder_push_log").select("*").order("created_at", { ascending: false }).limit(30);
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw new HttpError(error.message, 500);
      return { logs: data ?? [] };
    }

    // ── Companies ─────────────────────────────────────────────────────────
    case "company.list": {
      const [{ data: companies, error }, { data: locations }] = await Promise.all([
        db.from("recorder_companies").select("*").order("name", { ascending: true }),
        db.from("recorder_locations").select("company_id, active, last_synced_at, last_sync_status, last_sync_error, customer_url, qr_url"),
      ]);
      if (error) throw new HttpError(error.message, 500);

      const byCompany = new Map<string, Array<Record<string, unknown>>>();
      for (const location of (locations ?? []) as Array<Record<string, unknown>>) {
        const id = String(location.company_id);
        const list = byCompany.get(id) ?? [];
        list.push(location);
        byCompany.set(id, list);
      }

      return {
        companies: (companies ?? []).map((company) => {
          const companyLocations = byCompany.get(String(company.id)) ?? [];
          const active = companyLocations.filter((l) => l.active);
          const synced = active
            .map((l) => l.last_synced_at as string | null)
            .filter((v): v is string => Boolean(v))
            .sort()
            .at(-1) ?? null;
          return {
            ...company,
            location_count: active.length,
            last_synced_at: synced,
            last_sync_status: active.some((l) => l.last_sync_status === "failed")
              ? "failed"
              : active.length > 0 && active.every((l) => l.last_sync_status === "ok")
                ? "ok"
                : active.some((l) => l.last_sync_status === "ok")
                  ? "partial"
                  : null,
            last_sync_error: (active.find((l) => l.last_sync_error)?.last_sync_error as string | null) ?? null,
          };
        }),
      };
    }

    case "company.get": {
      const companyId = textValue(payload.company_id, "company_id", 80);
      const crmClientId = textValue(payload.crm_client_id, "crm_client_id", 120);
      let id = companyId;

      if (!id && crmClientId) {
        const client = await getCrmClient(crmClientId);
        if (!client) throw new HttpError("CRM client not found.", 404);
        if (client.status !== "active") throw new HttpError("Only active CRM clients are sent to the recorder.", 400);
        const company = await ensureCompanyForClient(db, client);
        id = company.id;
      }
      if (!id) bad("company_id or crm_client_id is required.");
      return await loadCompanyDetail(id!);
    }

    case "company.save": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const companyId = textValue(payload.company_id, "company_id", 80);
      const crmClientId = textValue(payload.crm_client_id, "crm_client_id", 120);
      const isNetwork = boolValue(payload.is_network, false);
      const brandColor = colorValue(payload.brand_color, "brand_color") ?? "#0078D7";
      const logoUrl = imageValue(payload.logo_url, "logo_url");
      const watermarkUrl = imageValue(payload.watermark_url, "watermark_url");

      const shared = {
        trade: tradeValue(payload.trade),
        brand_color: brandColor,
        is_network: isNetwork,
        logo_url: logoUrl,
        watermark_url: watermarkUrl,
        watermark_text: textValue(payload.watermark_text, "watermark_text", 120),
        watermark_handle: textValue(payload.watermark_handle, "watermark_handle", 120),
        credit_line: textValue(payload.credit_line, "credit_line", 200),
        default_hashtags: textValue(payload.default_hashtags, "default_hashtags", 500),
        enabled: boolValue(payload.enabled, true),
      };

      let targetId = companyId;

      if (!targetId && crmClientId) {
        const client = await getCrmClient(crmClientId);
        if (!client) throw new HttpError("CRM client not found.", 404);
        const company = await ensureCompanyForClient(db, client);
        targetId = company.id;
      }

      if (!targetId) {
        // Standalone network company (for example Victoria Food Scene).
        const name = textValue(payload.name, "name", 160, true)!;
        const { data, error } = await db
          .from("recorder_companies")
          .insert({
            stable_id: await nextStableId(),
            crm_client_id: null,
            agency_id: "citywide",
            name,
            website: websiteValue(payload.website),
            phone: textValue(payload.phone, "phone", 40),
            city: textValue(payload.city, "city", 120),
            ...shared,
          })
          .select("*")
          .maybeSingle();
        if (error) throw new HttpError(error.message, 400);
        return { company: data };
      }

      const existing = await validateCompanyAssets(targetId!);
      const patch: Record<string, unknown> = { ...shared };

      if (!existing.crm_client_id) {
        const name = textValue(payload.name, "name", 160);
        if (name) patch.name = name;
        patch.website = websiteValue(payload.website);
        patch.phone = textValue(payload.phone, "phone", 40);
        patch.city = textValue(payload.city, "city", 120);
      }

      const { data, error } = await db
        .from("recorder_companies")
        .update(patch)
        .eq("id", targetId!)
        .select("*")
        .maybeSingle();
      if (error) throw new HttpError(error.message, 400);
      return { company: data };
    }

    // ── Locations ─────────────────────────────────────────────────────────
    case "location.save": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const id = textValue(payload.id, "id", 80);
      const companyId = textValue(payload.company_id, "company_id", 80);

      const fields: Record<string, unknown> = {};
      if ("name" in payload) fields.name = textValue(payload.name, "name", 160, !id);
      if ("address" in payload) fields.address = textValue(payload.address, "address", 300);
      if ("neighbourhood" in payload) fields.neighbourhood = textValue(payload.neighbourhood, "neighbourhood", 160);
      if ("website" in payload) fields.website = websiteValue(payload.website);
      if ("phone" in payload) fields.phone = textValue(payload.phone, "phone", 40);
      if ("logo_url" in payload) fields.logo_url = imageValue(payload.logo_url, "logo_url");
      if ("brand_color" in payload) fields.brand_color = colorValue(payload.brand_color, "brand_color");
      if ("headline" in payload) fields.headline = textValue(payload.headline, "headline", 200);
      if ("enable_video" in payload) fields.enable_video = boolValue(payload.enable_video, true);
      if ("enable_photos" in payload) fields.enable_photos = boolValue(payload.enable_photos, true);
      if ("enable_wall" in payload) fields.enable_wall = boolValue(payload.enable_wall, true);
      if ("active" in payload) fields.active = boolValue(payload.active, true);

      if (id) {
        if (Object.keys(fields).length === 0) bad("Nothing to update.");
        const { data, error } = await db.from("recorder_locations").update(fields).eq("id", id).select("*").maybeSingle();
        if (error) throw new HttpError(error.message, 400);
        if (!data) throw new HttpError("Location not found.", 404);
        return { location: data };
      }

      if (!companyId) bad("company_id is required for a new location.");
      if (!fields.name) bad("name is required for a new location.");
      const { data, error } = await db
        .from("recorder_locations")
        .insert({ company_id: companyId, ...fields })
        .select("*")
        .maybeSingle();
      if (error) throw new HttpError(error.message, 400);
      return { location: data };
    }

    case "location.archive": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const id = textValue(payload.id, "id", 80, true)!;
      const { error } = await db.from("recorder_locations").update({ active: false }).eq("id", id);
      if (error) throw new HttpError(error.message, 400);
      return { ok: true };
    }

    // ── Campaigns ─────────────────────────────────────────────────────────
    case "campaign.save": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const id = textValue(payload.id, "id", 80);
      const locationId = textValue(payload.location_id, "location_id", 80, true)!;
      const label = textValue(payload.label, "label", 160, true)!;
      const format = payload.format === "promo" ? "promo" : "review";
      const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
      if (scenes.length !== 3) bad("A campaign needs exactly three scenes.");

      const sceneRows = scenes.map((scene, index) => {
        const s = (scene ?? {}) as Record<string, unknown>;
        const capture = s.capture === "photos" ? "photos" : "video";
        return {
          position: index + 1,
          key: textValue(s.key, `scenes[${index}].key`, 60) ?? `scene-${index + 1}`,
          label: textValue(s.label, `scenes[${index}].label`, 120, true)!,
          prompt: textValue(s.prompt, `scenes[${index}].prompt`, 800, true)!,
          hint: textValue(s.hint, `scenes[${index}].hint`, 400),
          capture,
        };
      });

      if (format === "promo") {
        if (!textValue(payload.dish_name, "dish_name", 160)) bad("A promo campaign needs a dish name.");
        if (!textValue(payload.concept, "concept", 800)) bad("A promo campaign needs a concept.");
      }

      const record = {
        location_id: locationId,
        label,
        headline: textValue(payload.headline, "headline", 200),
        format,
        due_at: isoValue(payload.due_at, "due_at"),
        dish_name: textValue(payload.dish_name, "dish_name", 160),
        concept: textValue(payload.concept, "concept", 800),
        // Promo offers must enable video; the recorder enforces this too.
        enable_video: format === "promo" ? true : boolValue(payload.enable_video, true),
        enable_photos: boolValue(payload.enable_photos, false),
        active: boolValue(payload.active, true),
      };

      let campaignId = id;
      if (campaignId) {
        const { error } = await db.from("recorder_campaigns").update(record).eq("id", campaignId);
        if (error) throw new HttpError(error.message, 400);
        const { error: deleteError } = await db.from("recorder_scenes").delete().eq("campaign_id", campaignId);
        if (deleteError) throw new HttpError(deleteError.message, 400);
      } else {
        const { data, error } = await db.from("recorder_campaigns").insert(record).select("id").maybeSingle();
        if (error || !data) throw new HttpError(error?.message ?? "Could not create the campaign.", 400);
        campaignId = String(data.id);
      }

      const { error: sceneError } = await db
        .from("recorder_scenes")
        .insert(sceneRows.map((scene) => ({ ...scene, campaign_id: campaignId })));
      if (sceneError) throw new HttpError(sceneError.message, 400);

      return await loadCompanyDetail(
        String((await db.from("recorder_locations").select("company_id").eq("id", locationId).maybeSingle()).data?.company_id ?? ""),
      );
    }

    case "campaign.archive": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const id = textValue(payload.id, "id", 80, true)!;
      const { error } = await db.from("recorder_campaigns").update({ active: false }).eq("id", id);
      if (error) throw new HttpError(error.message, 400);
      return { ok: true };
    }

    // ── Push ──────────────────────────────────────────────────────────────
    case "push.now": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const companyId = textValue(payload.company_id, "company_id", 80, true)!;
      const locationId = textValue(payload.location_id, "location_id", 80);
      const config = await configState();
      if (!config.configured) throw new HttpError("The recorder intake address and key are not configured yet.", 409);

      const { data: locations, error } = await db
        .from("recorder_locations")
        .select("id")
        .eq("company_id", companyId)
        .eq("active", true);
      if (error) throw new HttpError(error.message, 500);

      const targets = locationId ? [locationId] : (locations ?? []).map((l) => String(l.id));
      if (targets.length === 0) bad("This company has no active locations to push.");

      const results = [];
      for (const target of targets) {
        const bundle = await loadBundle(db, companyId, target);
        if (!bundle) continue;
        const result = await pushBundle(db, bundle);
        if (result.ok) {
          await db.from("recorder_push_jobs").delete().eq("location_id", target).eq("status", "pending");
        }
        results.push({
          location_id: target,
          location_name: bundle.location.name,
          ok: result.ok,
          error: result.error,
          status_code: result.status,
          slug: result.body?.locationSlug ?? null,
          links: result.body?.links ?? null,
          campaigns: result.body?.campaigns ?? 0,
        });
      }

      return {
        ok: results.every((r) => r.ok),
        pushed: results.filter((r) => r.ok).length,
        results,
        company: await loadCompanyDetail(companyId),
      };
    }

    case "push.all": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const config = await configState();
      if (!config.configured) throw new HttpError("The recorder intake address and key are not configured yet.", 409);
      return await reconcileAll(db);
    }

    case "process_queue": {
      const result = await processDueJobs(db, 15);
      return { ok: true, ...result };
    }

    case "reconcile": {
      const config = await configState();
      if (!config.configured) {
        return { ok: false, skipped: true, error: "The recorder intake address and key are not configured." };
      }
      const result = await reconcileAll(db);
      return { ok: true, ...result };
    }

    // ── Pull tokens ───────────────────────────────────────────────────────
    case "tokens.list": {
      const { data, error } = await db
        .from("recorder_pull_tokens")
        .select("id, label, token_prefix, created_by, created_at, last_used_at, revoked_at")
        .order("created_at", { ascending: false });
      if (error) throw new HttpError(error.message, 500);
      return { tokens: data ?? [] };
    }

    case "tokens.create": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const label = textValue(payload.label, "label", 80) ?? "Recorder pull";
      const token = randomToken();
      const { data, error } = await db
        .from("recorder_pull_tokens")
        .insert({
          label,
          token_prefix: token.slice(0, 16),
          token_hash: await sha256Hex(token),
          created_by: staff.userId,
        })
        .select("id, label, token_prefix, created_at")
        .maybeSingle();
      if (error) throw new HttpError(error.message, 400);
      // The plaintext is returned exactly once; only the hash is stored.
      return { token, pull_token: data };
    }

    case "tokens.revoke": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const id = textValue(payload.id, "id", 80, true)!;
      const { error } = await db.from("recorder_pull_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new HttpError(error.message, 400);
      return { ok: true };
    }

    case "tokens.rotate": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const label = textValue(payload.label, "label", 80) ?? "Recorder pull";
      await db.from("recorder_pull_tokens").update({ revoked_at: new Date().toISOString() }).is("revoked_at", null);
      const token = randomToken();
      const { data, error } = await db
        .from("recorder_pull_tokens")
        .insert({
          label,
          token_prefix: token.slice(0, 16),
          token_hash: await sha256Hex(token),
          created_by: staff.userId,
        })
        .select("id, label, token_prefix, created_at")
        .maybeSingle();
      if (error) throw new HttpError(error.message, 400);
      return { token, pull_token: data };
    }

    // ── Assets ────────────────────────────────────────────────────────────
    case "asset.uploadUrl": {
      if (!staff) throw new HttpError("Forbidden.", 403);
      const companyId = textValue(payload.company_id, "company_id", 80, true)!;
      const locationId = textValue(payload.location_id, "location_id", 80);
      const kind = payload.kind === "watermark" ? "watermark" : "logo";
      const filename = textValue(payload.filename, "filename", 160) ?? "asset.png";
      const safeName = filename.replace(/[^\w.-]+/g, "_") || "asset.png";

      const { data: company, error } = await db
        .from("recorder_companies")
        .select("id, stable_id")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw new HttpError(error.message, 500);
      if (!company) throw new HttpError("Company not found.", 404);

      if (locationId) {
        const { data: location } = await db
          .from("recorder_locations")
          .select("id")
          .eq("id", locationId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (!location) throw new HttpError("Location not found for this company.", 404);
      }

      try {
        await db.storage.createBucket("brand-assets", { public: true });
      } catch { /* already exists */ }

      const storagePath = `recorder/${String(company.stable_id)}/${locationId ?? "company"}/${kind}/${crypto.randomUUID()}/${safeName}`;
      const { data: signed, error: signError } = await db.storage.from("brand-assets").createSignedUploadUrl(storagePath);
      if (signError || !signed) throw new HttpError(signError?.message ?? "Could not create an upload address.", 500);

      return {
        upload_url: signed.signedUrl,
        token: signed.token,
        storage_path: storagePath,
        public_url: `${SUPABASE_URL}/storage/v1/object/public/brand-assets/${storagePath}`,
      };
    }

    default:
      throw new HttpError(`Unknown action: ${action}`, 404);
  }
}

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();
  // The pull contract is a public, read-only GET guarded by its own token.
  if (method === "GET" || method === "HEAD" || (method === "OPTIONS" && !req.headers.get("x-recorder-scheduler"))) {
    if (method === "OPTIONS") return new Response("ok", { headers: pullCorsHeaders });
    return await handlePull(req);
  }
  if (method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (method !== "POST") return json({ error: "Only POST is supported." }, 405);

  try {
    // The scheduler authenticates with a header secret instead of a user session.
    const scheduler = await isScheduler(req);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Request body must be JSON." }, 400);
    }

    const action = String(body.action ?? "").trim();
    if (!action) return json({ error: "action is required." }, 400);
    const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;

    if (scheduler) {
      if (!["process_queue", "reconcile", "status"].includes(action)) {
        return json({ error: "This scheduler credential cannot run that action." }, 403);
      }
      return json(await handleAction(action, payload, null));
    }

    const staff = await requireStaff(req);
    return json(await handleAction(action, payload, staff));
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("recorder-sync error:", message);
    return json({ error: "Unexpected server error." }, 500);
  }
});
