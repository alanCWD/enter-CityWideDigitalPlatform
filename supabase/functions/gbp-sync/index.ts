import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function starRatingToNumber(rating: string | number | undefined): number {
  if (typeof rating === "number") return rating;
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, STAR_RATING_UNSPECIFIED: 0 };
  return map[String(rating)] ?? 0;
}

function formatAddress(addr: Record<string, unknown>): string {
  const lines = (addr.addressLines as string[]) || [];
  const locality = (addr.locality as string) || "";
  const region = (addr.administrativeArea as string) || "";
  const postal = (addr.postalCode as string) || "";
  return [lines.join(" "), locality, region, postal].filter(Boolean).join(", ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { connectionId } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load connection with tokens
    const { data: conn } = await supabase
      .from("gbp_connections").select("*").eq("id", connectionId).maybeSingle();
    if (!conn) return json({ success: false, error: "Connection not found" });
    if (!conn.google_refresh_token) return json({ success: false, error: "No Google tokens. Please reconnect via Connect Profile." });

    // Refresh access token if expiring within 2 minutes
    let accessToken: string = conn.google_access_token;
    if (!accessToken || (conn.google_token_expiry && new Date(conn.google_token_expiry) < new Date(Date.now() + 120_000))) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          refresh_token: conn.google_refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
      if (!data.access_token) return json({ success: false, error: `Token refresh failed: ${data.error}` });
      accessToken = data.access_token;
      await supabase.from("gbp_connections").update({
        google_access_token: accessToken,
        google_token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      }).eq("id", connectionId);
    }

    const h = { Authorization: `Bearer ${accessToken}` };
    const fullName = `${conn.google_account_name}/${conn.google_location_name}`;
    if (!conn.google_account_name || !conn.google_location_name) {
      return json({ success: false, error: "No GBP location linked. Please reconnect." });
    }

    // 1. Fetch NAP from Business Information API
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${fullName}?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,categories`,
      { headers: h }
    );
    const loc = await locRes.json() as Record<string, unknown>;
    console.log("Location response:", JSON.stringify(loc).slice(0, 500));

    const businessName = (loc.title as string) || conn.business_name;
    const phones = loc.phoneNumbers as { primaryPhone?: string } | undefined;
    const phone = phones?.primaryPhone || conn.phone;
    const addr = loc.storefrontAddress as Record<string, unknown> | undefined;
    const address = addr ? formatAddress(addr) : conn.address;
    const website = (loc.websiteUri as string) || conn.website;
    const cats = loc.categories as { primaryCategory?: { displayName?: string } } | undefined;
    const category = cats?.primaryCategory?.displayName || conn.category;

    // 2. Fetch reviews
    const rvRes = await fetch(
      `https://mybusinessreviews.googleapis.com/v1/${fullName}/reviews?pageSize=200`,
      { headers: h }
    );
    const rvData = await rvRes.json() as { reviews?: Array<Record<string, unknown>>; totalReviewCount?: number; averageRating?: number };
    console.log("Reviews status:", rvRes.status, "count:", rvData.reviews?.length);
    const reviews = rvData.reviews || [];

    if (reviews.length > 0) {
      const rows = reviews.map((r) => ({
        connection_id: connectionId,
        review_id: (r.reviewId as string) || (r.name as string)?.split("/").pop() || crypto.randomUUID(),
        reviewer_name: ((r.reviewer as Record<string, unknown>)?.displayName as string) || "Anonymous",
        rating: starRatingToNumber(r.starRating as string),
        comment: (r.comment as string) || null,
        reply: ((r.reviewReply as Record<string, unknown>)?.comment as string) || null,
        review_time: (r.createTime as string) || new Date().toISOString(),
      }));
      await supabase.from("gbp_reviews").upsert(rows, { onConflict: "connection_id,review_id" });
    }

    // 3. Fetch posts (v4 API)
    const ptRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${fullName}/localPosts?pageSize=20`,
      { headers: h }
    );
    const ptData = await ptRes.json() as { localPosts?: Array<Record<string, unknown>> };
    console.log("Posts status:", ptRes.status, "count:", ptData.localPosts?.length);
    const posts = ptData.localPosts || [];

    if (posts.length > 0) {
      const rows = posts.map((p) => ({
        connection_id: connectionId,
        post_id: (p.name as string)?.split("/").pop() || crypto.randomUUID(),
        summary: (p.summary as string) || null,
        topic_type: (p.topicType as string) || "STANDARD",
        media_url: ((p.media as Array<Record<string, unknown>>)?.[0]?.googleUrl as string) || null,
        post_time: (p.createTime as string) || new Date().toISOString(),
      }));
      await supabase.from("gbp_posts").upsert(rows, { onConflict: "connection_id,post_id" });
    }

    // 4. Update connection NAP + stats
    await supabase.from("gbp_connections").update({
      business_name: businessName,
      address, phone, website, category,
      rating: rvData.averageRating ?? (reviews.length > 0 ? reviews.reduce((s, r) => s + starRatingToNumber(r.starRating as string), 0) / reviews.length : conn.rating),
      review_count: rvData.totalReviewCount ?? reviews.length,
      last_synced_at: new Date().toISOString(),
    }).eq("id", connectionId);

    return json({ success: true, reviewCount: reviews.length, postCount: posts.length });
  } catch (err) {
    console.error("gbp-sync error:", err);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});
