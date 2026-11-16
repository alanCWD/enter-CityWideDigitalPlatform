// Typed client for the Content Studio backend (recorder-sync).
//
// The intake key and pull-token secrets never reach this code. The browser only
// calls staff actions with the signed-in user's session, and receives the pull
// token plaintext exactly once when it is created.
import { supabase } from "@/integrations/supabase/client";

export type Trade = "restaurant" | "masonry" | "hvac" | "retail" | "general";
export type CampaignFormat = "review" | "promo";
export type SceneCapture = "video" | "photos";

export interface RecorderCompany {
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
  created_at: string;
  updated_at: string;
  location_count?: number;
  last_synced_at?: string | null;
  last_sync_status?: "ok" | "failed" | "partial" | null;
  last_sync_error?: string | null;
}

export interface RecorderScene {
  id?: string;
  campaign_id?: string;
  position: number;
  key: string;
  label: string;
  prompt: string;
  hint: string | null;
  capture: SceneCapture;
}

export interface RecorderCampaign {
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
  scenes: RecorderScene[];
}

export interface RecorderLocation {
  id: string;
  company_id: string;
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
  campaigns: RecorderCampaign[];
}

export interface Branding {
  logo_square_url: string | null;
  logo_rect_url: string | null;
  tagline: string | null;
}

export interface CompanyDetail {
  company: RecorderCompany;
  locations: RecorderLocation[];
  branding: Branding | null;
}

export interface PullToken {
  id: string;
  label: string;
  token_prefix: string;
  created_by?: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface PushLog {
  id: string;
  company_id: string | null;
  location_id: string | null;
  crm_client_id: string | null;
  stable_id: string | null;
  location_slug: string | null;
  ok: boolean;
  status_code: number | null;
  attempts: number;
  duration_ms: number | null;
  error: string | null;
  response: Record<string, unknown> | null;
  created_at: string;
}

export interface ConnectionStatus {
  intake_url_configured: boolean;
  intake_url_valid?: boolean;
  intake_key_configured: boolean;
  studio_url_configured?: boolean;
  studio_url_valid?: boolean;
  sso_configured?: boolean;
  configured: boolean;
  pull_endpoint: string;
  companies_total: number;
  companies_enabled: number;
  locations_active: number;
  pending_pushes: number;
  pull_tokens: PullToken[];
  recent_pushes: PushLog[];
}

export interface PushResult {
  location_id: string;
  location_name: string;
  ok: boolean;
  error: string | null;
  status_code: number | null;
  slug: string | null;
  links: { path?: string; url?: string; qr?: string; embedPath?: string } | null;
  campaigns: number;
}

const TIMEOUT_MS = 60_000;

export async function recorder<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke("recorder-sync", {
      body: { action, payload },
      headers,
    });
    if (error) throw new Error(error.message || `${action} failed`);
    if (data && typeof data === "object" && "error" in data && data.error) {
      throw new Error(String((data as { error: string }).error));
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${action} took too long. Try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const TRADE_LABELS: Record<Trade, string> = {
  restaurant: "Restaurant",
  masonry: "Masonry",
  hvac: "HVAC",
  retail: "Retail",
  general: "General",
};

export function fmtWhen(value: string | null | undefined): string {
  if (!value) return "Never";
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function syncTone(status: string | null | undefined): "ok" | "failed" | "idle" {
  if (status === "ok") return "ok";
  if (status === "failed") return "failed";
  return "idle";
}

/** Upload a logo/watermark to the public brand-assets bucket through a signed URL. */
export async function uploadRecorderAsset(
  input: { company_id: string; location_id?: string | null; kind: "logo" | "watermark"; filename: string },
  file: File,
): Promise<string> {
  const signed = await recorder<{ upload_url: string; public_url: string }>("asset.uploadUrl", input);
  const res = await fetch(signed.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}.`);
  return signed.public_url;
}

export const REVIEW_SCENES: Array<Pick<RecorderScene, "key" | "label" | "prompt" | "hint" | "capture">> = [
  {
    key: "welcome",
    label: "Welcome",
    prompt: "Say hello and introduce the business in your own words.",
    hint: "Smile, say your name, and mention where you are.",
    capture: "video",
  },
  {
    key: "experience",
    label: "The experience",
    prompt: "Show what a customer experiences when they visit.",
    hint: "Walk through the space or show the product in use.",
    capture: "video",
  },
  {
    key: "favourite",
    label: "Your favourite",
    prompt: "Show your favourite item, dish or detail and say why.",
    hint: "Close, steady shots work best.",
    capture: "photos",
  },
];

export const VFS_PROMO_SCENES: Array<Pick<RecorderScene, "key" | "label" | "prompt" | "hint" | "capture">> = [
  {
    key: "welcome",
    label: "Welcome",
    prompt: "Welcome viewers to Victoria Food Scene and introduce the restaurant.",
    hint: "High energy, say the restaurant name clearly.",
    capture: "video",
  },
  {
    key: "concept",
    label: "The concept",
    prompt: "Explain the restaurant's concept and what makes it different.",
    hint: "Show the room while you talk.",
    capture: "video",
  },
  {
    key: "dish",
    label: "The dish",
    prompt: "Show the featured dish from three angles.",
    hint: "Use stills if the dish is not recorded.",
    capture: "photos",
  },
];

/**
 * Open the recorder studio with a one-time SSO link.
 *
 * The backend signs the 60-second token; this function only receives the URL.
 * A blank tab is opened synchronously so pop-up blockers keep the click's user
 * activation, then navigated once the backend answers. Every call gets a fresh
 * jti and token from the server.
 */
export async function openRecorderStudio(companyId: string): Promise<void> {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("The studio tab was blocked. Allow pop-ups for the dashboard and try again.");

  try {
    const result = await recorder<{ url: string; expires_in: number }>("studio.sso", { company_id: companyId });
    tab.opener = null;
    tab.location.href = result.url;
  } catch (error) {
    tab.close();
    throw error;
  }
}
