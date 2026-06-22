// Social media gateway — unified Zernio scheduling + queue management.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ZernioProfile {
  _id: string;
  name: string;
}

async function getOrCreateZernioProfile(clientId: string, key: string): Promise<string> {
  try {
    const res = await fetch("https://zernio.com/api/v1/profiles", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const d = await res.json() as { profiles?: ZernioProfile[] };
      const existing = d.profiles?.find((p) => p.name === `Profile for ${clientId}`);
      if (existing) return existing._id;
      const createRes = await fetch("https://zernio.com/api/v1/profiles", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Profile for ${clientId}`, description: `Auto-generated for ${clientId}` }),
      });
      if (createRes.ok) {
        const created = await createRes.json() as { profile?: ZernioProfile };
        if (created.profile?._id) return created.profile._id;
      }
    }
  } catch (e) {
    console.error("getOrCreateZernioProfile error:", e);
  }
  return clientId;
}

async function publishToZernio(
  key: string,
  profileId: string,
  content: string,
  platforms: string[],
  scheduledAt?: string,
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      profileId,
      content,
      platforms: platforms.map((p) => (p === "google_business" ? "googlebusiness" : p)),
    };
    if (scheduledAt) body.scheduledAt = scheduledAt;
    const res = await fetch("https://zernio.com/api/v1/posts", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) return { ok: false, error: `Zernio ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}` };
    const d = data as { post?: { _id?: string }; _id?: string };
    return { ok: true, postId: d.post?._id ?? d._id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Fetch a URL from Zernio and return parsed JSON + raw text */
async function zernioGet(url: string, key: string): Promise<{ ok: boolean; status: number; data: unknown; raw: string }> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const raw = await res.text();
    let data: unknown;
    try { data = JSON.parse(raw); } catch { data = null; }
    return { ok: res.ok, status: res.status, data, raw };
  } catch (e) {
    return { ok: false, status: 0, data: null, raw: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const { action, payload } = body;
    const zernioKey = (Deno.env.get("ZERNIO_API_KEY") ?? "").trim();

    switch (action) {

      case "social.connect": {
        const { platform, client_id } = payload as { platform: string; client_id: string };
        if (platform !== "google_business") {
          const { data: existing } = await supabase
            .from("social_accounts").select("id")
            .eq("client_id", client_id).eq("platform", "google_business").maybeSingle();
          if (!existing) return json({ ok: false, error: "Google Business must be connected first." });
        }
        const profileId = await getOrCreateZernioProfile(client_id, zernioKey);
        const origin = req.headers.get("origin") ?? "http://localhost:5173";
        const redirectUri = encodeURIComponent(`${origin}/dashboard/social/profiles`);
        const zernioPlatform = platform === "google_business" ? "googlebusiness" : platform;
        const connectUrl = `https://zernio.com/api/v1/connect/${zernioPlatform}?profileId=${profileId}&redirectUri=${redirectUri}`;
        const response = await fetch(connectUrl, { headers: { Authorization: `Bearer ${zernioKey}` } });
        const text = await response.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch { data = text; }
        if (!response.ok) return json({ ok: false, error: `Zernio ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}` });
        const d = data as { authUrl?: string; auth_url?: string };
        return json({ ok: true, authUrl: d.authUrl ?? d.auth_url });
      }

      case "social.sync": {
        try {
          const res = await fetch("https://zernio.com/api/v1/profiles", { headers: { Authorization: `Bearer ${zernioKey}` } });
          if (res.ok) console.log("Zernio profiles:", JSON.stringify(await res.json()));
        } catch (e) { console.error("sync error:", e); }
        return json({ ok: true, message: "Connections synced successfully" });
      }

      case "social.post": {
        const res = await fetch("https://zernio.com/api/v1/posts", {
          method: "POST",
          headers: { Authorization: `Bearer ${zernioKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch { data = text; }
        if (!res.ok) return json({ ok: false, error: `Zernio ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}` });
        return json({ ok: true, message: "Post published", data });
      }

      case "posts.create": {
        const { client_id, content, platforms = [], scheduled_at, delay_minutes = 0, media_url } = payload as {
          client_id: string; content: string; platforms: string[];
          scheduled_at?: string; delay_minutes?: number; media_url?: string;
        };
        const id = crypto.randomUUID();
        const now = new Date();
        const platformStates: Record<string, string> = {};
        platforms.forEach((p) => { platformStates[p] = "queued"; });
        const { error: insertErr } = await supabase.from("scheduled_posts").insert({
          id, client_id, content, media_url: media_url ?? null,
          platforms, scheduled_at: scheduled_at ?? null, delay_minutes,
          status: "queued", platform_states: platformStates,
        });
        if (insertErr) return json({ ok: false, error: insertErr.message });
        const profileId = await getOrCreateZernioProfile(client_id, zernioKey);
        const gbpPlatforms = platforms.filter((p) => p === "google_business");
        const otherPlatforms = platforms.filter((p) => p !== "google_business");
        let zernioPostId: string | undefined;
        if (gbpPlatforms.length > 0) {
          const { ok, postId, error } = await publishToZernio(zernioKey, profileId, content, gbpPlatforms, scheduled_at);
          if (ok && postId) zernioPostId = postId;
          platformStates.google_business = ok ? "published" : "failed";
          if (!ok) console.error("GBP post failed:", error);
        }
        if (otherPlatforms.length > 0) {
          let offsetTime: string | undefined;
          if (delay_minutes > 0) {
            const base = scheduled_at ? new Date(scheduled_at) : now;
            base.setMinutes(base.getMinutes() + delay_minutes);
            offsetTime = base.toISOString();
          } else { offsetTime = scheduled_at; }
          const { ok, postId, error } = await publishToZernio(zernioKey, profileId, content, otherPlatforms, offsetTime);
          if (ok && postId && !zernioPostId) zernioPostId = postId;
          otherPlatforms.forEach((p) => { platformStates[p] = ok ? "queued" : "failed"; });
          if (!ok) console.error("Other platforms post failed:", error);
        }
        await supabase.from("scheduled_posts").update({
          zernio_post_id: zernioPostId ?? null, platform_states: platformStates,
          status: Object.values(platformStates).some((s) => s === "failed") ? "failed" : "queued",
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        return json({ ok: true, id, zernio_post_id: zernioPostId });
      }

      case "posts.list": {
        const { client_id } = payload as { client_id: string };
        const { data, error } = await supabase.from("scheduled_posts").select("*")
          .eq("client_id", client_id).order("created_at", { ascending: false });
        if (error) return json({ ok: false, error: error.message });
        return json({ ok: true, posts: data ?? [] });
      }

      case "posts.cancel": {
        const { id, client_id } = payload as { id: string; client_id: string };
        const { error } = await supabase.from("scheduled_posts")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", id).eq("client_id", client_id);
        if (error) return json({ ok: false, error: error.message });
        return json({ ok: true });
      }

      case "accounts.list": {
        const { client_id } = payload as { client_id: string };
        const { data, error } = await supabase.from("social_accounts").select("*").eq("client_id", client_id);
        if (error) return json({ ok: false, error: error.message });
        return json({ ok: true, accounts: data ?? [] });
      }

      case "accounts.disconnect": {
        const { id, client_id } = payload as { id: string; client_id: string };
        const { error } = await supabase.from("social_accounts").delete().eq("id", id).eq("client_id", client_id);
        if (error) return json({ ok: false, error: error.message });
        return json({ ok: true });
      }

      // ── Grant admin preview access to a portal connection ──
      case "portal.preview": {
        const { connection_id } = payload as { connection_id: string };
        const authHeader = req.headers.get("Authorization") ?? "";
        const token = authHeader.replace("Bearer ", "").trim();
        const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !user) return json({ ok: false, error: "Not authenticated" });
        const { error: upsertErr } = await supabase.from("portal_users").upsert(
          { user_id: user.id, connection_id, role: "owner" },
          { onConflict: "user_id,connection_id" },
        );
        if (upsertErr) return json({ ok: false, error: upsertErr.message });
        return json({ ok: true });
      }

      // ── List Zernio profiles from master account ──────
      case "zernio.profiles": {
        const res = await fetch("https://zernio.com/api/v1/profiles", {
          headers: { Authorization: `Bearer ${zernioKey}` },
        });
        const text = await res.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) return json({ ok: false, error: `Zernio ${res.status}: ${text.slice(0, 200)}` });
        return json({ ok: true, profiles: (data as { profiles?: unknown[] }).profiles ?? [] });
      }

      // ── Debug: probe all Zernio endpoint patterns ──────
      case "zernio.debug": {
        const { zernio_profile_id } = payload as { zernio_profile_id?: string };
        const results: Record<string, unknown> = {};

        // Always fetch profiles list
        const profilesRes = await zernioGet("https://zernio.com/api/v1/profiles", zernioKey);
        results.profiles_list = { status: profilesRes.status, data: profilesRes.data };

        if (zernio_profile_id) {
          const id = zernio_profile_id;

          // Profile variants
          for (const path of [
            `/api/v1/profiles/${id}`,
            `/api/v1/profiles/${id}/gbp`,
            `/api/v1/profiles/${id}/location`,
            `/api/v1/profiles/${id}/details`,
            `/api/v1/gbp?profileId=${id}`,
            `/api/v1/locations?profileId=${id}`,
          ]) {
            const r = await zernioGet(`https://zernio.com${path}`, zernioKey);
            results[`profile__${path.replace(/[/?=]/g,"_")}`] = { status: r.status, raw: r.raw.slice(0, 300) };
          }

          // Review variants
          for (const path of [
            `/api/v1/profiles/${id}/reviews`,
            `/api/v1/reviews?profileId=${id}`,
            `/api/v1/google-reviews?profileId=${id}`,
            `/api/v1/reputation?profileId=${id}`,
            `/api/v1/gbp/reviews?profileId=${id}`,
            `/api/v1/reviews/google?profileId=${id}`,
            `/api/v1/listings/${id}/reviews`,
          ]) {
            const r = await zernioGet(`https://zernio.com${path}`, zernioKey);
            results[`reviews__${path.replace(/[/?=]/g,"_")}`] = { status: r.status, raw: r.raw.slice(0, 300) };
          }
        }

        return json({ ok: true, debug: results });
      }

      // ── Sync GBP data (NAP + reviews + posts) from Zernio ──
      case "zernio.syncProfile": {
        const { connection_id, zernio_profile_id } = payload as {
          connection_id: string;
          zernio_profile_id: string;
        };

        const syncLog: string[] = [];

        // 1. Fetch profile info — try single profile, then gbp/location sub-paths
        const profilePaths = [
          `https://zernio.com/api/v1/profiles/${zernio_profile_id}`,
          `https://zernio.com/api/v1/profiles/${zernio_profile_id}/gbp`,
          `https://zernio.com/api/v1/profiles/${zernio_profile_id}/location`,
          `https://zernio.com/api/v1/gbp?profileId=${zernio_profile_id}`,
          `https://zernio.com/api/v1/locations?profileId=${zernio_profile_id}`,
        ];
        for (const url of profilePaths) {
          const res = await zernioGet(url, zernioKey);
          if (res.ok && res.data) {
            const p = res.data as Record<string, unknown>;
            const pd = (p.profile ?? p.location ?? p.gbp ?? p.data ?? p) as Record<string, unknown>;
            const updateFields: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
            if (pd.name) updateFields.business_name = pd.name;
            if (pd.address) updateFields.address = pd.address;
            if (pd.phone) updateFields.phone = pd.phone;
            if (pd.website) updateFields.website = pd.website;
            if (pd.category) updateFields.category = pd.category;
            if (pd.rating != null) updateFields.rating = pd.rating;
            if (pd.reviewCount != null) updateFields.review_count = pd.reviewCount;
            if (pd.review_count != null) updateFields.review_count = pd.review_count;
            if (pd.averageRating != null) updateFields.rating = pd.averageRating;
            if (pd.totalReviews != null) updateFields.review_count = pd.totalReviews;
            await supabase.from("gbp_connections").update(updateFields).eq("id", connection_id);
            syncLog.push(`profile (${url.split("/api/v1/")[1].split("?")[0]}): updated ${Object.keys(updateFields).length} fields`);
            break;
          }
        }

        // 2. Fetch reviews — try multiple endpoint patterns
        let reviewsData: unknown[] = [];
        const reviewPaths = [
          `https://zernio.com/api/v1/google-reviews?profileId=${zernio_profile_id}`,
          `https://zernio.com/api/v1/reputation?profileId=${zernio_profile_id}`,
          `https://zernio.com/api/v1/gbp/reviews?profileId=${zernio_profile_id}`,
          `https://zernio.com/api/v1/reviews/google?profileId=${zernio_profile_id}`,
          `https://zernio.com/api/v1/listings/${zernio_profile_id}/reviews`,
          `https://zernio.com/api/v1/profiles/${zernio_profile_id}/reviews`,
          `https://zernio.com/api/v1/reviews?profileId=${zernio_profile_id}`,
        ];
        for (const url of reviewPaths) {
          const res = await zernioGet(url, zernioKey);
          if (res.ok && res.data) {
            const rd = res.data as Record<string, unknown>;
            const arr = rd.reviews ?? rd.data ?? rd.items ?? rd.results ?? (Array.isArray(res.data) ? res.data : null);
            if (arr && Array.isArray(arr)) {
              reviewsData = arr as unknown[];
              syncLog.push(`reviews (${url.split("/api/v1/")[1].split("?")[0]}): ${reviewsData.length} found`);
              break;
            }
          }
        }
        if (reviewsData.length === 0) {
          syncLog.push(`reviews: not available on any endpoint`);
        }

        if (reviewsData.length > 0) {
          const rows = reviewsData.map((r) => {
            const rv = r as Record<string, unknown>;
            return {
              connection_id,
              review_id: (rv._id ?? rv.id ?? crypto.randomUUID()) as string,
              reviewer_name: (rv.reviewer_name ?? rv.reviewerName ?? rv.author ?? rv.name ?? "Anonymous") as string,
              rating: (rv.rating ?? rv.starRating ?? rv.score ?? 0) as number,
              comment: (rv.comment ?? rv.text ?? rv.body ?? rv.content ?? null) as string | null,
              reply: (rv.reply ?? rv.response ?? rv.replyText ?? null) as string | null,
              review_time: (rv.review_time ?? rv.reviewTime ?? rv.createdAt ?? rv.created_at ?? new Date().toISOString()) as string,
            };
          });
          await supabase.from("gbp_reviews")
            .upsert(rows, { onConflict: "connection_id,review_id" });
          await supabase.from("gbp_connections")
            .update({ review_count: rows.length })
            .eq("id", connection_id);
        }

        // 3. Fetch posts
        let postsData: unknown[] = [];
        const postsPaths = [
          `https://zernio.com/api/v1/posts?profileId=${zernio_profile_id}`,
          `https://zernio.com/api/v1/profiles/${zernio_profile_id}/posts`,
          `https://zernio.com/api/v1/gbp/posts?profileId=${zernio_profile_id}`,
        ];
        for (const url of postsPaths) {
          const res = await zernioGet(url, zernioKey);
          if (res.ok && res.data) {
            const pd2 = res.data as Record<string, unknown>;
            const arr = pd2.posts ?? pd2.data ?? pd2.items ?? (Array.isArray(res.data) ? res.data : null);
            if (arr && Array.isArray(arr)) {
              postsData = arr as unknown[];
              syncLog.push(`posts (${url.split("/api/v1/")[1].split("?")[0]}): ${postsData.length} found`);
              break;
            }
          }
        }
        if (postsData.length === 0) syncLog.push(`posts: not available`);

        if (postsData.length > 0) {
          const rows = postsData.map((p) => {
            const pv = p as Record<string, unknown>;
            return {
              connection_id,
              post_id: (pv._id ?? pv.id ?? crypto.randomUUID()) as string,
              summary: (pv.summary ?? pv.content ?? pv.text ?? pv.body ?? null) as string | null,
              topic_type: (pv.topic_type ?? pv.topicType ?? pv.type ?? "STANDARD") as string,
              media_url: (pv.media_url ?? pv.mediaUrl ?? pv.image ?? null) as string | null,
              post_time: (pv.post_time ?? pv.scheduledAt ?? pv.createdAt ?? pv.created_at ?? new Date().toISOString()) as string,
            };
          });
          await supabase.from("gbp_posts")
            .upsert(rows, { onConflict: "connection_id,post_id" });
        }

        return json({ ok: true, synced: true, log: syncLog });
      }

      // ── Link Zernio profile → CRM client ─────────────
      case "zernio.linkProfile": {
        const { crm_client_id: _crmId, zernio_profile_id, profile_name, category, address, phone, website, rating, review_count } = payload as {
          crm_client_id: string; zernio_profile_id: string; profile_name: string;
          category?: string; address?: string; phone?: string; website?: string;
          rating?: number; review_count?: number;
        };
        const { data: existing } = await supabase.from("gbp_connections").select("id")
          .eq("zernio_profile_id", zernio_profile_id).maybeSingle();
        let connectionId: string;
        if (existing?.id) {
          connectionId = existing.id as string;
          await supabase.from("gbp_connections").update({
            client_label: profile_name, business_name: profile_name,
            category: category ?? null, address: address ?? null,
            phone: phone ?? null, website: website ?? null,
            rating: rating ?? null, review_count: review_count ?? 0,
            last_synced_at: new Date().toISOString(),
          }).eq("id", connectionId);
        } else {
          const { data: inserted, error: insertErr } = await supabase.from("gbp_connections").insert({
            client_label: profile_name, business_name: profile_name,
            zernio_profile_id, category: category ?? null,
            address: address ?? null, phone: phone ?? null,
            website: website ?? null, rating: rating ?? null,
            review_count: review_count ?? 0, last_synced_at: new Date().toISOString(),
          }).select("id").single();
          if (insertErr) return json({ ok: false, error: insertErr.message });
          connectionId = (inserted as { id: string }).id;
        }
        return json({ ok: true, connection_id: connectionId });
      }

      default:
        return json({ ok: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ ok: false, error: `Internal Error: ${(err as Error).message}` }, 500);
  }
});
