import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId } = await req.json();
    if (!connectionId) {
      return new Response(JSON.stringify({ error: "connectionId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    // Load connection
    const { data: conn, error: connErr } = await supabase
      .from("gbp_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token if expired
    let accessToken = conn.access_token;
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      const refreshed = await refreshAccessToken(conn.refresh_token, clientId, clientSecret);
      if (!refreshed.access_token) {
        return new Response(JSON.stringify({ error: "Token refresh failed" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
      await supabase.from("gbp_connections").update({
        access_token: accessToken,
        token_expires_at: expiresAt,
      }).eq("id", connectionId);
    }

    let reviewCount = 0;
    let postCount = 0;

    // Sync business info
    if (conn.location_id) {
      try {
        const infoRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${conn.location_id}?readMask=title,storefrontAddress,phoneNumbers,websiteUri,categories`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const info = await infoRes.json();
        if (info.title) {
          await supabase.from("gbp_connections").update({
            business_name: info.title,
            address: [info.storefrontAddress?.addressLines?.[0], info.storefrontAddress?.locality, info.storefrontAddress?.administrativeArea].filter(Boolean).join(", "),
            phone: info.phoneNumbers?.primaryPhone || conn.phone,
            website: info.websiteUri || conn.website,
            category: info.categories?.primaryCategory?.displayName || conn.category,
          }).eq("id", connectionId);
        }
      } catch (e) { console.warn("Info sync failed:", e); }

      // Sync reviews
      try {
        const reviewsRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${conn.location_id}/reviews`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const reviewsData = await reviewsRes.json();
        const reviews = reviewsData.reviews || [];

        for (const r of reviews.slice(0, 20)) {
          await supabase.from("gbp_reviews").upsert({
            connection_id: connectionId,
            review_id: r.reviewId,
            reviewer_name: r.reviewer?.displayName || "Anonymous",
            rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating as string] || 0,
            comment: r.comment || "",
            reply: r.reviewReply?.comment || null,
            review_time: r.createTime,
          }, { onConflict: "review_id" });
        }
        reviewCount = reviews.length;
      } catch (e) { console.warn("Reviews sync failed:", e); }

      // Sync posts
      try {
        const postsRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${conn.location_id}/localPosts`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const postsData = await postsRes.json();
        const posts = postsData.localPosts || [];

        for (const p of posts.slice(0, 10)) {
          await supabase.from("gbp_posts").upsert({
            connection_id: connectionId,
            post_id: p.name,
            summary: p.summary || "",
            topic_type: p.topicType || "STANDARD",
            media_url: p.media?.[0]?.googleUrl || null,
            post_time: p.createTime,
          }, { onConflict: "post_id" });
        }
        postCount = posts.length;
      } catch (e) { console.warn("Posts sync failed:", e); }
    }

    // Update last_synced_at
    await supabase.from("gbp_connections").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", connectionId);

    return new Response(JSON.stringify({ success: true, reviewCount, postCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
