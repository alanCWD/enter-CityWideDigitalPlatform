// OneProfile `partner-social` — the agency client-publishing engine.
//
// OneProfile hosts the engine, the OAuth apps and every provider token. This
// dashboard is a window onto it: it never reads the engine's tables, never holds
// a provider credential and never publishes directly. Every helper below is one
// action against the engine, authorised by the signed-in user's session JWT.
//
// Scope is always re-derived server-side from that session (membership in
// `cw_agency_members`), so `business_ref` and `agency_id` *select* a row but
// never authorise one — another agency's reference reaches nothing, and
// `partner_members` grants no publishing access at all.
//
// CONTRACT NOTE: `docs/partner-social-api.md` is the authoritative payload and
// error contract. Until it lands, the call envelope follows this codebase's
// existing action-gateway convention (`{ action, payload }`, as used by
// `social-syndication` and `bunny-rpc`) and responses are read leniently, so
// every assumption is contained in this one file.

import { supabase } from "@/integrations/supabase/client";

export type PartnerPlatform =
  | "linkedin"
  | "facebook"
  | "instagram"
  | "bluesky"
  | "tiktok";

/** Every action the engine exposes. */
export type PartnerAction =
  | "sync_businesses"
  | "list_businesses"
  | "start_connect"
  | "list_channels"
  | "register_media"
  | "create_post"
  | "list_posts"
  | "cancel_post"
  | "disconnect_channel";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  bluesky: "Bluesky",
  tiktok: "TikTok",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

// ── Domain types ─────────────────────────────────────────────────────────────

/** One connected (or revoked) platform for a client company. */
export interface PartnerChannel {
  platform: string;
  handle?: string | null;
  display_name?: string | null;
  profile_url?: string | null;
  /** false once disconnected — a deliberate disconnect is not a revocation. */
  is_active: boolean;
  /** which account the grant is posting as; `organization` for a company Page. */
  account_type?: "personal" | "organization" | (string & {}) | null;
  /** the provider revoked the grant: reconnect, and the engine has emailed a notice. */
  needs_reconnect?: boolean;
  connected_at?: string | null;
}

/**
 * A client company. It is never public: no profile row, no username, no login,
 * no public page — `business_ref` is simply the dashboard's own client id
 * (`external_ref`) echoed back.
 */
export interface PartnerBusiness {
  business_ref: string;
  display_name?: string | null;
  external_ref?: string | null;
  is_archived?: boolean;
  channels?: PartnerChannel[];
  /** drives the reconnect badges in the business list. */
  needs_reconnect_platforms?: string[];
}

/** `list_channels` — the only completion signal for a connect. */
export interface ChannelSnapshot {
  business_ref: string;
  channels: PartnerChannel[];
  available_platforms: string[];
  upcoming_platforms: string[];
  needs_reconnect_platforms: string[];
}

/** Per-platform outcome. Publishing succeeds if at least one platform did. */
export interface PlatformResult {
  platform: string;
  ok: boolean;
  error?: string | null;
  post_id?: string | null;
  url?: string | null;
}

export interface PartnerPost {
  id?: string;
  business_ref?: string;
  content?: string;
  media?: string | null;
  scheduled_for?: string | null;
  published_at?: string | null;
  status?: string;
  results?: PlatformResult[];
}

export interface CreatePostInput {
  businessRef: string;
  /** 1–5 platforms per post. */
  platforms: string[];
  /** ≤ 10,000 characters. */
  content: string;
  /** at most one image today; a second is rejected as `too_many_media`. */
  media?: string | null;
  /** ISO timestamp; must be in the future, or omit to publish now. */
  scheduledFor?: string | null;
}

export interface SyncBusinessInput {
  /** the dashboard's own client id — the only stable link between the systems. */
  external_ref: string;
  display_name?: string;
  [field: string]: unknown;
}

export interface SyncBusinessesResult {
  /** the mirrored book, as the engine now holds it. */
  businesses: PartnerBusiness[];
  /** refs absent from the payload: archived, never deleted. */
  archived: string[];
}

// ── Errors ───────────────────────────────────────────────────────────────────

/**
 * Error codes the engine documents, plus the two this client adds for a
 * transport-level miss. Kept as a union with `(string & {})` so an undocumented
 * code still type-checks and is surfaced verbatim during development.
 */
export type PartnerErrorCode =
  | "forbidden"
  | "not_found"
  | "partner_not_approved"
  | "platform_not_available_yet"
  | "too_many_media"
  | "unauthorized"
  | "invalid_request"
  /** No `partner-social` function is reachable on this backend. */
  | "engine_unreachable"
  /** The request never reached a backend at all. */
  | "network_error"
  | (string & {});

export class PartnerSocialError extends Error {
  readonly code: PartnerErrorCode;
  readonly status?: number;

  constructor(code: PartnerErrorCode, message: string, status?: number) {
    super(message);
    this.name = "PartnerSocialError";
    this.code = code;
    this.status = status;
  }

  /** `code` with its HTTP status, for surfacing verbatim during development. */
  get detail(): string {
    return this.status ? `${this.code} · HTTP ${this.status}` : this.code;
  }
}

export function isPartnerSocialError(e: unknown): e is PartnerSocialError {
  return e instanceof PartnerSocialError;
}

function codeOf(body: unknown, fallback: PartnerErrorCode): PartnerErrorCode {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    for (const key of ["error", "code", "error_code"]) {
      const value = rec[key];
      if (typeof value === "string" && value) return value;
      if (value && typeof value === "object") {
        const nested = (value as Record<string, unknown>).code;
        if (typeof nested === "string" && nested) return nested;
      }
    }
  }
  return fallback;
}

function messageOf(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "reason"]) {
      const value = rec[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return fallback;
}

/** The gateway answers a plain `{ code: <number>, message }` body for a miss. */
async function errorFromInvoke(error: unknown, action: PartnerAction): Promise<PartnerSocialError> {
  const err = error as { message?: string; context?: { status?: number; json?: () => Promise<unknown> } };
  const status = err?.context?.status;

  let body: unknown = null;
  try {
    if (err?.context?.json) body = await err.context.json();
  } catch {
    /* empty or non-JSON body — the status and message are enough */
  }

  let code = codeOf(body, "network_error");
  let message = messageOf(body, err?.message || `The publishing engine rejected "${action}".`);

  if (status === 404 && code === "network_error") {
    // Not the engine's own `not_found` (that means "that company isn't yours"):
    // nothing is deployed at this path.
    code = "engine_unreachable";
    message = "No publishing engine is reachable on this backend.";
  } else if (status === 401) {
    code = "unauthorized";
  } else if (status === undefined) {
    code = "network_error";
  }

  return new PartnerSocialError(code, message, status);
}

// ── Transport ────────────────────────────────────────────────────────────────

/**
 * One-shot call to the engine gateway. Throws {@link PartnerSocialError} on
 * transport failure, on a non-2xx response, and on a 200 carrying a failure
 * shape — so callers only ever handle success.
 */
export async function partnerSocial<T = unknown>(
  action: PartnerAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const { data, error } = await supabase.functions.invoke("partner-social", {
    body: { action, payload },
    headers,
  });

  if (error) throw await errorFromInvoke(error, action);

  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const failed =
      rec.ok === false ||
      (rec.error !== undefined && rec.error !== null && rec.error !== false);
    if (failed) {
      throw new PartnerSocialError(
        codeOf(data, "invalid_request"),
        `${action}: ${messageOf(data, "The publishing engine rejected the request.")}`,
      );
    }
  }

  return data as T;
}

/** The engine's collection key isn't restated here yet — read it leniently. */
function pickArray<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    for (const key of keys) {
      const value = rec[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

function normalizeBusiness(raw: unknown): PartnerBusiness {
  const rec = (raw ?? {}) as Record<string, unknown>;
  const channels = Array.isArray(rec.channels) ? (rec.channels as PartnerChannel[]) : [];
  const flagged = Array.isArray(rec.needs_reconnect_platforms)
    ? (rec.needs_reconnect_platforms as string[])
    : channels.filter((c) => c?.needs_reconnect).map((c) => c.platform);
  return {
    ...(rec as unknown as PartnerBusiness),
    business_ref: String(rec.business_ref ?? rec.external_ref ?? ""),
    channels,
    needs_reconnect_platforms: flagged,
  };
}

// ── Look-ups ─────────────────────────────────────────────────────────────────

/** The companies this signed-in member may act for. Archived ones are excluded. */
export async function listBusinesses(): Promise<PartnerBusiness[]> {
  const data = await partnerSocial<unknown>("list_businesses");
  return pickArray<unknown>(data, "businesses", "companies", "items")
    .map(normalizeBusiness)
    .filter((b) => b.business_ref && !b.is_archived);
}

/** Channels, available platforms and upcoming platforms for one company. */
export async function listChannels(businessRef: string): Promise<ChannelSnapshot> {
  const data = await partnerSocial<Record<string, unknown>>("list_channels", {
    business_ref: businessRef,
  });
  const channels = pickArray<PartnerChannel>(data, "channels", "connections");
  return {
    business_ref: businessRef,
    channels,
    available_platforms: pickArray<string>(data, "available_platforms"),
    upcoming_platforms: pickArray<string>(data, "upcoming_platforms"),
    needs_reconnect_platforms: pickArray<string>(data, "needs_reconnect_platforms"),
  };
}

// ── Connect ──────────────────────────────────────────────────────────────────

/**
 * Begins a connect. The provider returns the browser to **OneProfile's**
 * callback, not to this dashboard, so there is no cross-origin handshake and no
 * `postMessage`: open the returned URL, then poll {@link listChannels} until the
 * platform appears. That poll is the only completion signal.
 */
export async function startConnect(businessRef: string, platform: string): Promise<string> {
  const data = await partnerSocial<Record<string, unknown>>("start_connect", {
    business_ref: businessRef,
    platform,
  });
  const authUrl = data.authUrl ?? data.auth_url ?? data.url;
  if (typeof authUrl !== "string" || !authUrl) {
    throw new PartnerSocialError("invalid_request", "The engine returned no authorisation URL.");
  }
  return authUrl;
}

/**
 * Removes a channel. One Meta grant backs both Facebook and Instagram, so
 * disconnecting either removes the pair — the reply says exactly what went.
 */
export async function disconnectChannel(
  businessRef: string,
  platform: string,
): Promise<{ removed: string[] }> {
  const data = await partnerSocial<unknown>("disconnect_channel", {
    business_ref: businessRef,
    platform,
  });
  return { removed: pickArray<string>(data, "removed", "removed_platforms", "disconnected") };
}

// ── Client book (role = admin) ───────────────────────────────────────────────

/**
 * Mirrors the agency's whole client book. All-or-nothing: refs absent from the
 * payload are **archived, never deleted**, so a partial payload archives the
 * rest. An empty array is a no-op by design.
 */
export async function syncBusinesses(businesses: SyncBusinessInput[]): Promise<SyncBusinessesResult> {
  const data = await partnerSocial<unknown>("sync_businesses", { businesses });
  return {
    businesses: pickArray<unknown>(data, "businesses", "companies", "items").map(normalizeBusiness),
    archived: pickArray<string>(data, "archived", "archived_refs"),
  };
}

// ── Publishing ───────────────────────────────────────────────────────────────

/**
 * Registers media and returns the CDN URL to pass as `media`. The accepted
 * fields are the ones listed in `partner-social-api.md` § Media, so they are
 * forwarded as given rather than guessed here.
 */
export async function registerMedia(
  businessRef: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const data = await partnerSocial<Record<string, unknown>>("register_media", {
    business_ref: businessRef,
    ...fields,
  });
  const url = data.url ?? data.cdn_url ?? data.media;
  if (typeof url !== "string" || !url) {
    throw new PartnerSocialError("invalid_request", "The engine returned no media URL.");
  }
  return url;
}

/** Publishes now, or queues when `scheduledFor` is set. Returns per-platform results. */
export async function createPost(input: CreatePostInput): Promise<{ results: PlatformResult[] }> {
  const data = await partnerSocial<unknown>("create_post", {
    business_ref: input.businessRef,
    platforms: input.platforms,
    content: input.content,
    ...(input.media ? { media: input.media } : {}),
    ...(input.scheduledFor ? { scheduled_for: input.scheduledFor } : {}),
  });
  return { results: pickArray<PlatformResult>(data, "results", "responses", "replies") };
}

/** One row per platform: a two-platform post is two rows. */
export async function listPosts(businessRef: string): Promise<PartnerPost[]> {
  const data = await partnerSocial<unknown>("list_posts", { business_ref: businessRef });
  return pickArray<PartnerPost>(data, "posts", "items", "results");
}

/** Cancels a still-pending scheduled post. */
export async function cancelPost(businessRef: string, postId: string): Promise<void> {
  await partnerSocial("cancel_post", { business_ref: businessRef, post_id: postId });
}
