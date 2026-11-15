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

import type {
  CampaignBundle,
  CompanyBundle,
  RecorderCampaignPayload,
  RecorderCompanyPayload,
  RecorderLocationPayload,
  RecorderScenePayload,
  Trade,
  ValidationIssue,
} from "./types.ts";
import { TRADES } from "./types.ts";

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

export function buildRecorderCompany(bundle: CompanyBundle): RecorderCompanyPayload {
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
export function buildPushBody(bundle: CompanyBundle): { company: RecorderCompanyPayload } {
  return { company: buildRecorderCompany(bundle) };
}

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1|\[::1\])/i;

/** Public HTTPS image the recorder can draw into a canvas. */
export function isPublicHttpsUrl(value: string | undefined | null): boolean {
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
export function validateRecorderCompany(payload: RecorderCompanyPayload): ValidationIssue[] {
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
export function suggestTrade(industry: string | null | undefined): Trade {
  const s = String(industry ?? "").toLowerCase();
  if (!s) return "general";
  if (/(restaurant|food|cafe|coffee|bakery|bar|pizza|sushi|kitchen|hospitality|catering|winery|brewery)/.test(s)) return "restaurant";
  if (/(mason|brick|stone|concrete|landscap|construction|contractor|renovat)/.test(s)) return "masonry";
  if (/(hvac|heating|cooling|plumb|electric|mechanical|furnace|air condition)/.test(s)) return "hvac";
  if (/(retail|shop|store|boutique|ecommerce|e-commerce|furniture|mattress|apparel)/.test(s)) return "retail";
  return "general";
}
