// publish-scheduled-posts — cron entry point (every minute, via pg_cron).
// No user auth — uses the service-role key exclusively, since this runs as a
// system job. Batches due `pending` rows from social_scheduled_posts, publishes
// per platform (agency-scoped), mirrors to social_posts, and writes status
// transitions (publishing → published/failed). Reconnect emails are sent on
// revocation, gated on the false → true transition of needs_reconnect.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const NL = String.fromCharCode(10);

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

// ── Cron entry ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let processed = 0;
  let published = 0;
  let failed = 0;

  try {
    const { data: dueRows, error: dueErr } = await db
      .from("social_scheduled_posts")
      .select("id, agency_id, platform, content, image_url")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(20);
    if (dueErr) throw new Error(`Failed to fetch due posts: ${dueErr.message}`);

    for (const row of dueRows ?? []) {
      processed++;
      try {
        // Mark as publishing to avoid double-processing on overlapping runs.
        const { data: claimed } = await db
          .from("social_scheduled_posts")
          .update({ status: "publishing", updated_at: new Date().toISOString() })
          .eq("id", row.id).eq("status", "pending")
          .select("id");
        if (!claimed || claimed.length === 0) continue; // another run claimed it

        const platform = row.platform as string;
        const text = row.content as string;
        const imageUrl = row.image_url as string | null;
        const agencyId = row.agency_id as string;

        let postId: string;
        if (platform === "linkedin") postId = await publishToLinkedIn(db, agencyId, text, imageUrl);
        else if (platform === "facebook") postId = await publishToFacebook(db, agencyId, text, imageUrl);
        else if (platform === "instagram") postId = await publishToInstagram(db, agencyId, text, imageUrl);
        else throw new Error(`Unsupported platform: ${platform}`);

        try {
          await mirrorToPosts(db, agencyId, platform, text, imageUrl, postId);
        } catch (mirrorErr) {
          console.error("social_posts mirror error:", mirrorErr);
        }

        await db.from("social_scheduled_posts").update({
          status: "published",
          published_post_id: postId,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        published++;
      } catch (rowErr: unknown) {
        const message = rowErr instanceof Error ? rowErr.message : "Unknown error";
        console.error(`Failed to publish scheduled post ${row.id}:`, message);
        await db.from("social_scheduled_posts").update({
          status: "failed",
          error_message: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, published, failed }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("publish-scheduled-posts error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message, processed, published, failed }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
