// OneProfile `partner-social` — the agency client-publishing engine.
//
// OneProfile hosts the engine, the OAuth apps and every provider token. This
// dashboard is a window onto it: it never reads the engine's tables, never holds
// a provider credential and never publishes directly. Every helper below is one
// action against the engine, authorised by the anon key plus the signed-in
// session JWT.
//
// Scope is always re-derived server-side from the session (membership in
// `cw_agency_members`, not `partner_members`), so `business_ref` and `agency_id`
// *select* a row but never authorise one — another agency's reference answers
// `not_found`, exactly like one that does not exist.
//
// Contract, per partner-social-api.md:
//   - the envelope is FLAT — fields are siblings of `action`, never nested;
//   - every response is `{ ok: true, ... }` or `{ ok: false, error: "<code>" }`;
//   - top-level field names are snake_case, but `create_post` results and the
//     `register_media` fields are camelCase.

import { supabase } from "@/integrations/supabase/client";

export type PartnerPlatform =
  | "linkedin"
  | "facebook"
  | "instagram"
  | "bluesky"
  | "tiktok";

export type PartnerAction =
  | "list_businesses"
  | "get_business"
  | "sync_businesses"
  | "list_channels"
  | "check_connection"
  | "start_connect"
  | "disconnect_channel"
  | "create_post"
  | "list_posts"
  | "get_post"
  | "cancel_post"
  | "register_media";

export type PostStatus = "pending" | "publishing" | "published" | "failed" | "cancelled";

/** Which account the grant posts as. `organization` is the company Page. */
export type AccountType = "organization" | "personal";

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

/**
 * A client company. It is never public: no profile row, no username, no login,
 * no public page — privacy is structural.
 *
 * Note the naming split: the row's `id` is the engine's own, while every other
 * call names the company by the dashboard's client id, `external_ref`.
 */
export interface PartnerBusiness {
  id: string;
  partner_slug: string;
  agency_id: string;
  /** the dashboard's client id; every other action passes it as `business_ref`. */
  external_ref: string;
  name: string;
  status: string;
  created_at?: string;
  /** present on `list_businesses` rows only. */
  connected_platforms?: string[];
  needs_reconnect_platforms?: string[];
}

/** One connected (or revoked) platform for a client company. */
export interface PartnerChannel {
  platform: string;
  handle: string | null;
  display_name: string | null;
  profile_url: string | null;
  /** false once disconnected — a deliberate disconnect is not a revocation. */
  is_active: boolean;
  /** the provider revoked the grant: reconnect, and exactly one notice was sent. */
  needs_reconnect: boolean;
  account_type: AccountType | null;
  connected_at?: string | null;
  last_checked_at?: string | null;
}

/** `list_channels` — the only completion signal for a connect. */
export interface ChannelSnapshot {
  business_ref: string;
  channels: PartnerChannel[];
  available_platforms: string[];
  upcoming_platforms: string[];
  unconnected_platforms: string[];
}

/** Per-platform outcome. A post succeeds if at least one platform did. */
export interface PlatformResult {
  platform: string;
  ok: boolean;
  /** camelCase, unlike the top-level fields. */
  postId: string | null;
  scheduledFor: string | null;
  error: string | null;
}

/** One row per platform: a two-platform post is two rows. */
export interface PartnerPost {
  id: string;
  platform: string;
  status: PostStatus | (string & {});
  excerpt: string | null;
  image_url: string | null;
  scheduled_for: string | null;
  published_post_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MediaAsset {
  id: string;
  /** the CDN URL to pass as `media` on `create_post`. */
  originalUrl: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  [field: string]: unknown;
}

export interface MediaValidation {
  valid: boolean;
  errors: string[];
}

export interface ConnectionCheck {
  business_ref: string;
  platform: string;
  /** true only when the channel is active AND not flagged for reconnect. */
  connected: boolean;
  channel: PartnerChannel | null;
}

// ── Requests ─────────────────────────────────────────────────────────────────

export interface CreatePostInput {
  businessRef: string;
  /** 1–5 platforms. */
  platforms: string[];
  /** ≤ 10,000 characters. */
  content: string;
  /** at most one image; a second is rejected as `too_many_media`. */
  media?: string | null;
  /** ISO timestamp, must be in the future — omit to publish now. */
  scheduledFor?: string | null;
}

export interface ListPostsInput {
  businessRef: string;
  /** default 25, max 100. */
  limit?: number;
  status?: PostStatus | (string & {});
}

export interface ListBusinessesOptions {
  /** admin only; omit `agencyId` for the whole partner book. */
  partnerSlug?: string;
  agencyId?: string;
}

export interface SyncBusinessInput {
  /** ≤ 200 chars. */
  external_ref: string;
  /** ≤ 300 chars. */
  name: string;
}

export interface SyncBusinessesInput {
  agencyId?: string;
  /** ≤ 500 rows; an empty array is a no-op by design. */
  businesses: SyncBusinessInput[];
}

export interface SyncBusinessesResult {
  businesses: PartnerBusiness[];
  /** how many refs were archived — absent refs are archived, never deleted. */
  archived: number;
}

export interface RegisterMediaInput {
  businessRef: string;
  base64: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  thumbnailBase64?: string;
  durationMs?: number;
  codecs?: string;
}

export interface CreatePostResult {
  /** true when the post was queued rather than published now. */
  scheduled: boolean;
  results: PlatformResult[];
  /** set when the call failed outright — read `results` for the per-platform detail. */
  error: PartnerErrorCode | null;
}

// ── Errors ───────────────────────────────────────────────────────────────────

/** Every code the engine documents, plus the codes this client adds itself. */
export const DOCUMENTED_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "partner_not_approved",
  "admin_required",
  "not_found",
  "business_ref_required",
  "businesses_required",
  "invalid_business",
  "too_many_businesses",
  "platform_required",
  "platform_not_supported",
  "platform_not_available_yet",
  "content_required",
  "content_too_long",
  "platforms_required",
  "too_many_platforms",
  "too_many_media",
  "invalid_scheduled_for",
  "scheduled_for_must_be_future",
  "post_id_required",
  "invalid_action",
  "not_cancellable",
  "connect_failed",
  "publish_failed",
  "media_upload_failed",
] as const;

const DOCUMENTED = new Set<string>(DOCUMENTED_ERROR_CODES);

export type PartnerErrorCode =
  | (typeof DOCUMENTED_ERROR_CODES)[number]
  /** the engine answered `ok:false` with text rather than one of its codes. */
  | "provider_error"
  /** no `partner-social` function answered on this backend (handoff §0). */
  | "engine_unreachable"
  /** the request never reached a backend at all. */
  | "network_error"
  /** client-side sanity failure, raised before any call. */
  | "invalid_request"
  | (string & {});

export class PartnerSocialError extends Error {
  readonly code: PartnerErrorCode;
  readonly status?: number;
  /** The engine's response body, when one came back — kept for verbatim debugging. */
  readonly body?: unknown;

  constructor(code: PartnerErrorCode, message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "PartnerSocialError";
    this.code = code;
    this.status = status;
    this.body = body;
  }

  /** `code` with its HTTP status, for surfacing verbatim during development. */
  get detail(): string {
    return this.status ? `${this.code} · HTTP ${this.status}` : this.code;
  }
}

export function isPartnerSocialError(e: unknown): e is PartnerSocialError {
  return e instanceof PartnerSocialError;
}

/**
 * `error` carries a code for every engine failure except the three provider
 * passthroughs (`connect_failed`, `publish_failed`, `media_upload_failed`),
 * where the provider's own message is placed there instead. Keeping those
 * distinct is what stops a provider's prose being mistaken for a code.
 */
function failureFromBody(data: unknown): PartnerSocialError | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  const raw = typeof rec.error === "string" && rec.error ? rec.error : null;
  if (rec.ok !== false && !raw) return null;

  if (raw && DOCUMENTED.has(raw)) return new PartnerSocialError(raw, raw, undefined, data);
  if (raw) return new PartnerSocialError("provider_error", raw, undefined, data);
  return new PartnerSocialError(
    "unknown_error",
    "The engine answered ok:false with no error text.",
    undefined,
    data,
  );
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

  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const raw = rec && typeof rec.error === "string" && rec.error ? rec.error : null;
  if (raw && DOCUMENTED.has(raw)) return new PartnerSocialError(raw, raw, status, body);

  // A deployed engine refuses an unauthorised probe with its *own* JSON body,
  // which proves it executed; a missing function answers a gateway-level
  // not-found instead. That difference is the fastest wiring-vs-deployment test
  // (handoff §0), so the two must stay distinct.
  if (status === 404) {
    return new PartnerSocialError(
      "engine_unreachable",
      'No publishing engine answered for "partner-social".',
      status,
      body,
    );
  }

  if (raw) return new PartnerSocialError("provider_error", raw, status, body);
  return new PartnerSocialError(
    status === 401 ? "unauthorized" : "network_error",
    err?.message || `The engine rejected "${action}".`,
    status,
    body,
  );
}

// ── Transport ────────────────────────────────────────────────────────────────

/**
 * One-shot call to the engine gateway. Throws {@link PartnerSocialError} on
 * transport failure, on a non-2xx response, and on a 200 carrying `ok: false` —
 * so callers only ever handle success.
 */
export async function partnerSocial<T = unknown>(
  action: PartnerAction,
  fields: Record<string, unknown> = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  // The envelope is flat: fields are siblings of `action`, never nested.
  const { data, error } = await supabase.functions.invoke("partner-social", {
    body: { action, ...fields },
    headers,
  });

  if (error) throw await errorFromInvoke(error, action);
  const failure = failureFromBody(data);
  if (failure) throw failure;

  return data as T;
}

// ── Look-ups ─────────────────────────────────────────────────────────────────

/**
 * The companies this signed-in member may act for — their own agency's book
 * only. There is no cross-agency view from a dashboard session.
 */
export async function listBusinesses(
  options: ListBusinessesOptions = {},
): Promise<PartnerBusiness[]> {
  const data = await partnerSocial<{ businesses?: PartnerBusiness[] }>("list_businesses", {
    ...(options.partnerSlug ? { partner_slug: options.partnerSlug } : {}),
    ...(options.agencyId ? { agency_id: options.agencyId } : {}),
  });
  return data.businesses ?? [];
}

/** The same row without the channel arrays. */
export async function getBusiness(businessRef: string): Promise<PartnerBusiness | null> {
  const data = await partnerSocial<{ business?: PartnerBusiness }>("get_business", {
    business_ref: businessRef,
  });
  return data.business ?? null;
}

/** Channels, connectable platforms and platforms the engine cannot do yet. */
export async function listChannels(businessRef: string): Promise<ChannelSnapshot> {
  const data = await partnerSocial<Partial<ChannelSnapshot>>("list_channels", {
    business_ref: businessRef,
  });
  return {
    business_ref: data.business_ref ?? businessRef,
    channels: data.channels ?? [],
    available_platforms: data.available_platforms ?? [],
    upcoming_platforms: data.upcoming_platforms ?? [],
    unconnected_platforms: data.unconnected_platforms ?? [],
  };
}

/** Probes one platform's health without publishing anything. */
export async function checkConnection(
  businessRef: string,
  platform: string,
): Promise<ConnectionCheck> {
  const data = await partnerSocial<Partial<ConnectionCheck>>("check_connection", {
    business_ref: businessRef,
    platform,
  });
  return {
    business_ref: data.business_ref ?? businessRef,
    platform: data.platform ?? platform,
    connected: Boolean(data.connected),
    channel: data.channel ?? null,
  };
}

// ── Connect ──────────────────────────────────────────────────────────────────

/**
 * Begins a connect and returns the provider URL to open. The provider returns
 * the browser to **OneProfile's** callback, not to this dashboard — the flow is
 * identified only by a `biz_` prefix on the OAuth state, which the engine mints
 * server-side and nothing in the URL identifies the client. So there is no
 * cross-origin handshake and no `postMessage`: open the URL, then poll
 * {@link listChannels} until the platform appears. That poll is the only
 * completion signal.
 */
export async function startConnect(businessRef: string, platform: string): Promise<string> {
  const data = await partnerSocial<{ authUrl?: string }>("start_connect", {
    business_ref: businessRef,
    platform,
  });
  if (!data.authUrl) {
    throw new PartnerSocialError("invalid_request", "The engine returned no authUrl.");
  }
  return data.authUrl;
}

/**
 * Removes a channel, returning exactly what went. One Meta grant backs both
 * Facebook and Instagram, so disconnecting either removes the pair. A deliberate
 * disconnect is not a revocation: no reconnect flag, no notice.
 */
export async function disconnectChannel(
  businessRef: string,
  platform: string,
): Promise<string[]> {
  const data = await partnerSocial<{ disconnected?: string[] }>("disconnect_channel", {
    business_ref: businessRef,
    platform,
  });
  return data.disconnected ?? [];
}

// ── Client book (role = admin) ───────────────────────────────────────────────

/**
 * Mirrors the agency's whole client book — all-or-nothing. Refs absent from the
 * payload are **archived, never deleted**, so send the complete book on every
 * call: a partial payload archives the rest. An empty array is a no-op.
 */
export async function syncBusinesses(
  input: SyncBusinessesInput,
): Promise<SyncBusinessesResult> {
  const data = await partnerSocial<{
    businesses?: PartnerBusiness[];
    archived?: number;
  }>("sync_businesses", {
    ...(input.agencyId ? { agency_id: input.agencyId } : {}),
    businesses: input.businesses,
  });
  return { businesses: data.businesses ?? [], archived: data.archived ?? 0 };
}

// ── Media and publishing ─────────────────────────────────────────────────────

/** Uploads media and returns the asset whose `originalUrl` is the `media` value. */
export async function registerMedia(
  input: RegisterMediaInput,
): Promise<{ media: MediaAsset; validation: MediaValidation }> {
  const { businessRef, ...fields } = input;
  const data = await partnerSocial<{ media?: MediaAsset; validation?: MediaValidation }>(
    "register_media",
    { business_ref: businessRef, ...fields },
  );
  if (!data.media) {
    throw new PartnerSocialError("media_upload_failed", "The engine returned no media asset.");
  }
  return { media: data.media, validation: data.validation ?? { valid: false, errors: [] } };
}

/**
 * Publishes now, or queues when `scheduledFor` is set. Publishing succeeds when
 * at least one platform did, so always read `results` per platform — never as a
 * single pass/fail.
 *
 * When nothing published the engine answers `ok: false`, but it may still carry
 * the per-platform rows; those are salvaged here rather than thrown away, so a
 * total failure can be reported per platform too.
 */
export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  try {
    const data = await partnerSocial<{ scheduled?: boolean; results?: PlatformResult[] }>(
      "create_post",
      {
        business_ref: input.businessRef,
        platforms: input.platforms,
        content: input.content,
        ...(input.media ? { media: input.media } : {}),
        ...(input.scheduledFor ? { scheduled_for: input.scheduledFor } : {}),
      },
    );
    return {
      scheduled: Boolean(data.scheduled),
      results: Array.isArray(data.results) ? data.results : [],
      error: null,
    };
  } catch (e) {
    if (isPartnerSocialError(e)) {
      const results = resultsFromBody(e.body);
      if (results.length) return { scheduled: false, results, error: e.code };
    }
    throw e;
  }
}

function resultsFromBody(body: unknown): PlatformResult[] {
  if (body && typeof body === "object") {
    const results = (body as Record<string, unknown>).results;
    if (Array.isArray(results)) return results as PlatformResult[];
  }
  return [];
}

/** One row per platform — group by `scheduled_for` to render one post as a card. */
export async function listPosts(input: ListPostsInput): Promise<PartnerPost[]> {
  const data = await partnerSocial<{ posts?: PartnerPost[] }>("list_posts", {
    business_ref: input.businessRef,
    ...(input.limit ? { limit: input.limit } : {}),
    ...(input.status ? { status: input.status } : {}),
  });
  return data.posts ?? [];
}

/** The full post, content included. */
export async function getPost(businessRef: string, postId: string): Promise<PartnerPost | null> {
  const data = await partnerSocial<{ post?: PartnerPost }>("get_post", {
    business_ref: businessRef,
    post_id: postId,
  });
  return data.post ?? null;
}

/** Cancels a still-pending post; `not_cancellable` once the worker claims it. */
export async function cancelPost(
  businessRef: string,
  postId: string,
): Promise<{ id: string; platform: string; status: string } | null> {
  const data = await partnerSocial<{ post?: { id: string; platform: string; status: string } }>(
    "cancel_post",
    { business_ref: businessRef, post_id: postId },
  );
  return data.post ?? null;
}
