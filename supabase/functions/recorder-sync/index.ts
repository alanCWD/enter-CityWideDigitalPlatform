// AUTO-GENERATED — do not edit directly.
// Source: supabase/functions/recorder-sync/{main.ts,pull.ts,lib/*.ts}
// Regenerate with: node scripts/bundle-recorder-function.mjs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";


// ── lib/types.ts ────────────────────────────────────────────────
/**
 * Shared types for the Customer Content Studio (recorder) integration.
 *
 * CWD is the source of truth for company assets, branding, locations and
 * campaign setup. The recorder owns recordings, submissions and publishing.
 */

type Trade = "restaurant" | "masonry" | "hvac" | "retail" | "general";
type CampaignFormat = "review" | "promo";
type SceneCapture = "video" | "photos";

interface CompanyRecord {
  id: string;
  stable_id: string;
  crm_client_id: string | null;
  agency_id: string;
  name: string;
  trade: Trade;
  website: string | null;
  phone: string | null;
  city: string | null;
  logo_url: string | null;
  brand_color: string;
  is_network: boolean;
  watermark_url: string | null;
  watermark_text: string | null;
  watermark_handle: string | null;
  credit_line: string | null;
  default_hashtags: string | null;
  enabled: boolean;
}

interface LocationRecord {
  id: string;
  company_id: string;
  agency_id: string;
  name: string;
  address: string | null;
  neighbourhood: string | null;
  website: string | null;
  phone: string | null;
  logo_url: string | null;
  brand_color: string | null;
  headline: string | null;
  enable_video: boolean;
  enable_photos: boolean;
  enable_wall: boolean;
  active: boolean;
  location_slug: string | null;
  customer_url: string | null;
  qr_url: string | null;
  embed_path: string | null;
  campaign_code: string | null;
  campaigns_sent: number | null;
  last_synced_at: string | null;
  last_sync_status: "pending" | "ok" | "failed" | "skipped" | null;
  last_sync_error: string | null;
}

interface CampaignRecord {
  id: string;
  location_id: string;
  label: string;
  headline: string | null;
  format: CampaignFormat;
  due_at: string | null;
  dish_name: string | null;
  concept: string | null;
  enable_video: boolean;
  enable_photos: boolean;
  active: boolean;
  recorder_code: string | null;
}

interface SceneRecord {
  id: string;
  campaign_id: string;
  position: number;
  key: string;
  label: string;
  prompt: string;
  hint: string | null;
  capture: SceneCapture;
}

interface CampaignBundle {
  campaign: CampaignRecord;
  scenes: SceneRecord[];
}

/** Optional branding pulled from the client's CWD brand assets. */
interface BrandingHints {
  logo_url?: string | null;
  tagline?: string | null;
}

interface CompanyBundle {
  company: CompanyRecord;
  location: LocationRecord;
  campaigns: CampaignBundle[];
  branding?: BrandingHints;
}

interface RecorderScenePayload {
  key: string;
  label: string;
  prompt: string;
  hint: string;
  capture: SceneCapture;
}

interface RecorderCampaignPayload {
  id: string;
  label: string;
  headline?: string;
  format: CampaignFormat;
  due_at?: string;
  dish_name?: string;
  concept?: string;
  enable_video: boolean;
  enable_photos: boolean;
  scenes: RecorderScenePayload[];
}

interface RecorderLocationPayload {
  id: string;
  name: string;
  address?: string;
  neighbourhood?: string;
  website?: string;
  phone?: string;
  logo_url?: string;
  brand_color?: string;
  headline?: string;
  enable_video: boolean;
  enable_photos: boolean;
  enable_wall: boolean;
}

interface RecorderCompanyPayload {
  id: string;
  name: string;
  trade: Trade;
  website?: string;
  phone?: string;
  city?: string;
  logo_url?: string;
  brand_color: string;
  watermark_url?: string;
  watermark_text?: string;
  watermark_handle?: string;
  credit_line?: string;
  default_hashtags?: string;
  is_network: boolean;
  location: RecorderLocationPayload;
  campaigns: RecorderCampaignPayload[];
}

interface RecorderPushResponse {
  ok?: boolean;
  companyId?: string;
  companyName?: string;
  locationId?: string;
  locationSlug?: string;
  campaignCode?: string;
  campaigns?: number;
  links?: {
    path?: string;
    url?: string;
    qr?: string;
    embedPath?: string;
  };
  error?: string;
}

interface RecorderPushResult {
  ok: boolean;
  status: number | null;
  body: RecorderPushResponse | null;
  raw: string;
  error: string | null;
  attempts: number;
  durationMs: number;
  permanent: boolean;
}

interface ValidationIssue {
  field: string;
  message: string;
}

const TRADES: Trade[] = ["restaurant", "masonry", "hvac", "retail", "general"];
const MAX_PUSH_BYTES = 400 * 1024;


// ── lib/payload.ts ──────────────────────────────────────────────
/**
 * CWD -> recorder payload mapper.
 *
 * One company object per company-location pair, exactly as the recorder's
 * intake contract expects. Both the push service and the pull endpoint call
 * this module, so field mapping is never duplicated.
 *
 * Rules enforced here:
 *  - stable ids are passed through untouched
 *  - only active campaigns are sent
 *  - network brand-kit fields are omitted for ordinary single businesses
 *  - optional fields are omitted (never sent as an empty string) so a partial
 *    push cannot clear values the recorder already holds
 */



function trimmed(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

/** Keep a date-only value as-is; normalise timestamps to ISO 8601. */
function isoOrDate(value: string | null | undefined): string | undefined {
  const raw = trimmed(value);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString();
}

function normalizeScenes(scenes: CampaignBundle["scenes"]): RecorderScenePayload[] {
  return [...scenes]
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map((scene, index) => ({
      key: trimmed(scene.key) ?? `scene-${index + 1}`,
      label: String(scene.label ?? "").trim(),
      prompt: String(scene.prompt ?? "").trim(),
      hint: String(scene.hint ?? "").trim(),
      capture: scene.capture === "photos" ? "photos" : "video",
    }));
}

function mapCampaign(bundle: CampaignBundle): RecorderCampaignPayload {
  const c = bundle.campaign;
  const isPromo = c.format === "promo";
  return {
    id: c.id,
    label: String(c.label ?? "").trim(),
    ...(trimmed(c.headline) ? { headline: trimmed(c.headline) } : {}),
    format: isPromo ? "promo" : "review",
    ...(isoOrDate(c.due_at) ? { due_at: isoOrDate(c.due_at) } : {}),
    ...(trimmed(c.dish_name) ? { dish_name: trimmed(c.dish_name) } : {}),
    ...(trimmed(c.concept) ? { concept: trimmed(c.concept) } : {}),
    // The recorder requires video on promo offers.
    enable_video: isPromo ? true : Boolean(c.enable_video),
    enable_photos: Boolean(c.enable_photos),
    scenes: normalizeScenes(bundle.scenes),
  };
}

function mapLocation(bundle: CompanyBundle): RecorderLocationPayload {
  const l = bundle.location;
  const brandingLogo = trimmed(bundle.branding?.logo_url);
  const network = bundle.company.is_network;
  // The network logo is the company logo; the location keeps the restaurant's
  // own logo. For a single business both fall back to the same brand asset.
  const locationLogo = trimmed(l.logo_url) ?? (network ? undefined : brandingLogo);
  return {
    id: l.id,
    name: String(l.name ?? "").trim(),
    ...(trimmed(l.address) ? { address: trimmed(l.address) } : {}),
    ...(trimmed(l.neighbourhood) ? { neighbourhood: trimmed(l.neighbourhood) } : {}),
    ...(trimmed(l.website) ? { website: trimmed(l.website) } : {}),
    ...(trimmed(l.phone) ? { phone: trimmed(l.phone) } : {}),
    ...(locationLogo ? { logo_url: locationLogo } : {}),
    ...(trimmed(l.brand_color) ? { brand_color: trimmed(l.brand_color) } : {}),
    ...(trimmed(l.headline)
      ? { headline: trimmed(l.headline) }
      : !network && trimmed(bundle.branding?.tagline)
        ? { headline: trimmed(bundle.branding?.tagline) }
        : {}),
    enable_video: Boolean(l.enable_video),
    enable_photos: Boolean(l.enable_photos),
    enable_wall: Boolean(l.enable_wall),
  };
}

function buildRecorderCompany(bundle: CompanyBundle): RecorderCompanyPayload {
  const c = bundle.company;
  const network = Boolean(c.is_network);
  const brandingLogo = trimmed(bundle.branding?.logo_url);
  const companyLogo = network ? trimmed(c.logo_url) : brandingLogo ?? trimmed(c.logo_url);

  return {
    id: String(c.stable_id ?? "").trim(),
    name: String(c.name ?? "").trim(),
    trade: (TRADES.includes(c.trade) ? c.trade : "general") as Trade,
    ...(trimmed(c.website) ? { website: trimmed(c.website) } : {}),
    ...(trimmed(c.phone) ? { phone: trimmed(c.phone) } : {}),
    ...(trimmed(c.city) ? { city: trimmed(c.city) } : {}),
    ...(companyLogo ? { logo_url: companyLogo } : {}),
    brand_color: trimmed(c.brand_color) ?? "#0078D7",
    // Network brand kit: only ever sent for influencers / networks.
    ...(network && trimmed(c.watermark_url) ? { watermark_url: trimmed(c.watermark_url) } : {}),
    ...(network && trimmed(c.watermark_text) ? { watermark_text: trimmed(c.watermark_text) } : {}),
    ...(network && trimmed(c.watermark_handle) ? { watermark_handle: trimmed(c.watermark_handle) } : {}),
    ...(network && trimmed(c.credit_line) ? { credit_line: trimmed(c.credit_line) } : {}),
    ...(network && trimmed(c.default_hashtags) ? { default_hashtags: trimmed(c.default_hashtags) } : {}),
    is_network: network,
    location: mapLocation(bundle),
    campaigns: bundle.campaigns
      .filter((bundleCampaign) => bundleCampaign.campaign.active)
      .map(mapCampaign),
  };
}

/** One `{ company: {...} }` body, used for a single intake POST. */
function buildPushBody(bundle: CompanyBundle): { company: RecorderCompanyPayload } {
  return { company: buildRecorderCompany(bundle) };
}

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1|\[::1\])/i;

/** Public HTTPS image the recorder can draw into a canvas. */
function isPublicHttpsUrl(value: string | undefined | null): boolean {
  const raw = trimmed(value);
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) return false;
  if (PRIVATE_HOST.test(host) || host.endsWith(".local") || host.endsWith(".internal")) return false;
  return true;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Validate a mapped company before it is sent. The recorder rejects the whole
 * request when the company id or name is missing, so CWD catches those first
 * and reports a readable message instead of a half-valid push.
 */
function validateRecorderCompany(payload: RecorderCompanyPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });

  if (!payload.id) add("company.id", "Company id is required.");
  else if (payload.id.length > 120) add("company.id", "Company id must be 120 characters or fewer.");

  if (!payload.name) add("company.name", "Company name is required.");
  if (!TRADES.includes(payload.trade)) add("company.trade", "Trade must be restaurant, masonry, hvac, retail or general.");
  if (!HEX.test(payload.brand_color)) add("company.brand_color", "Brand colour must be #RRGGBB.");
  if (payload.website && !/^https?:\/\//i.test(payload.website)) add("company.website", "Website must start with http:// or https://.");
  if (payload.logo_url && !isPublicHttpsUrl(payload.logo_url)) {
    add("company.logo_url", "Logo must be a public HTTPS image.");
  }
  if (payload.is_network && payload.watermark_url && !isPublicHttpsUrl(payload.watermark_url)) {
    add("company.watermark_url", "Watermark must be a public HTTPS image.");
  }
  if (!payload.is_network && (payload.watermark_url || payload.watermark_text || payload.watermark_handle)) {
    add("company.is_network", "Brand-kit fields are only sent for network companies.");
  }

  const location = payload.location;
  if (!location?.id) add("location.id", "Location id is required.");
  if (!location?.name) add("location.name", "Location name is required.");
  if (location?.brand_color && !HEX.test(location.brand_color)) add("location.brand_color", "Location colour must be #RRGGBB.");
  if (location?.logo_url && !isPublicHttpsUrl(location.logo_url)) {
    add("location.logo_url", "Location logo must be a public HTTPS image.");
  }

  const campaignIds = new Set<string>();
  payload.campaigns.forEach((campaign, index) => {
    const prefix = `campaigns[${index}]`;
    if (!campaign.id) add(`${prefix}.id`, "Campaign id is required for idempotency.");
    if (campaignIds.has(campaign.id)) add(`${prefix}.id`, "Campaign ids must be unique.");
    campaignIds.add(campaign.id);
    if (!campaign.label) add(`${prefix}.label`, "Campaign label is required.");
    if (campaign.format !== "review" && campaign.format !== "promo") {
      add(`${prefix}.format`, "Campaign format must be review or promo.");
    }
    if (campaign.format === "promo") {
      if (!campaign.enable_video) add(`${prefix}.enable_video`, "Promo campaigns must enable video.");
      if (!campaign.dish_name) add(`${prefix}.dish_name`, "Promo campaigns require a dish name.");
      if (!campaign.concept) add(`${prefix}.concept`, "Promo campaigns require a concept.");
    }
    if (campaign.scenes.length !== 3) add(`${prefix}.scenes`, "A campaign must have exactly three scenes.");
    const keys = new Set<string>();
    campaign.scenes.forEach((scene, sceneIndex) => {
      const scenePrefix = `${prefix}.scenes[${sceneIndex}]`;
      if (!scene.label) add(`${scenePrefix}.label`, "Scene label is required.");
      if (!scene.prompt) add(`${scenePrefix}.prompt`, "Scene prompt is required.");
      if (scene.capture !== "video" && scene.capture !== "photos") {
        add(`${scenePrefix}.capture`, "Scene capture must be video or photos.");
      }
      if (keys.has(scene.key)) add(`${scenePrefix}.key`, "Scene keys must be unique.");
      keys.add(scene.key);
    });
  });

  return issues;
}

/** Map a free-text CRM industry onto the recorder's trade list. */
function suggestTrade(industry: string | null | undefined): Trade {
  const s = String(industry ?? "").toLowerCase();
  if (!s) return "general";
  if (/(restaurant|food|cafe|coffee|bakery|bar|pizza|sushi|kitchen|hospitality|catering|winery|brewery)/.test(s)) return "restaurant";
  if (/(mason|brick|stone|concrete|landscap|construction|contractor|renovat)/.test(s)) return "masonry";
  if (/(hvac|heating|cooling|plumb|electric|mechanical|furnace|air condition)/.test(s)) return "hvac";
  if (/(retail|shop|store|boutique|ecommerce|e-commerce|furniture|mattress|apparel)/.test(s)) return "retail";
  return "general";
}


// ── lib/push.ts ─────────────────────────────────────────────────
/**
 * Server-side push service for the Customer Content Studio recorder.
 *
 * One HTTPS POST per company-location pair. The intake key is read from server
 * secrets by the caller and is never logged, echoed or included in error text.
 * Temporary failures (network, timeout, 429, 5xx) retry with backoff; contract
 * errors (4xx, invalid payload) fail permanently so the job is not retried
 * forever.
 */




interface PushConfig {
  intakeUrl: string;
  intakeKey: string;
}

interface PushOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function parseBody(raw: string): RecorderPushResponse | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as RecorderPushResponse) : null;
  } catch {
    return null;
  }
}

/**
 * Push one company-location payload. Never throws: callers record the result.
 */
async function pushRecorderCompany(
  payload: RecorderCompanyPayload,
  config: PushConfig,
  options: PushOptions = {},
): Promise<RecorderPushResult> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_ATTEMPTS);
  const sleep = options.sleep ?? defaultSleep;
  const doFetch = options.fetchImpl ?? fetch;

  const fail = (error: string, permanent: boolean, attempts = 1, status: number | null = null, body: RecorderPushResponse | null = null, raw = ""): RecorderPushResult => ({
    ok: false,
    status,
    body,
    raw,
    error,
    attempts,
    durationMs: Date.now() - started,
    permanent,
  });

  const url = safeUrl(config.intakeUrl);
  if (!url) return fail("Recorder intake URL is not configured or is not a valid HTTPS address.", true);
  if (!String(config.intakeKey ?? "").trim()) return fail("Recorder intake key is not configured.", true);

  const issues = validateRecorderCompany(payload);
  if (issues.length > 0) {
    return fail(`CWD data is incomplete: ${issues.map((i) => `${i.field} — ${i.message}`).join(" ")}`, true);
  }

  const body = { company: payload };
  const serialized = JSON.stringify(body);
  const size = byteLength(serialized);
  if (size > MAX_PUSH_BYTES) {
    return fail(`Payload is ${Math.round(size / 1024)} KB; the recorder limits a request to 400 KB.`, true);
  }

  let attempts = 0;
  let last: RecorderPushResult | null = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    let response: Response | null = null;
    let raw = "";
    try {
      response = await doFetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cwd-key": config.intakeKey,
        },
        body: serialized,
        signal: AbortSignal.timeout(timeoutMs),
      });
      raw = await response.text().catch(() => "");
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
      const message = isTimeout
        ? `Recorder did not answer within ${Math.round(timeoutMs / 1000)}s.`
        : "Could not reach the recorder intake URL.";
      last = fail(message, false, attempts);
      if (attempts < maxAttempts) {
        await sleep(Math.min(1000 * 2 ** (attempts - 1), 8000));
        continue;
      }
      return last;
    }

    const parsed = parseBody(raw);
    const status = response.status;

    if (response.ok && parsed?.ok === true) {
      return {
        ok: true,
        status,
        body: parsed,
        raw,
        error: null,
        attempts,
        durationMs: Date.now() - started,
        permanent: false,
      };
    }

    const recorderMessage = typeof parsed?.error === "string" && parsed.error.trim()
      ? parsed.error.trim()
      : response.ok
        ? "The recorder answered without a success confirmation."
        : `The recorder answered with status ${status}.`;

    const retryable = RETRYABLE_STATUS.has(status);
    last = {
      ok: false,
      status,
      body: parsed,
      raw: raw.slice(0, 4000),
      error: recorderMessage,
      attempts,
      durationMs: Date.now() - started,
      permanent: !retryable,
    };

    if (!retryable || attempts >= maxAttempts) return last;

    const retryAfter = Number(response.headers.get("retry-after") ?? "");
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 30_000)
      : Math.min(1000 * 2 ** (attempts - 1), 8000);
    await sleep(wait);
  }

  return last ?? fail("Push failed without a response.", false, attempts);
}


// ── lib/crm.ts ──────────────────────────────────────────────────
/**
 * Minimal read access to the CRM database (Bunny/libSQL) for the recorder
 * integration. Mirrors the read-only query path used by seo-api: credentials
 * come from server secrets and are never returned to callers or logged.
 */

interface CrmClientRow {
  id: string;
  name: string;
  status: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  address_line1: string | null;
  industry: string | null;
  agency_id: string | null;
  updated_at: string | null;
}

type SqlValue = string | number | null;
type Row = Record<string, SqlValue>;

function bunnyHttpBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BUNNY_TOKEN = () => Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";

function crmConfigured(): boolean {
  const base = bunnyHttpBase();
  return Boolean(BUNNY_TOKEN() && base && base !== "https://");
}

async function execMany(stmts: Array<{ sql: string; args?: SqlValue[] }>): Promise<Row[][]> {
  if (!crmConfigured()) throw new Error("CRM database is not configured.");
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${BUNNY_TOKEN()}`, "Content-Type": "application/json" },
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
  if (!res.ok) throw new Error(`CRM database answered with status ${res.status}.`);

  const data = await res.json() as {
    results: Array<{
      type: string;
      response?: { result?: { cols: Array<{ name: string }>; rows: Array<Array<{ type: string; value?: string }>> } };
      error?: { message: string };
    }>;
  };

  const out: Row[][] = [];
  for (let i = 0; i < stmts.length; i++) {
    const r = data.results?.[i];
    if (!r) throw new Error("CRM database returned an incomplete response.");
    if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "CRM query failed.");
    const cols = r.response?.result?.cols ?? [];
    const rows = (r.response?.result?.rows ?? []).map((cells) => {
      const row: Row = {};
      cols.forEach((c, idx) => {
        const v = cells[idx];
        if (!v || v.type === "null") row[c.name] = null;
        else if (v.type === "integer" || v.type === "float") row[c.name] = Number(v.value);
        else row[c.name] = v.value ?? null;
      });
      return row;
    });
    out.push(rows);
  }
  return out;
}

async function exec(sql: string, args: SqlValue[] = []): Promise<Row[]> {
  return (await execMany([{ sql, args }]))[0];
}

const CLIENT_COLUMNS =
  "id, name, status, website, phone, city, region, address_line1, industry, agency_id, updated_at";

function toClient(row: Row): CrmClientRow {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? "").toLowerCase(),
    website: row.website == null ? null : String(row.website),
    phone: row.phone == null ? null : String(row.phone),
    city: row.city == null ? null : String(row.city),
    region: row.region == null ? null : String(row.region),
    address_line1: row.address_line1 == null ? null : String(row.address_line1),
    industry: row.industry == null ? null : String(row.industry),
    agency_id: row.agency_id == null ? null : String(row.agency_id),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  };
}

async function getCrmClient(id: string): Promise<CrmClientRow | null> {
  if (!id) return null;
  const rows = await exec(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? toClient(rows[0]) : null;
}

async function listActiveClients(limit = 5000): Promise<CrmClientRow[]> {
  const rows = await exec(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE status = 'active' ORDER BY name ASC LIMIT ?`,
    [Math.max(1, Math.min(limit, 5000))],
  );
  return rows.map(toClient).filter((c) => c.id);
}

async function activeClientIds(): Promise<Set<string>> {
  const rows = await exec(`SELECT id FROM clients WHERE status = 'active' LIMIT 5000`);
  return new Set(rows.map((r) => String(r.id ?? "")).filter(Boolean));
}


// ── lib/store.ts ────────────────────────────────────────────────
/**
 * Persistence and orchestration for the recorder integration.
 *
 * Everything here runs server-side with the service role: reading CWD company
 * profiles, resolving the CRM company record, mapping one company-location
 * bundle, POSTing it to the recorder and recording the outcome. The pull
 * endpoint reuses the same bundle loader so both directions always match.
 */






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

async function getCompanyById(db: DB, id: string): Promise<CompanyRecord | null> {
  const { data, error } = await db.from("recorder_companies").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Load company: ${error.message}`);
  return data ? rowToCompany(data as Record<string, unknown>) : null;
}

async function getCompanyByCrmId(db: DB, crmClientId: string): Promise<CompanyRecord | null> {
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
async function ensureCompanyForClient(db: DB, client: CrmClientRow): Promise<CompanyRecord> {
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
async function loadBundle(db: DB, companyId: string, locationId: string): Promise<CompanyBundle | null> {
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
async function loadAllBundles(db: DB): Promise<Array<CompanyBundle | null>> {
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
async function pushBundle(db: DB, bundle: CompanyBundle): Promise<RecorderPushResult> {
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

async function enqueueLocation(db: DB, locationId: string, reason = "change"): Promise<void> {
  const { error } = await db.rpc("recorder_enqueue_location", { p_location_id: locationId, p_reason: reason });
  if (error) throw new Error(`Queue location push: ${error.message}`);
}

async function enqueueCompany(db: DB, companyId: string, reason = "change"): Promise<void> {
  const { error } = await db.rpc("recorder_enqueue_company", { p_company_id: companyId, p_reason: reason });
  if (error) throw new Error(`Queue company push: ${error.message}`);
}

async function enqueueClient(db: DB, crmClientId: string, reason = "crm"): Promise<void> {
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
async function processDueJobs(db: DB, limit = 15): Promise<{ processed: number; pushed: number; failed: number }> {
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
async function reconcileAll(db: DB): Promise<{ companies: number; queued: number; skipped: number }> {
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


// ── pull.ts ─────────────────────────────────────────────────────
/**
 * Read-only pull route for the Customer Content Studio recorder.
 *
 * GET /companies (also tolerates /api/recorder/companies and /api/companies).
 * Auth: Authorization: Bearer <RECORDER_PULL_TOKEN>. The pull token is separate
 * from the intake key, stored only as a SHA-256 hash, read-only and rotatable.
 * Missing, wrong or revoked tokens return 401 JSON.
 *
 * The response uses the same mapper and stable ids as the push contract: one
 * company object per active company-location pair, in one compact response.
 * No pagination until the recorder team agrees to it.
 */




const PULL_SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PULL_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const pullDb = createClient(PULL_SUPABASE_URL, PULL_SERVICE_KEY, { auth: { persistSession: false } });

const SERVICE = "cwd-recorder-pull";
const VERSION = "1.0";
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

const pullCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const pullJson = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...pullCorsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });

const pullFail = (status: number, message: string, extra: Record<string, string> = {}) =>
  pullJson({ error: message }, status, extra);

async function pullSha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerToken(req: Request): string | null {
  const auth = (req.headers.get("Authorization") ?? "").trim();
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function authenticate(req: Request): Promise<{ id: string } | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const hash = await pullSha256Hex(token);
  const { data, error } = await pullDb
    .from("recorder_pull_tokens")
    .select("id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) return null;
  return { id: String(data.id) };
}

async function rateLimited(tokenId: string): Promise<number | null> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data, error } = await pullDb
    .from("recorder_pull_log")
    .select("created_at")
    .eq("token_id", tokenId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(RATE_LIMIT);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length < RATE_LIMIT) return null;
  const oldest = Date.parse(String(rows[0]?.created_at ?? ""));
  const elapsed = Number.isNaN(oldest) ? WINDOW_MS : Date.now() - oldest;
  return Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000));
}

function routeOf(pathname: string): string {
  let rest = pathname;
  for (const marker of ["/recorder-sync", "/recorder-pull"]) {
    const idx = rest.indexOf(marker);
    if (idx >= 0) rest = rest.slice(idx + marker.length);
  }
  rest = rest.replace(/^\/api\/recorder/, "").replace(/^\/api/, "");
  return rest.replace(/^\/+|\/+$/g, "");
}

async function logRequest(tokenId: string | null, route: string, status: number, duration: number, companies: number) {
  try {
    await pullDb.from("recorder_pull_log").insert({
      token_id: tokenId,
      route,
      method: "GET",
      status,
      duration_ms: Math.round(duration),
      company_count: companies,
    });
  } catch { /* request logging never breaks the response */ }
}

async function handlePull(req: Request): Promise<Response> {
  const started = Date.now();
  const method = req.method.toUpperCase();
  if (method === "OPTIONS") return new Response("ok", { headers: pullCorsHeaders });
  if (method !== "GET" && method !== "HEAD") {
    return pullFail(405, "Only GET is supported.", { Allow: "GET, HEAD, OPTIONS" });
  }

  const route = routeOf(new URL(req.url).pathname);

  // Public liveness probe: service identity only, never company data.
  if (route === "health") {
    return pullJson({ ok: true, service: SERVICE, version: VERSION });
  }
  if (route !== "companies" && route !== "") {
    return pullFail(404, "Unknown route. Use /companies.");
  }

  let tokenId: string | null = null;
  try {
    const token = await authenticate(req);
    if (!token) {
      await logRequest(null, "companies", 401, Date.now() - started, 0);
      return pullFail(401, "Missing or invalid pull token.");
    }
    tokenId = token.id;

    const retryAfter = await rateLimited(token.id);
    if (retryAfter !== null) {
      await logRequest(token.id, "companies", 429, Date.now() - started, 0);
      return pullFail(429, `Rate limit exceeded: ${RATE_LIMIT} requests per minute.`, {
        "Retry-After": String(retryAfter),
      });
    }

    const bundles = await loadAllBundles(db);
    const companies = [];
    for (const bundle of bundles) {
      if (!bundle) continue;
      const payload = buildRecorderCompany(bundle);
      const issues = validateRecorderCompany(payload);
      if (issues.length > 0) {
        console.warn("recorder-pull skipped an invalid company payload", {
          company: payload.id,
          location: payload.location?.id,
          fields: issues.map((i) => i.field),
        });
        continue;
      }
      companies.push(payload);
    }

    await logRequest(token.id, "companies", 200, Date.now() - started, companies.length);
    try {
      await pullDb.from("recorder_pull_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);
    } catch { /* best effort */ }

    return pullJson({ companies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("recorder-pull error:", message);
    await logRequest(tokenId, "companies", 500, Date.now() - started, 0);
    return pullFail(500, "Could not build the company list.");
  }
}


// ── main.ts ─────────────────────────────────────────────────────
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
