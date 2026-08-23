// Social Syndication gateway — native LinkedIn + Meta (Facebook/Instagram) OAuth
// publishing, consolidated into one action-based backend function (matching this
// project's bunny-rpc / social-rpc convention). The skill's `profiles` concept is
// mapped to `agency_id`: the caller's agency is resolved server-side (resolveCtx),
// and every token/connection/scheduled row is agency-scoped.
//
// Actions:
//   connect.start / connect.finalize / connect.select
//   connection.list / connection.check / connection.disconnect
//   post.publish / post.schedule
//   scheduled.list / scheduled.cancel

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CONFIG: set these for the target project ───────────────────────────────
const CONFIG = {
  appName: "CityWide Digital",
  appDomain: "dashboard.citywidedigital.ca",
  linkedinCallbackUrl: "https://dashboard.citywidedigital.ca/auth/linkedin/callback",
  metaCallbackUrl: "https://dashboard.citywidedigital.ca/auth/meta/callback",
  reconnectUrl: "https://dashboard.citywidedigital.ca/dashboard/social/calendar?tab=accounts",
  fromEmail: "reviews@citywidedigital.ca",
  companyLinkedinUrl: "https://www.linkedin.com/company/citywidedigital/", // nullable
  adminEmail: "alan@citywidedigital.ca", // reconnect email recipient (agency-wide model)
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const THROTTLE_MS = 5 * 60 * 1000; // health check throttle
const NL = String.fromCharCode(10);

// Last-month Linkedin-Version header.
function linkedInVersionHeader(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function slugify(input: string): string {
  return input.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "update";
}

// ── Bunny (CRM) agency-membership lookup ────────────────────────────────────
function bunnyHttpBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

type SqlValue = string | number | null;
async function bunnyQuery(sql: string, args: SqlValue[] = []): Promise<Array<Record<string, SqlValue>>> {
  const token = Deno.env.get("BUNNY_DB_AUTH_TOKEN");
  const base = bunnyHttpBase();
  if (!token || !base || base === "https://") return [];
  const res = await fetch(`${base}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: args.map((v) =>
              v === null || v === undefined
                ? { type: "null" }
                : typeof v === "number"
                ? { type: "integer", value: String(v) }
                : { type: "text", value: String(v) }
            ),
          },
        },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const result = data?.results?.[0]?.response?.result;
  const cols: string[] = result?.cols?.map((c: { name: string }) => c.name) ?? [];
  const rows = result?.rows ?? [];
  return rows.map((arr: Array<{ type: string; value?: string }>) => {
    const o: Record<string, SqlValue> = {};
    cols.forEach((c, i) => {
      const v = arr[i];
      if (!v || v.type === "null") o[c] = null;
      else if (v.type === "integer" || v.type === "float") o[c] = Number(v.value);
      else o[c] = v.value ?? null;
    });
    return o;
  });
}

interface SocialCtx { userId: string; agencyId: string; email: string | null; }

async function resolveCtx(req: Request): Promise<SocialCtx> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await authed.auth.getUser();
  if (userErr || !userData?.user) throw new Error("Not authenticated");
  const userId = userData.user.id;

  let agencyId = "citywide";
  try {
    const rows = await bunnyQuery("SELECT agency_id FROM agency_members WHERE user_id = ? LIMIT 1", [userId]);
    if (rows[0]?.agency_id) agencyId = rows[0].agency_id as string;
  } catch (e) {
    console.warn("[social-ctx] agency lookup failed, defaulting to citywide:", e instanceof Error ? e.message : e);
  }
  return { userId, agencyId, email: userData.user.email ?? null };
}

async function sendReconnectEmail(platform: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? CONFIG.fromEmail;
  if (!RESEND_API_KEY) { console.error("RESEND_API_KEY not configured — skipping reconnect email"); return; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: CONFIG.adminEmail,
        subject: `Reconnect your ${platform} to ${CONFIG.appName}`,
        html: `Hello, reconnect your ${platform} connection to ${CONFIG.appName}: <a href="${CONFIG.reconnectUrl}">${CONFIG.reconnectUrl}</a>`,
      }),
    });
    if (!res.ok) console.error("Resend reconnect email error:", res.status, await res.text());
  } catch (e) {
    console.error("Resend reconnect email failed:", e);
  }
}

function orgDisplayName(org: Record<string, unknown>): string {
  const localized = org.localizedName;
  if (typeof localized === "string" && localized.trim()) return localized;
  const nameObj = org.name as { localized?: Record<string, string> } | undefined;
  const locs = nameObj?.localized;
  if (locs && typeof locs === "object") {
    const first = Object.values(locs)[0];
    if (typeof first === "string" && first.trim()) return first;
  }
  return "";
}

// ── Platform publish helpers (agency-scoped, service-role) ──────────────────
function platformUrl(platform: string, externalId: string): string | null {
  if (platform === "linkedin") return `https://www.linkedin.com/feed/update/${externalId}/`;
  return null;
}

async function mirrorToPosts(db: ReturnType<typeof createClient>, agencyId: string, platform: string, text: string, imageUrl: string | null | undefined, externalId: string): Promise<void> {
  const marker = `${CONFIG.appName} →`;
  const originalText = (text.split(marker)[0] ?? "").trim();
  const firstLine = (originalText.split(NL)[0] ?? "").trim();
  const title = firstLine.length > 0 ? firstLine.slice(0, 80) : `${platform} Update — ${new Date().toISOString().slice(0, 10)}`;
  await db.from("social_posts").insert({
    agency_id: agencyId,
    platform,
    title,
    content: originalText,
    image_url: imageUrl ? String(imageUrl) : "",
    external_post_id: externalId,
    external_url: platformUrl(platform, externalId),
    published_at: new Date().toISOString(),
  });
}

async function disconnectMetaRevoked(db: ReturnType<typeof createClient>, agencyId: string): Promise<void> {
  const { data: prev } = await db
    .from("channel_connections")
    .select("needs_reconnect")
    .eq("agency_id", agencyId).eq("platform", "facebook")
    .maybeSingle();
  const wasNeedsReconnect = prev?.needs_reconnect === true;
  await db.from("channel_oauth_tokens").delete().eq("agency_id", agencyId).in("platform", ["facebook", "instagram"]);
  await db.from("channel_connections")
    .update({ is_active: false, needs_reconnect: true, last_checked_at: new Date().toISOString() })
    .eq("agency_id", agencyId).in("platform", ["facebook", "instagram"]);
  if (!wasNeedsReconnect) {
    try { await sendReconnectEmail("Facebook / Instagram"); } catch (e) { console.error("Reconnect email failed:", e); }
  }
}

async function disconnectLinkedInRevoked(db: ReturnType<typeof createClient>, agencyId: string): Promise<void> {
  const { data: prev } = await db
    .from("channel_connections")
    .select("needs_reconnect")
    .eq("agency_id", agencyId).eq("platform", "linkedin")
    .maybeSingle();
  const wasNeedsReconnect = prev?.needs_reconnect === true;
  await db.from("channel_oauth_tokens").delete().eq("agency_id", agencyId).eq("platform", "linkedin");
  await db.from("channel_connections")
    .update({ is_active: false, needs_reconnect: true, last_checked_at: new Date().toISOString() })
    .eq("agency_id", agencyId).eq("platform", "linkedin");
  if (!wasNeedsReconnect) {
    try { await sendReconnectEmail("LinkedIn"); } catch (e) { console.error("Reconnect email failed:", e); }
  }
}

async function publishToLinkedIn(db: ReturnType<typeof createClient>, agencyId: string, text: string, imageUrl: string | null): Promise<string> {
  const { data: tokenRow } = await db
    .from("channel_oauth_tokens")
    .select("access_token, person_urn, organization_urn, expires_at")
    .eq("agency_id", agencyId).eq("platform", "linkedin")
    .maybeSingle();
  if (!tokenRow) throw new Error("LinkedIn is not connected");
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) throw new Error("LinkedIn connection has expired");

  const accessToken = tokenRow.access_token as string;
  const personUrn = tokenRow.person_urn as string;
  const author = (tokenRow.organization_urn as string | null) || personUrn;

  let imageUrn: string | undefined;
  if (imageUrl && String(imageUrl).trim()) {
    const registerRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0", "LinkedIn-Version": linkedInVersionHeader() },
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    if (!registerRes.ok) {
      if (registerRes.status === 401) await disconnectLinkedInRevoked(db, agencyId);
      throw new Error(`Failed to register image upload: ${await registerRes.text()}`);
    }
    const registerData = await registerRes.json();
    const uploadUrl = registerData.value?.uploadUrl;
    imageUrn = registerData.value?.image;
    if (!uploadUrl || !imageUrn) throw new Error("LinkedIn did not return an upload target");

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error("Could not fetch the featured image to upload");
    const imageBytes = await imageRes.arrayBuffer();
    const uploadRes = await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}` }, body: imageBytes });
    if (!uploadRes.ok) throw new Error(`Failed to upload image to LinkedIn: ${await uploadRes.text()}`);
  }

  const postBody: Record<string, unknown> = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(imageUrn ? { content: { media: { id: imageUrn } } } : {}),
  };

  const postRes = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0", "LinkedIn-Version": linkedInVersionHeader() },
    body: JSON.stringify(postBody),
  });
  if (!postRes.ok) {
    if (postRes.status === 401) await disconnectLinkedInRevoked(db, agencyId);
    throw new Error(`Failed to publish post to LinkedIn: ${await postRes.text()}`);
  }
  return postRes.headers.get("x-restli-id") ?? "";
}

async function publishToFacebook(db: ReturnType<typeof createClient>, agencyId: string, text: string, imageUrl: string | null): Promise<string> {
  const { data: tokenRow } = await db
    .from("channel_oauth_tokens")
    .select("access_token, page_id")
    .eq("agency_id", agencyId).eq("platform", "facebook")
    .maybeSingle();
  if (!tokenRow || !tokenRow.page_id) throw new Error("Facebook is not connected");

  const accessToken = tokenRow.access_token as string;
  const pageId = tokenRow.page_id as string;

  let postId: string;
  if (imageUrl && String(imageUrl).trim()) {
    const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl, caption: text, access_token: accessToken }),
    });
    const photoData = await photoRes.json();
    if (photoData.error) {
      if (photoData.error.code === 190) await disconnectMetaRevoked(db, agencyId);
      throw new Error(`Facebook photo post failed: ${photoData.error.message}`);
    }
    postId = photoData.id;
  } else {
    const feedRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, access_token: accessToken }),
    });
    const feedData = await feedRes.json();
    if (feedData.error) {
      if (feedData.error.code === 190) await disconnectMetaRevoked(db, agencyId);
      throw new Error(`Facebook feed post failed: ${feedData.error.message}`);
    }
    postId = feedData.id;
  }
  return postId;
}

async function publishToInstagram(db: ReturnType<typeof createClient>, agencyId: string, text: string, imageUrl: string | null): Promise<string> {
  if (!imageUrl || !String(imageUrl).trim()) throw new Error("Instagram requires an image");

  const { data: tokenRow } = await db
    .from("channel_oauth_tokens")
    .select("access_token, ig_user_id")
    .eq("agency_id", agencyId).eq("platform", "instagram")
    .maybeSingle();
  if (!tokenRow || !tokenRow.ig_user_id) throw new Error("Instagram is not connected");

  const accessToken = tokenRow.access_token as string;
  const igUserId = tokenRow.ig_user_id as string;

  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption: text, access_token: accessToken }),
  });
  const containerData = await containerRes.json();
  if (containerData.error) {
    if (containerData.error.code === 190) await disconnectMetaRevoked(db, agencyId);
    throw new Error(`Instagram container creation failed: ${containerData.error.message}`);
  }
  const containerId = containerData.id;

  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) {
    if (publishData.error.code === 190) await disconnectMetaRevoked(db, agencyId);
    throw new Error(`Instagram publish failed: ${publishData.error.message}`);
  }
  return publishData.id;
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const { action, payload = {} } = body as { action: string; payload: Record<string, unknown> };

    switch (action) {

      // ── Connect: start OAuth ──────────────────────────────────────────────
      case "connect.start": {
        const ctx = await resolveCtx(req);
        const platform = payload.platform as string;
        if (platform !== "linkedin" && platform !== "meta") throw new Error("platform must be 'linkedin' or 'meta'");

        const state = crypto.randomUUID();
        const { error: stateErr } = await db.from("oauth_states").insert({
          state, agency_id: ctx.agencyId, platform,
        });
        if (stateErr) throw new Error(`Failed to create OAuth state: ${stateErr.message}`);

        let authUrl: string;
        if (platform === "linkedin") {
          const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
          if (!clientId) throw new Error("LINKEDIN_CLIENT_ID not configured");
          const params = new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: CONFIG.linkedinCallbackUrl,
            state,
            scope: "openid profile email w_member_social",
          });
          authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
        } else {
          const metaAppId = Deno.env.get("META_APP_ID");
          if (!metaAppId) throw new Error("META_APP_ID not configured");
          const scopes = [
            "pages_show_list", "pages_read_engagement", "pages_manage_posts",
            "instagram_basic", "instagram_content_publish", "business_management",
          ].join(",");
          authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
            `client_id=${metaAppId}` +
            `&redirect_uri=${encodeURIComponent(CONFIG.metaCallbackUrl)}` +
            `&state=${state}` +
            `&scope=${scopes}`;
        }
        return json({ ok: true, authUrl });
      }

      // ── Connect: finalize OAuth (code + state) ────────────────────────────
      case "connect.finalize": {
        const platform = payload.platform as string;
        const { code, state } = payload as { code: string; state: string };
        if (!code || !state) throw new Error("code and state are required");
        if (platform !== "linkedin" && platform !== "meta") throw new Error("platform must be 'linkedin' or 'meta'");

        const { data: stateRow, error: stateErr } = await db
          .from("oauth_states")
          .select("agency_id, platform, created_at")
          .eq("state", state)
          .maybeSingle();
        if (stateErr || !stateRow) throw new Error("Invalid or expired connection attempt. Please try again.");
        await db.from("oauth_states").delete().eq("state", state); // one-time use
        if (stateRow.platform !== platform) throw new Error("Invalid connection attempt. Please try again.");
        if (Date.now() - new Date(stateRow.created_at).getTime() > STATE_TTL_MS) {
          throw new Error("This connection attempt has expired. Please try again.");
        }
        const agencyId = stateRow.agency_id as string;

        if (platform === "linkedin") {
          const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
          const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
          if (!clientId || !clientSecret) throw new Error("LinkedIn credentials not configured");

          const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code", code,
              redirect_uri: CONFIG.linkedinCallbackUrl,
              client_id: clientId, client_secret: clientSecret,
            }),
          });
          if (!tokenRes.ok) throw new Error("Failed to exchange authorization code with LinkedIn.");
          const tokenData = await tokenRes.json();
          const accessToken: string = tokenData.access_token;
          const expiresInSec: number = tokenData.expires_in ?? 0;
          if (!accessToken) throw new Error("LinkedIn did not return an access token.");

          const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!userinfoRes.ok) throw new Error("Failed to fetch LinkedIn member profile.");
          const userinfo = await userinfoRes.json();
          const sub: string = userinfo.sub;
          const displayName: string = userinfo.name ?? "";
          const email: string = userinfo.email ?? "";
          if (!sub) throw new Error("LinkedIn did not return a member identifier.");

          const personUrn = `urn:li:person:${sub}`;
          const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

          await db.from("channel_oauth_tokens").upsert(
            {
              agency_id: agencyId, platform: "linkedin", access_token: accessToken,
              person_urn: personUrn, organization_urn: null,
              expires_at: expiresAt, updated_at: new Date().toISOString(),
            },
            { onConflict: "agency_id,platform" },
          );
          await db.from("channel_connections").upsert(
            {
              agency_id: agencyId, platform: "linkedin", handle: email,
              display_name: displayName, profile_url: "", is_active: true,
              needs_reconnect: false, account_type: "personal",
              last_checked_at: new Date().toISOString(), connected_at: new Date().toISOString(),
            },
            { onConflict: "agency_id,platform" },
          );

          // Best-effort Company Pages list for the "post as" picker.
          const organizations: { urn: string; name: string }[] = [];
          try {
            const aclsRes = await fetch(
              "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
              { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0", "Linkedin-Version": linkedInVersionHeader() } },
            );
            if (aclsRes.ok) {
              const aclsData = await aclsRes.json();
              const orgUrns: string[] = Array.from(new Set(
                (aclsData?.elements ?? [])
                  .map((e: { organizationTarget?: string; organization?: string }) => e.organizationTarget ?? e.organization)
                  .filter((u: string | undefined): u is string => typeof u === "string" && u.length > 0),
              ));
              if (orgUrns.length > 0) {
                const orgIds = orgUrns.map((u) => u.split(":").pop()!).filter(Boolean);
                const namesMap: Record<string, string> = {};
                const namesRes = await fetch(
                  `https://api.linkedin.com/rest/organizations?ids=List(${orgIds.join(",")})`,
                  { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0", "Linkedin-Version": linkedInVersionHeader() } },
                );
                if (namesRes.ok) {
                  const namesData = await namesRes.json();
                  const results = namesData?.results ?? {};
                  for (const [key, val] of Object.entries(results)) {
                    const name = orgDisplayName(val as Record<string, unknown>);
                    if (name) namesMap[key] = name;
                  }
                }
                for (const urn of orgUrns) {
                  const id = urn.split(":").pop()!;
                  organizations.push({ urn, name: namesMap[id] || urn });
                }
              }
            }
          } catch (orgErr) {
            console.error("linkedin organization lookup failed:", orgErr instanceof Error ? orgErr.message : orgErr);
          }

          return json({ ok: true, displayName, handle: email, organizations, agency_id: agencyId });
        }

        // ── Meta ──
        const metaAppId = Deno.env.get("META_APP_ID");
        const metaAppSecret = Deno.env.get("META_APP_SECRET");
        if (!metaAppId || !metaAppSecret) throw new Error("Meta credentials not configured");

        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
          `client_id=${metaAppId}&redirect_uri=${encodeURIComponent(CONFIG.metaCallbackUrl)}` +
          `&client_secret=${metaAppSecret}&code=${code}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
        const shortLivedToken = tokenData.access_token;

        const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
          `grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}` +
          `&fb_exchange_token=${shortLivedToken}`;
        const longLivedRes = await fetch(longLivedUrl);
        const longLivedData = await longLivedRes.json();
        if (!longLivedData.access_token) throw new Error(`Long-lived token exchange failed: ${JSON.stringify(longLivedData)}`);
        const longLivedUserToken = longLivedData.access_token;

        const pages: { id: string; name: string; access_token: string }[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/accounts?limit=100&access_token=${longLivedUserToken}`;
        while (nextUrl) {
          const pagesRes = await fetch(nextUrl);
          const pagesData = await pagesRes.json();
          if (pagesData.error) throw new Error(`Failed to list Pages: ${pagesData.error.message}`);
          for (const page of pagesData.data ?? []) pages.push({ id: page.id, name: page.name, access_token: page.access_token });
          nextUrl = pagesData.paging?.next ?? null;
        }
        if (pages.length === 0) throw new Error("No Facebook Pages found for this user");

        return json({ ok: true, agency_id: agencyId, longLivedUserToken, pages });
      }

      // ── Connect: select "post as" account ─────────────────────────────────
      case "connect.select": {
        const platform = payload.platform as string;
        const agencyId = payload.agency_id as string;
        if (!agencyId) throw new Error("agency_id is required");

        if (platform === "linkedin") {
          const organizationUrn = (payload.organization_urn as string | null) ?? null;
          const organizationName = (payload.organization_name as string | null) ?? null;
          const isOrg = typeof organizationUrn === "string" && organizationUrn.length > 0;
          const { error: tokenErr } = await db
            .from("channel_oauth_tokens")
            .update({ organization_urn: isOrg ? organizationUrn : null, updated_at: new Date().toISOString() })
            .eq("agency_id", agencyId).eq("platform", "linkedin");
          if (tokenErr) throw new Error(`Failed to update LinkedIn token: ${tokenErr.message}`);
          const { error: connErr } = await db
            .from("channel_connections")
            .update({
              display_name: isOrg && organizationName ? organizationName : undefined,
              account_type: isOrg ? "organization" : "personal",
              last_checked_at: new Date().toISOString(),
            })
            .eq("agency_id", agencyId).eq("platform", "linkedin");
          if (connErr) throw new Error(`Failed to update LinkedIn connection: ${connErr.message}`);
          return json({ ok: true, accountType: isOrg ? "organization" : "personal" });
        }

        if (platform === "meta") {
          const { pageId, pageName, pageAccessToken } = payload as { pageId: string; pageName: string; pageAccessToken: string };
          if (!pageId || !pageName || !pageAccessToken) throw new Error("Missing required fields");

          const pageUrl = `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account,name,link&access_token=${pageAccessToken}`;
          const pageRes = await fetch(pageUrl);
          const pageData = await pageRes.json();
          if (pageData.error) throw new Error(`Failed to fetch Page details: ${pageData.error.message}`);
          const igUserId = pageData.instagram_business_account?.id || null;

          await db.from("channel_oauth_tokens").upsert(
            { agency_id: agencyId, platform: "facebook", access_token: pageAccessToken, page_id: pageId, ig_user_id: igUserId, updated_at: new Date().toISOString() },
            { onConflict: "agency_id,platform" },
          );
          if (igUserId) {
            await db.from("channel_oauth_tokens").upsert(
              { agency_id: agencyId, platform: "instagram", access_token: pageAccessToken, page_id: pageId, ig_user_id: igUserId, updated_at: new Date().toISOString() },
              { onConflict: "agency_id,platform" },
            );
          }
          await db.from("channel_connections").upsert(
            { agency_id: agencyId, platform: "facebook", handle: pageName, display_name: pageName, profile_url: pageData.link || "", is_active: true, needs_reconnect: false, last_checked_at: new Date().toISOString() },
            { onConflict: "agency_id,platform" },
          );
          if (igUserId) {
            await db.from("channel_connections").upsert(
              { agency_id: agencyId, platform: "instagram", handle: pageName, display_name: pageName, profile_url: pageData.link || "", is_active: true, needs_reconnect: false, last_checked_at: new Date().toISOString() },
              { onConflict: "agency_id,platform" },
            );
          }
          return json({ ok: true, facebookConnected: true, instagramConnected: !!igUserId });
        }
        throw new Error("platform must be 'linkedin' or 'meta'");
      }

      // ── Connection: list ──────────────────────────────────────────────────
      case "connection.list": {
        const ctx = await resolveCtx(req);
        const { data, error } = await db.from("channel_connections")
          .select("*").eq("agency_id", ctx.agencyId).order("platform", { ascending: true });
        if (error) throw new Error(error.message);
        return json({ ok: true, connections: data ?? [] });
      }

      // ── Connection: health check (throttled 5 min) ────────────────────────
      case "connection.check": {
        const ctx = await resolveCtx(req);
        const platform = payload.platform as string;
        if (platform !== "linkedin" && platform !== "meta") throw new Error("platform must be 'linkedin' or 'meta'");
        const connPlatform = platform === "meta" ? "facebook" : "linkedin";

        const { data: connRow } = await db.from("channel_connections")
          .select("is_active, needs_reconnect, last_checked_at")
          .eq("agency_id", ctx.agencyId).eq("platform", connPlatform)
          .maybeSingle();
        const lastChecked = connRow?.last_checked_at ? new Date(connRow.last_checked_at).getTime() : 0;
        if (Date.now() - lastChecked < THROTTLE_MS) {
          return json({ ok: true, throttled: true, nextCheckAt: new Date(lastChecked + THROTTLE_MS).toISOString() });
        }

        const { data: tokenRow } = await db.from("channel_oauth_tokens")
          .select("access_token, expires_at, page_id")
          .eq("agency_id", ctx.agencyId).eq("platform", connPlatform)
          .maybeSingle();
        if (!tokenRow) {
          return json({ ok: true, connected: false, needsReconnect: false });
        }

        const expiredByTime = tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date();
        let revoked = false;
        if (expiredByTime) {
          revoked = true;
        } else if (platform === "linkedin") {
          const probe = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenRow.access_token}` },
          });
          if (probe.status === 401) revoked = true;
        } else if (tokenRow.page_id) {
          const probe = await fetch(`https://graph.facebook.com/v19.0/${tokenRow.page_id}?fields=id&access_token=${tokenRow.access_token}`);
          const probeData = await probe.json();
          if (probeData.error) revoked = true;
        }

        const nowIso = new Date().toISOString();
        if (revoked) {
          const wasNeedsReconnect = connRow?.needs_reconnect === true;
          if (platform === "meta") {
            await db.from("channel_oauth_tokens").delete().eq("agency_id", ctx.agencyId).in("platform", ["facebook", "instagram"]);
            await db.from("channel_connections").update({ is_active: false, needs_reconnect: true, last_checked_at: nowIso })
              .eq("agency_id", ctx.agencyId).in("platform", ["facebook", "instagram"]);
          } else {
            await db.from("channel_oauth_tokens").delete().eq("agency_id", ctx.agencyId).eq("platform", "linkedin");
            await db.from("channel_connections").update({ is_active: false, needs_reconnect: true, last_checked_at: nowIso })
              .eq("agency_id", ctx.agencyId).eq("platform", "linkedin");
          }
          if (!wasNeedsReconnect) {
            try { await sendReconnectEmail(platform === "meta" ? "Facebook / Instagram" : "LinkedIn"); } catch (e) { console.error("Reconnect email failed:", e); }
          }
          return json({ ok: true, connected: false, needsReconnect: true });
        }

        await db.from("channel_connections").update({
          is_active: true, needs_reconnect: false, last_checked_at: nowIso,
        }).eq("agency_id", ctx.agencyId).eq("platform", connPlatform);
        return json({ ok: true, connected: true, needsReconnect: false });
      }

      // ── Connection: disconnect ────────────────────────────────────────────
      case "connection.disconnect": {
        const ctx = await resolveCtx(req);
        const platform = payload.platform as string;
        if (platform !== "linkedin" && platform !== "meta") throw new Error("platform must be 'linkedin' or 'meta'");

        if (platform === "meta") {
          await db.from("channel_oauth_tokens").delete().eq("agency_id", ctx.agencyId).in("platform", ["facebook", "instagram"]);
          await db.from("channel_connections").update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("agency_id", ctx.agencyId).in("platform", ["facebook", "instagram"]);
        } else {
          await db.from("channel_oauth_tokens").delete().eq("agency_id", ctx.agencyId).eq("platform", "linkedin");
          await db.from("channel_connections").update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("agency_id", ctx.agencyId).eq("platform", "linkedin");
        }
        return json({ ok: true });
      }

      // ── Publish now ───────────────────────────────────────────────────────
      case "post.publish": {
        const ctx = await resolveCtx(req);
        const platform = payload.platform as string;
        const content = String(payload.content ?? "");
        const imageUrl = (payload.imageUrl as string | null) ?? null;
        if (!content.trim()) throw new Error("Post content is required");
        if (!["linkedin", "facebook", "instagram"].includes(platform)) throw new Error("Unsupported platform");

        let postId: string;
        if (platform === "linkedin") postId = await publishToLinkedIn(db, ctx.agencyId, content, imageUrl);
        else if (platform === "facebook") postId = await publishToFacebook(db, ctx.agencyId, content, imageUrl);
        else postId = await publishToInstagram(db, ctx.agencyId, content, imageUrl);

        try {
          await mirrorToPosts(db, ctx.agencyId, platform, content, imageUrl, postId);
        } catch (mirrorErr) {
          console.error("social_posts mirror error:", mirrorErr);
        }
        return json({ ok: true, postId, platform });
      }

      // ── Schedule ──────────────────────────────────────────────────────────
      case "post.schedule": {
        const ctx = await resolveCtx(req);
        const platform = payload.platform as string;
        const content = String(payload.content ?? "");
        const imageUrl = (payload.imageUrl as string | null) ?? null;
        const scheduledFor = payload.scheduledFor as string;
        if (!["linkedin", "facebook", "instagram"].includes(platform)) throw new Error("Unsupported platform");
        if (!content.trim()) throw new Error("Post content is required");
        if (!scheduledFor) throw new Error("scheduledFor is required");
        if (platform === "instagram" && !imageUrl) throw new Error("Instagram requires an image");

        const scheduledDate = new Date(scheduledFor);
        if (isNaN(scheduledDate.getTime())) throw new Error("Invalid scheduledFor date");
        if (scheduledDate.getTime() <= Date.now()) throw new Error("Scheduled time must be in the future");

        const { data: tokenRow } = await db.from("channel_oauth_tokens")
          .select("expires_at").eq("agency_id", ctx.agencyId).eq("platform", platform).maybeSingle();
        if (!tokenRow) throw new Error(`${platform} is not connected. Please connect it first.`);
        if (platform === "linkedin" && tokenRow.expires_at && new Date(tokenRow.expires_at) < scheduledDate) {
          throw new Error("Your LinkedIn connection will have expired by the scheduled time. Please reconnect LinkedIn or pick an earlier time.");
        }

        const { data: inserted, error: insertErr } = await db.from("social_scheduled_posts").insert({
          agency_id: ctx.agencyId, platform, content, image_url: imageUrl ?? null,
          scheduled_for: scheduledDate.toISOString(), status: "pending",
        }).select().single();
        if (insertErr) throw new Error(`Failed to schedule post: ${insertErr.message}`);
        return json({ ok: true, postId: inserted.id, scheduledAt: inserted.scheduled_for, platform });
      }

      // ── Scheduled: list / cancel ──────────────────────────────────────────
      case "scheduled.list": {
        const ctx = await resolveCtx(req);
        const { data, error } = await db.from("social_scheduled_posts")
          .select("*").eq("agency_id", ctx.agencyId).order("scheduled_for", { ascending: true });
        if (error) throw new Error(error.message);
        return json({ ok: true, posts: data ?? [] });
      }

      case "scheduled.cancel": {
        const ctx = await resolveCtx(req);
        const id = payload.id as string;
        const { error } = await db.from("social_scheduled_posts")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", id).eq("agency_id", ctx.agencyId);
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }

      default:
        return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("social-syndication error:", err);
    return json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
