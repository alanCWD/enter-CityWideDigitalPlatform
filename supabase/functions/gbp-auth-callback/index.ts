import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Always returns 200 so supabase.functions.invoke() can read the body.
// Errors are communicated via { success: false, error: "..." }.
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

function starRatingToNumber(rating: string | undefined): number {
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

async function linkCrmClient(crmClientId: string, connectionId: string): Promise<void> {
  const bunnyBase = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "").replace(/^libsql:\/\//i, "https://");
  const bunnyToken = Deno.env.get("BUNNY_DB_AUTH_TOKEN");
  if (!bunnyBase || !bunnyToken) { console.warn("BUNNY_DB not configured"); return; }
  await fetch(`${bunnyBase}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${bunnyToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql: "UPDATE clients SET gbp_connection_id = ?, updated_at = ? WHERE id = ?", args: [{ type: "text", value: connectionId }, { type: "text", value: new Date().toISOString() }, { type: "text", value: crmClientId }] } },
        { type: "close" },
      ],
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const code: string = body.code;
    const state: string = body.state || "";
    const redirectUri: string = body.redirectUri; // e.g. https://dashboard.citywidedigital.ca/gbp/callback

    if (!code) return ok({ success: false, error: "no_code" });
    if (!redirectUri) return ok({ success: false, error: "missing redirectUri" });

    let clientLabel = "New Client";
    let linkUserId: string | null = null;
    let crmClientId: string | null = null;
    try {
      const parsed = JSON.parse(atob(state));
      clientLabel = parsed.clientLabel || clientLabel;
      linkUserId = parsed.linkUserId || null;
      crmClientId = parsed.crmClientId || null;
    } catch { /* use defaults */ }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Exchange authorization code for tokens
    console.log("Token exchange — redirectUri:", redirectUri, "code:", code.slice(0, 20));
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
    console.log("Token response:", JSON.stringify({ error: tokens.error, desc: tokens.error_description, hasAccess: !!tokens.access_token }));

    if (!tokens.access_token) {
      return ok({ success: false, error: `Google token error: ${tokens.error_description || tokens.error || "unknown"}` });
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token || null;
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    const h = { Authorization: `Bearer ${accessToken}` };

    // 2. Get GBP accounts
    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: h });
    const accountsData = await accountsRes.json() as { accounts?: Array<{ name: string; accountName: string }> };
    console.log("Accounts:", accountsData.accounts?.length);

    if (!accountsData.accounts?.length) {
      return ok({ success: false, error: "This Google account has no Google Business Profiles. Sign in with the account that owns the GBP listing." });
    }

    const account = accountsData.accounts[0];
    const accountName = account.name;

    // 3. Get locations
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,categories`,
      { headers: h },
    );
    const locData = await locRes.json() as { locations?: Array<Record<string, unknown>> };
    console.log("Locations:", locData.locations?.length, JSON.stringify(locData).slice(0, 400));

    if (!locData.locations?.length) {
      return ok({ success: false, error: `The account "${account.accountName || accountName}" has 0 GBP locations. Make sure you signed in with the account that manages the GBP listing.` });
    }

    const location = locData.locations[0];
    const locationName = location.name as string;
    const fullName = `${accountName}/${locationName}`;
    const businessName = (location.title as string) || clientLabel;
    const phones = location.phoneNumbers as { primaryPhone?: string } | undefined;
    const phone = phones?.primaryPhone || null;
    const addr = location.storefrontAddress as Record<string, unknown> | undefined;
    const address = addr ? formatAddress(addr) : null;
    const website = (location.websiteUri as string) || null;
    const cats = location.categories as { primaryCategory?: { displayName?: string } } | undefined;
    const category = cats?.primaryCategory?.displayName || null;

    console.log("Business:", businessName, "location:", locationName);

    // 4. Reviews
    const rvRes = await fetch(`https://mybusinessreviews.googleapis.com/v1/${fullName}/reviews?pageSize=200`, { headers: h });
    const rvData = await rvRes.json() as { reviews?: Array<Record<string, unknown>>; totalReviewCount?: number; averageRating?: number };
    const reviews = rvData.reviews || [];
    const avgRating = rvData.averageRating ?? (reviews.length > 0 ? reviews.reduce((s, r) => s + starRatingToNumber(r.starRating as string), 0) / reviews.length : null);
    console.log("Reviews:", reviews.length, "avgRating:", avgRating);

    // 5. Upsert gbp_connection
    const { data: existingByLoc } = await supabase.from("gbp_connections").select("id").eq("google_location_name", locationName).maybeSingle();
    const { data: existingByLabel } = !existingByLoc
      ? await supabase.from("gbp_connections").select("id").eq("client_label", clientLabel).maybeSingle()
      : { data: null };

    const napPayload = {
      client_label: clientLabel, business_name: businessName, address, phone, website, category,
      rating: avgRating, review_count: rvData.totalReviewCount ?? reviews.length,
      google_access_token: accessToken, google_refresh_token: refreshToken, google_token_expiry: tokenExpiry,
      google_location_name: locationName, google_account_name: accountName,
      last_synced_at: new Date().toISOString(),
    };

    let connectionId: string;
    const matchId = existingByLoc?.id || existingByLabel?.id;
    if (matchId) {
      connectionId = matchId;
      const { error: upErr } = await supabase.from("gbp_connections").update(napPayload).eq("id", connectionId);
      if (upErr) console.error("Update error:", upErr.message);
    } else {
      const { data: newConn, error: insertErr } = await supabase.from("gbp_connections").insert(napPayload).select("id").single();
      if (insertErr || !newConn) return ok({ success: false, error: `DB insert failed: ${insertErr?.message}` });
      connectionId = newConn.id;
    }
    console.log("Connection ID:", connectionId);

    // 6. Upsert reviews
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
      const { error: rvErr } = await supabase.from("gbp_reviews").upsert(rows, { onConflict: "connection_id,review_id" });
      if (rvErr) console.error("Reviews upsert error:", rvErr.message);
    }

    // 7. Posts
    const ptRes = await fetch(`https://mybusiness.googleapis.com/v4/${fullName}/localPosts?pageSize=20`, { headers: h });
    const ptData = await ptRes.json() as { localPosts?: Array<Record<string, unknown>> };
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
    console.log("Posts:", posts.length);

    // 8. Link CRM client in BunnyDB
    if (crmClientId) await linkCrmClient(crmClientId, connectionId);

    // 9. Link portal user
    if (linkUserId) {
      await supabase.from("portal_users").upsert(
        { user_id: linkUserId, connection_id: connectionId, role: "owner" },
        { onConflict: "user_id,connection_id" },
      );
    }

    return ok({ success: true, connectionId, businessName, crmClientId, linkUserId, reviewCount: reviews.length, postCount: posts.length });
  } catch (err) {
    console.error("gbp-auth-callback exception:", err);
    return ok({ success: false, error: (err as Error).message || "Unexpected error" });
  }
});
