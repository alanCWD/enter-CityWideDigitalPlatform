import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
    const redirectUri: string = body.redirectUri;

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

    // 1. Token exchange
    console.log("[gbp-callback] Token exchange — redirectUri:", redirectUri);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
    console.log("[gbp-callback] Token result:", JSON.stringify({ error: tokens.error, desc: tokens.error_description, hasAccess: !!tokens.access_token, hasRefresh: !!tokens.refresh_token }));

    if (!tokens.access_token) {
      return ok({ success: false, error: `Google token error: ${tokens.error_description || tokens.error || "unknown"}` });
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token || null;
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    const h = { Authorization: `Bearer ${accessToken}` };

    // 2. List accounts — capture full raw response for diagnostics
    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: h });
    const accountsRaw = await accountsRes.text();
    console.log("[gbp-callback] accounts HTTP status:", accountsRes.status, "body:", accountsRaw.slice(0, 800));

    let accountsData: { accounts?: Array<{ name: string; accountName: string; type?: string }>; error?: { code?: number; message?: string; status?: string } };
    try { accountsData = JSON.parse(accountsRaw); } catch { accountsData = {}; }

    // Surface API errors directly — most likely: API not enabled in Google Cloud Console
    if (accountsData.error) {
      const e = accountsData.error;
      if (e.status === "PERMISSION_DENIED" || e.code === 403) {
        return ok({ success: false, error: `Google My Business API not enabled: "${e.message}". Go to Google Cloud Console → APIs & Services → Library and enable: "Google My Business Account Management API", "My Business Business Information API", "My Business Reviews API".` });
      }
      return ok({ success: false, error: `Accounts API error ${e.code}: ${e.message}` });
    }

    const accounts = accountsData.accounts || [];
    console.log("[gbp-callback] accounts found:", accounts.length, accounts.map(a => a.name).join(", "));

    // 3. Collect locations across all accounts
    type GbpLocation = Record<string, unknown>;
    const locationAccountMap: Record<string, string> = {};
    let allLocations: GbpLocation[] = [];

    const fetchLocations = async (parent: string): Promise<GbpLocation[]> => {
      const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${parent}/locations?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,categories&pageSize=100`;
      const r = await fetch(url, { headers: h });
      const raw = await r.text();
      console.log(`[gbp-callback] locations(${parent}) HTTP ${r.status}:`, raw.slice(0, 500));
      let d: { locations?: GbpLocation[]; error?: { code?: number; message?: string; status?: string } };
      try { d = JSON.parse(raw); } catch { return []; }
      if (d.error) console.warn(`[gbp-callback] locations error for ${parent}:`, JSON.stringify(d.error));
      return d.locations || [];
    };

    if (accounts.length > 0) {
      for (const acct of accounts) {
        const locs = await fetchLocations(acct.name);
        for (const loc of locs) {
          allLocations.push(loc);
          locationAccountMap[loc.name as string] = acct.name;
        }
      }
    }

    // Wildcard fallback
    if (allLocations.length === 0) {
      console.log("[gbp-callback] Trying wildcard accounts/-/locations");
      const wildcardLocs = await fetchLocations("accounts/-");
      for (const loc of wildcardLocs) {
        allLocations.push(loc);
        const parts = (loc.name as string || "").split("/");
        if (parts.length >= 2) locationAccountMap[loc.name as string] = `${parts[0]}/${parts[1]}`;
      }
    }

    console.log("[gbp-callback] Total locations:", allLocations.length);

    if (allLocations.length === 0) {
      return ok({
        success: false,
        error: accounts.length === 0
          ? "This Google account has 0 GBP accounts. Make sure you are signed in with the account that owns or manages the Business Profile. If the APIs were just enabled, wait 1–2 minutes and try again."
          : `Found ${accounts.length} GBP account(s) but 0 locations. The GBP listing may be unverified or in a suspended state.`,
        _debug: { accountsStatus: accountsRes.status, accountCount: accounts.length },
      });
    }

    // Use first location
    const location = allLocations[0];
    const locNameFull = location.name as string; // "accounts/123/locations/456"
    const locParts = locNameFull.split("/");
    const locationName = locParts.slice(2).join("/"); // "locations/456"
    const accountNameForLocation = locationAccountMap[locNameFull] || locParts.slice(0, 2).join("/");
    const fullName = `${accountNameForLocation}/${locationName}`;

    const businessName = (location.title as string) || clientLabel;
    const phones = location.phoneNumbers as { primaryPhone?: string } | undefined;
    const phone = phones?.primaryPhone || null;
    const addr = location.storefrontAddress as Record<string, unknown> | undefined;
    const address = addr ? formatAddress(addr) : null;
    const website = (location.websiteUri as string) || null;
    const cats = location.categories as { primaryCategory?: { displayName?: string } } | undefined;
    const category = cats?.primaryCategory?.displayName || null;

    console.log("[gbp-callback] Using:", fullName, "—", businessName);

    // 4. Reviews
    const rvRes = await fetch(`https://mybusinessreviews.googleapis.com/v1/${fullName}/reviews?pageSize=200`, { headers: h });
    const rvData = await rvRes.json() as { reviews?: Array<Record<string, unknown>>; totalReviewCount?: number; averageRating?: number };
    const reviews = rvData.reviews || [];
    const avgRating = rvData.averageRating ?? (reviews.length > 0 ? reviews.reduce((s, r) => s + starRatingToNumber(r.starRating as string), 0) / reviews.length : null);

    // 5. Upsert gbp_connection
    const { data: existingByLoc } = await supabase.from("gbp_connections").select("id").eq("google_location_name", locationName).maybeSingle();
    const { data: existingByLabel } = !existingByLoc
      ? await supabase.from("gbp_connections").select("id").eq("client_label", clientLabel).maybeSingle()
      : { data: null };

    const napPayload = {
      client_label: clientLabel, business_name: businessName, address, phone, website, category,
      rating: avgRating, review_count: rvData.totalReviewCount ?? reviews.length,
      google_access_token: accessToken, google_refresh_token: refreshToken, google_token_expiry: tokenExpiry,
      google_location_name: locationName, google_account_name: accountNameForLocation,
      last_synced_at: new Date().toISOString(),
    };

    let connectionId: string;
    const matchId = existingByLoc?.id || existingByLabel?.id;
    if (matchId) {
      connectionId = matchId;
      await supabase.from("gbp_connections").update(napPayload).eq("id", connectionId);
    } else {
      const { data: newConn, error: insertErr } = await supabase.from("gbp_connections").insert(napPayload).select("id").single();
      if (insertErr || !newConn) return ok({ success: false, error: `DB insert failed: ${insertErr?.message}` });
      connectionId = newConn.id;
    }

    // 6. Reviews
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

    // 8. Link
    if (crmClientId) await linkCrmClient(crmClientId, connectionId);
    if (linkUserId) {
      await supabase.from("portal_users").upsert(
        { user_id: linkUserId, connection_id: connectionId, role: "owner" },
        { onConflict: "user_id,connection_id" },
      );
    }

    return ok({ success: true, connectionId, businessName, crmClientId, linkUserId, reviewCount: reviews.length, postCount: posts.length });
  } catch (err) {
    console.error("[gbp-callback] exception:", err);
    return ok({ success: false, error: (err as Error).message || "Unexpected error" });
  }
});
