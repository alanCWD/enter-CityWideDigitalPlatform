/**
 * Shared types for the Customer Content Studio (recorder) integration.
 *
 * CWD is the source of truth for company assets, branding, locations and
 * campaign setup. The recorder owns recordings, submissions and publishing.
 */

export type Trade = "restaurant" | "masonry" | "hvac" | "retail" | "general";
export type CampaignFormat = "review" | "promo";
export type SceneCapture = "video" | "photos";

export interface CompanyRecord {
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

export interface LocationRecord {
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

export interface CampaignRecord {
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

export interface SceneRecord {
  id: string;
  campaign_id: string;
  position: number;
  key: string;
  label: string;
  prompt: string;
  hint: string | null;
  capture: SceneCapture;
}

export interface CampaignBundle {
  campaign: CampaignRecord;
  scenes: SceneRecord[];
}

/** Optional branding pulled from the client's CWD brand assets. */
export interface BrandingHints {
  logo_url?: string | null;
  tagline?: string | null;
}

export interface CompanyBundle {
  company: CompanyRecord;
  location: LocationRecord;
  campaigns: CampaignBundle[];
  branding?: BrandingHints;
}

export interface RecorderScenePayload {
  key: string;
  label: string;
  prompt: string;
  hint: string;
  capture: SceneCapture;
}

export interface RecorderCampaignPayload {
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

export interface RecorderLocationPayload {
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

export interface RecorderCompanyPayload {
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

export interface RecorderPushResponse {
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

export interface RecorderPushResult {
  ok: boolean;
  status: number | null;
  body: RecorderPushResponse | null;
  raw: string;
  error: string | null;
  attempts: number;
  durationMs: number;
  permanent: boolean;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export const TRADES: Trade[] = ["restaurant", "masonry", "hvac", "retail", "general"];
export const MAX_PUSH_BYTES = 400 * 1024;
