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
