/**
 * Persistence and orchestration for the recorder integration.
 *
 * Everything here runs server-side with the service role: reading CWD company
 * profiles, resolving the CRM company record, mapping one company-location
 * bundle, POSTing it to the recorder and recording the outcome. The pull
 * endpoint reuses the same bundle loader so both directions always match.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRecorderCompany, suggestTrade, validateRecorderCompany } from "./payload.ts";
import { pushRecorderCompany } from "./push.ts";
import type {
  BrandingHints,
  CampaignBundle,
  CampaignRecord,
  CompanyBundle,
  CompanyRecord,
  LocationRecord,
  RecorderPushResult,
  SceneRecord,
} from "./types.ts";
import { getCrmClient, listActiveClients, type CrmClientRow } from "./crm.ts";

type DB = SupabaseClient;

const TRUNCATE = 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function truncate(value: string, max = TRUNCATE): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function requireData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`${context}: ${error.message}`);
  if (data === null) throw new Error(`${context}: no data returned`);
  return data;
}

/** Apply the CRM company record (the source of truth for linked companies). */
function withClient(company: CompanyRecord, client: CrmClientRow): CompanyRecord {
  return {
    ...company,
    name: client.name || company.name,
    website: client.website ?? company.website,
    phone: client.phone ?? company.phone,
    city: client.city ?? company.city,
  };
}

function isActiveClient(client: CrmClientRow | null): boolean {
  return Boolean(client && client.status === "active");
}

async function brandingFor(db: DB, crmClientId: string | null): Promise<BrandingHints> {
  if (!crmClientId) return {};
  const { data } = await db
    .from("client_brand_assets")
    .select("logo_square_url, logo_rect_url, tagline")
    .eq("crm_client_id", crmClientId)
    .maybeSingle();
  if (!data) return {};
  const row = data as { logo_square_url?: string | null; logo_rect_url?: string | null; tagline?: string | null };
  return {
    logo_url: row.logo_square_url ?? row.logo_rect_url ?? null,
    tagline: row.tagline ?? null,
  };
}

function rowToCompany(row: Record<string, unknown>): CompanyRecord {
  return row as unknown as CompanyRecord;
}

function rowToLocation(row: Record<string, unknown>): LocationRecord {
  return row as unknown as LocationRecord;
}

export async function getCompanyById(db: DB, id: string): Promise<CompanyRecord | null> {
  const { data, error } = await db.from("recorder_companies").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Load company: ${error.message}`);
  return data ? rowToCompany(data as Record<string, unknown>) : null;
}

export async function getCompanyByCrmId(db: DB, crmClientId: string): Promise<CompanyRecord | null> {
  const { data, error } = await db
    .from("recorder_companies")
    .select("*")
    .eq("crm_client_id", crmClientId)
    .maybeSingle();
  if (error) throw new Error(`Load company: ${error.message}`);
  return data ? rowToCompany(data as Record<string, unknown>) : null;
}

/**
 * Create the Content Studio profile for a CRM client if it does not exist,
 * refresh its CRM-owned fields, and give it one location. Stable ids never
 * change: the company id is the CRM client id.
 */
export async function ensureCompanyForClient(db: DB, client: CrmClientRow): Promise<CompanyRecord> {
  const branding = await brandingFor(db, client.id);
  const existing = await getCompanyByCrmId(db, client.id);

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (client.name && existing.name !== client.name) patch.name = client.name;
    if ((client.website ?? null) !== existing.website) patch.website = client.website;
    if ((client.phone ?? null) !== existing.phone) patch.phone = client.phone;
    if ((client.city ?? null) !== existing.city) patch.city = client.city;
    if (branding.logo_url && !existing.logo_url && !existing.is_network) patch.logo_url = branding.logo_url;

    let company = existing;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await db
        .from("recorder_companies")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`Update company: ${error.message}`);
      if (data) company = rowToCompany(data as Record<string, unknown>);
    }
    await ensureDefaultLocation(db, company, client, branding);
    return company;
  }

  const { data, error } = await db
    .from("recorder_companies")
    .insert({
      stable_id: client.id,
      crm_client_id: client.id,
      agency_id: client.agency_id ?? "citywide",
      name: client.name,
      trade: suggestTrade(client.industry),
      website: client.website,
      phone: client.phone,
      city: client.city,
      logo_url: branding.logo_url ?? null,
      is_network: false,
      enabled: true,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Create company: ${error.message}`);
  const company = rowToCompany(requireData(data as Record<string, unknown> | null, null, "Create company"));
  await ensureDefaultLocation(db, company, client, branding);
  return company;
}

async function ensureDefaultLocation(
  db: DB,
  company: CompanyRecord,
  client: CrmClientRow,
  branding: BrandingHints,
): Promise<void> {
  const { data: locations, error } = await db
    .from("recorder_locations")
    .select("id")
    .eq("company_id", company.id)
    .eq("active", true)
    .limit(1);
  if (error) throw new Error(`Load locations: ${error.message}`);
  if (locations && locations.length > 0) return;

  const { error: insertError } = await db.from("recorder_locations").insert({
    company_id: company.id,
    agency_id: company.agency_id,
    name: client.name,
    address: client.address_line1,
    neighbourhood: client.city,
    website: client.website,
    phone: client.phone,
    headline: branding.tagline ?? null,
    enable_video: true,
    enable_photos: true,
    enable_wall: true,
    active: true,
  });
  if (insertError) throw new Error(`Create location: ${insertError.message}`);
}

async function campaignsFor(db: DB, locationIds: string[]): Promise<Map<string, CampaignBundle[]>> {
  const out = new Map<string, CampaignBundle[]>();
  if (locationIds.length === 0) return out;

  const { data: campaigns, error } = await db
    .from("recorder_campaigns")
    .select("*")
    .in("location_id", locationIds)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Load campaigns: ${error.message}`);
  const rows = (campaigns ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return out;

  const { data: scenes, error: sceneError } = await db
    .from("recorder_scenes")
    .select("*")
    .in("campaign_id", rows.map((r) => String(r.id)))
    .order("position", { ascending: true });
  if (sceneError) throw new Error(`Load scenes: ${sceneError.message}`);

  const byCampaign = new Map<string, SceneRecord[]>();
  for (const scene of (scenes ?? []) as Array<Record<string, unknown>>) {
    const id = String(scene.campaign_id);
    const list = byCampaign.get(id) ?? [];
    list.push(scene as unknown as SceneRecord);
    byCampaign.set(id, list);
  }

  for (const row of rows) {
    const locationId = String(row.location_id);
    const list = out.get(locationId) ?? [];
    list.push({
      campaign: row as unknown as CampaignRecord,
      scenes: byCampaign.get(String(row.id)) ?? [],
    });
    out.set(locationId, list);
  }
  return out;
}

/** One company-location bundle with its active campaigns and branding. */
export async function loadBundle(db: DB, companyId: string, locationId: string): Promise<CompanyBundle | null> {
  const company = await getCompanyById(db, companyId);
  if (!company) return null;

  const { data: locationRow, error } = await db
    .from("recorder_locations")
    .select("*")
    .eq("id", locationId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(`Load location: ${error.message}`);
  if (!locationRow) return null;

  let resolvedCompany = company;
  if (company.crm_client_id) {
    const client = await getCrmClient(company.crm_client_id);
    if (!isActiveClient(client)) return null;
    resolvedCompany = withClient(company, client!);
  }

  const campaigns = await campaignsFor(db, [locationId]);
  const branding = await brandingFor(db, company.crm_client_id);
  return {
    company: resolvedCompany,
    location: rowToLocation(locationRow as Record<string, unknown>),
    campaigns: campaigns.get(locationId) ?? [],
    branding,
  };
}

/** Every active company-location pair, used by the pull endpoint. */
export async function loadAllBundles(db: DB): Promise<Array<CompanyBundle | null>> {
  const { data: companyRows, error } = await db
    .from("recorder_companies")
    .select("*")
    .eq("enabled", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`Load companies: ${error.message}`);
  const companies = ((companyRows ?? []) as Array<Record<string, unknown>>).map(rowToCompany);
  if (companies.length === 0) return [];

  const { data: locationRows, error: locationError } = await db
    .from("recorder_locations")
    .select("*")
    .in("company_id", companies.map((c) => c.id))
    .eq("active", true)
    .order("name", { ascending: true });
  if (locationError) throw new Error(`Load locations: ${locationError.message}`);
  const locations = ((locationRows ?? []) as Array<Record<string, unknown>>).map(rowToLocation);
  if (locations.length === 0) return [];

  const campaigns = await campaignsFor(db, locations.map((l) => l.id));

  // Branding for every linked client in one query.
  const crmIds = companies.map((c) => c.crm_client_id).filter((id): id is string => Boolean(id));
  const brandingByCrm = new Map<string, BrandingHints>();
  if (crmIds.length > 0) {
    const { data: brandRows } = await db
      .from("client_brand_assets")
      .select("crm_client_id, logo_square_url, logo_rect_url, tagline")
      .in("crm_client_id", crmIds);
    for (const row of (brandRows ?? []) as Array<Record<string, unknown>>) {
      brandingByCrm.set(String(row.crm_client_id), {
        logo_url: (row.logo_square_url as string | null) ?? (row.logo_rect_url as string | null) ?? null,
        tagline: (row.tagline as string | null) ?? null,
      });
    }
  }

  // Active CRM clients are required for linked companies; standalone networks
  // are included as long as they are enabled.
  const activeClients = new Map((await listActiveClients()).map((c) => [c.id, c]));

  const byCompany = new Map<string, LocationRecord[]>();
  for (const location of locations) {
    const list = byCompany.get(location.company_id) ?? [];
    list.push(location);
    byCompany.set(location.company_id, list);
  }

  const bundles: Array<CompanyBundle | null> = [];
  for (const company of companies) {
    const companyLocations = byCompany.get(company.id) ?? [];
    if (companyLocations.length === 0) continue;
    const client = company.crm_client_id ? activeClients.get(company.crm_client_id) ?? null : null;
    if (company.crm_client_id && !client) continue;
    const resolvedCompany = client ? withClient(company, client) : company;
    for (const location of companyLocations) {
      bundles.push({
        company: resolvedCompany,
        location,
        campaigns: campaigns.get(location.id) ?? [],
        branding: company.crm_client_id ? brandingByCrm.get(company.crm_client_id) ?? {} : {},
      });
    }
  }
  return bundles;
}

/** Push one bundle and persist the outcome on the location plus the audit log. */
export async function pushBundle(db: DB, bundle: CompanyBundle): Promise<RecorderPushResult> {
  const intakeUrl = (Deno.env.get("RECORDER_INTAKE_URL") ?? "").trim();
  const intakeKey = (Deno.env.get("RECORDER_INTAKE_KEY") ?? "").trim();

  const payload = buildRecorderCompany(bundle);
  let result: RecorderPushResult;

  if (!intakeUrl || !intakeKey) {
    result = {
      ok: false,
      status: null,
      body: null,
      raw: "",
      error: "The recorder intake address and key are not configured.",
      attempts: 0,
      durationMs: 0,
      permanent: false,
    };
  } else {
    const issues = validateRecorderCompany(payload);
    if (issues.length > 0) {
      result = {
        ok: false,
        status: null,
        body: null,
        raw: "",
        error: truncate(`CWD data is incomplete: ${issues.map((i) => `${i.field} — ${i.message}`).join(" ")}`),
        attempts: 0,
        durationMs: 0,
        permanent: true,
      };
    } else {
      result = await pushRecorderCompany(payload, { intakeUrl, intakeKey });
    }
  }

  const body = result.body;
  const links = body?.links;
  let recorderOrigin: string | null = null;
  try {
    recorderOrigin = new URL(intakeUrl).origin;
  } catch { /* validated before the request; ignore malformed leftovers */ }
  const customerUrl = links?.url
    ?? (links?.path && recorderOrigin ? new URL(links.path, recorderOrigin).toString() : bundle.location.customer_url);

  const syncPatch: Record<string, unknown> = result.ok
    ? {
        location_slug: body?.locationSlug ?? bundle.location.location_slug,
        customer_url: customerUrl,
        qr_url: links?.qr ?? bundle.location.qr_url,
        embed_path: links?.embedPath ?? bundle.location.embed_path,
        campaign_code: body?.campaignCode ?? bundle.location.campaign_code,
        campaigns_sent: body?.campaigns ?? bundle.campaigns.length,
        last_synced_at: nowIso(),
        last_sync_status: "ok",
        last_sync_error: null,
      }
    : {
        last_sync_status: "failed",
        last_sync_error: truncate(result.error ?? "Push failed."),
      };

  await db.from("recorder_locations").update(syncPatch).eq("id", bundle.location.id);

  await db.from("recorder_push_log").insert({
    company_id: bundle.company.id,
    location_id: bundle.location.id,
    crm_client_id: bundle.company.crm_client_id,
    stable_id: bundle.company.stable_id,
    location_slug: body?.locationSlug ?? null,
    ok: result.ok,
    status_code: result.status,
    attempts: result.attempts,
    duration_ms: result.durationMs,
    error: result.error ? truncate(result.error) : null,
    response: body ?? null,
  });

  return result;
}

export async function enqueueLocation(db: DB, locationId: string, reason = "change"): Promise<void> {
  const { error } = await db.rpc("recorder_enqueue_location", { p_location_id: locationId, p_reason: reason });
  if (error) throw new Error(`Queue location push: ${error.message}`);
}

export async function enqueueCompany(db: DB, companyId: string, reason = "change"): Promise<void> {
  const { error } = await db.rpc("recorder_enqueue_company", { p_company_id: companyId, p_reason: reason });
  if (error) throw new Error(`Queue company push: ${error.message}`);
}

export async function enqueueClient(db: DB, crmClientId: string, reason = "crm"): Promise<void> {
  const { error } = await db.rpc("recorder_enqueue_client", { p_crm_client_id: crmClientId, p_reason: reason });
  if (error) throw new Error(`Queue client push: ${error.message}`);
}

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 20 * 60_000, 60 * 60_000];

async function completeJob(db: DB, id: string, status: "done" | "failed", error?: string): Promise<void> {
  await db
    .from("recorder_push_jobs")
    .update({ status, last_error: error ? truncate(error) : null, updated_at: nowIso() })
    .eq("id", id);
}

async function retryJob(db: DB, id: string, attempts: number, error: string): Promise<void> {
  const wait = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
  const { error: updateError } = await db
    .from("recorder_push_jobs")
    .update({
      status: "pending",
      attempts,
      next_attempt_at: new Date(Date.now() + wait).toISOString(),
      last_error: truncate(error),
      updated_at: nowIso(),
    })
    .eq("id", id);
  // A newer pending job for the same target may already exist; that job will
  // carry the change, so this attempt can stop without losing the update.
  if (updateError) await completeJob(db, id, "done", error);
}

interface JobResult {
  ok: boolean;
  permanentFailure: boolean;
  error: string | null;
  pushed: number;
}

async function runJob(db: DB, job: Record<string, unknown>): Promise<JobResult> {
  let company = job.company_id ? await getCompanyById(db, String(job.company_id)) : null;

  if (!company && job.crm_client_id) {
    const client = await getCrmClient(String(job.crm_client_id));
    if (!isActiveClient(client)) {
      return { ok: true, permanentFailure: false, error: null, pushed: 0 };
    }
    company = await ensureCompanyForClient(db, client!);
  }
  if (!company || !company.enabled) return { ok: true, permanentFailure: false, error: null, pushed: 0 };

  let locationIds: string[] = [];
  if (job.location_id) {
    locationIds = [String(job.location_id)];
  } else {
    const { data, error } = await db
      .from("recorder_locations")
      .select("id")
      .eq("company_id", company.id)
      .eq("active", true);
    if (error) return { ok: false, permanentFailure: false, error: `Load locations: ${error.message}`, pushed: 0 };
    locationIds = (data ?? []).map((row) => String((row as { id: string }).id));

    if (locationIds.length === 0 && company.crm_client_id) {
      const client = await getCrmClient(company.crm_client_id);
      if (isActiveClient(client)) {
        await ensureCompanyForClient(db, client!);
        const { data: fresh } = await db
          .from("recorder_locations")
          .select("id")
          .eq("company_id", company.id)
          .eq("active", true);
        locationIds = (fresh ?? []).map((row) => String((row as { id: string }).id));
      }
    }
  }

  if (locationIds.length === 0) return { ok: true, permanentFailure: false, error: null, pushed: 0 };

  let pushed = 0;
  let permanentFailure = true;
  const errors: string[] = [];

  for (const locationId of locationIds) {
    const bundle = await loadBundle(db, company.id, locationId);
    if (!bundle) continue;
    const result = await pushBundle(db, bundle);
    if (result.ok) pushed += 1;
    if (!result.permanent) permanentFailure = false;
    if (!result.ok && result.error) errors.push(result.error);
  }

  return {
    ok: errors.length === 0,
    permanentFailure: errors.length > 0 ? permanentFailure : false,
    error: errors.length > 0 ? errors.join(" ") : null,
    pushed,
  };
}

/** Process due queued pushes. Bounded so one run fits the function timeout. */
export async function processDueJobs(db: DB, limit = 15): Promise<{ processed: number; pushed: number; failed: number }> {
  const now = nowIso();
  const { data: due, error } = await db
    .from("recorder_push_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Load push queue: ${error.message}`);

  let processed = 0;
  let pushedTotal = 0;
  let failed = 0;

  for (const job of (due ?? []) as Array<Record<string, unknown>>) {
    const claimed = await db
      .from("recorder_push_jobs")
      .update({ status: "processing", updated_at: nowIso() })
      .eq("id", String(job.id))
      .eq("status", "pending")
      .select("id");
    if (claimed.error || !claimed.data || claimed.data.length === 0) continue;

    processed += 1;
    try {
      const result = await runJob(db, job);
      pushedTotal += result.pushed;
      const attempts = Number(job.attempts ?? 0) + 1;

      if (result.ok) {
        await completeJob(db, String(job.id), "done");
      } else if (result.permanentFailure || attempts >= 4) {
        failed += 1;
        await completeJob(db, String(job.id), "failed", result.error ?? "Push failed.");
      } else {
        await retryJob(db, String(job.id), attempts, result.error ?? "Push failed.");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected push error.";
      failed += 1;
      await completeJob(db, String(job.id), "failed", message);
    }
  }

  return { processed, pushed: pushedTotal, failed };
}

/**
 * Create profiles for every active CRM client and queue a push for each active
 * location. Used by the nightly job and the manual backfill button.
 */
export async function reconcileAll(db: DB): Promise<{ companies: number; queued: number; skipped: number }> {
  const clients = await listActiveClients(5000);
  let companies = 0;
  let queued = 0;
  let skipped = 0;

  for (const client of clients) {
    try {
      const company = await ensureCompanyForClient(db, client);
      if (!company.enabled) {
        skipped += 1;
        continue;
      }
      companies += 1;
      await enqueueCompany(db, company.id, "reconcile");
      queued += 1;
    } catch {
      skipped += 1;
    }
  }

  return { companies, queued, skipped };
}
