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

// v4 address format
function formatAddressV4(addr: Record<string, unknown>): string {
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

// ── Generic fetch-with-logging helper ──────────────────────────────────────
async function apiFetch(label: string, url: string, headers: Record<string, string>): Promise<{ status: number; body: unknown; raw: string }> {
  const r = await fetch(url, { headers });
  const raw = await r.text();
  console.log(`[gbp] ${label} HTTP ${r.status}:`, raw.slice(0, 600));
  let body: unknown;
  try { body = JSON.parse(raw); } catch { body = {}; }
  return { status: r.status, body, raw };
}

// ── Google API error extraction ──────────────────────────────────────────
// Returns a formatted "status: message" string when the response is an error
// (error body present or non-2xx HTTP status), otherwise null. Surfacing
// Google's real error — instead of silently treating it as empty data — is
// what lets us diagnose 403 / PERMISSION_DENIED root causes.
function googleApiError(r: { status: number; body: unknown }): string | null {
  const e = (r.body as { error?: { code?: number; message?: string; status?: string } }).error;
  if (e) {
    const code = e.status || e.code || r.status;
    return `${code}: ${e.message || "Google API error"}`;
  }
  if (r.status >= 400) return `HTTP ${r.status}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const reqBody = await req.json();
    const code: string = reqBody.code;
    const state: string = reqBody.state || "";
    const redirectUri: string = reqBody.redirectUri;

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── 1. Token exchange ──────────────────────────────────────────────────
    console.log("[gbp] Token exchange — redirectUri:", redirectUri);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
    console.log("[gbp] tokens:", JSON.stringify({ error: tokens.error, hasAccess: !!tokens.access_token, hasRefresh: !!tokens.refresh_token }));

    if (!tokens.access_token) {
      return ok({ success: false, error: `Token error: ${tokens.error_description || tokens.error || "unknown"}` });
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token || null;
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    const h = { Authorization: `Bearer ${accessToken}` };

    // ── 2. Accounts — try v4 first (avoids Account Management API quota), fall back to v1 ──
    type V4Account = { name: string; accountName: string; type?: string };
    let accounts: V4Account[] = [];

    const v4Accts = await apiFetch("v4/accounts", "https://mybusiness.googleapis.com/v4/accounts", h);
    const v4AcctBody = v4Accts.body as { accounts?: V4Account[]; error?: { code?: number; message?: string; status?: string } };

    // Surface a real v4 permission error instead of silently falling through
    // to the v1 Account Management API, which would mask the actual cause.
    if (v4AcctBody.error?.code === 403 || v4Accts.status === 403) {
      const e = v4AcctBody.error;
      return ok({ success: false, error: `Google My Business API permission denied (${e?.status || e?.code || 403}): ${e?.message}. Enable the required Google My Business APIs in Google Cloud Console → APIs & Services, and ensure the project has Business Profile API access granted by Google.` });
    }

    if (!v4AcctBody.error && v4AcctBody.accounts) {
      accounts = v4AcctBody.accounts;
      console.log("[gbp] v4 accounts:", accounts.length);
    } else {
      console.warn("[gbp] v4 accounts failed:", JSON.stringify(v4AcctBody.error));
      // Fallback to v1 Account Management API
      const v1Accts = await apiFetch("v1/accounts", "https://mybusinessaccountmanagement.googleapis.com/v1/accounts", h);
      const v1Body = v1Accts.body as { accounts?: V4Account[]; error?: { code?: number; message?: string; status?: string } };
      if (v1Body.error) {
        const e = v1Body.error;
        if (e.code === 429) {
          return ok({ success: false, error: `Google Business Profile API access not yet granted for this Google Cloud project (quota is 0 QPM). Enabling the API in Cloud Console is not enough — Google requires a manual access request. Do NOT request a "quota increase"; Google's own docs say that won't help at 0 QPM. Instead: 1) confirm the quota shows 0 QPM under Google Cloud Console → APIs & Services → Google My Business Account Management API → Quotas (300 QPM means already approved), 2) if 0, submit the GBP API contact form (support.google.com/business/contact/api_default), choosing "Application for Basic API Access", using an email that's an owner/manager on the GBP, for a listing verified & active 60+ days with a website on the profile, 3) wait for Google's approval email before retrying.` });
        }
        if (e.code === 403) {
          return ok({ success: false, error: `API permission denied: ${e.message}. Enable "Google My Business Account Management API" in Google Cloud Console.` });
        }
        return ok({ success: false, error: `Accounts API error ${e.code}: ${e.message}` });
      }
      accounts = v1Body.accounts || [];
      console.log("[gbp] v1 accounts fallback:", accounts.length);
    }

    // ── 3. Locations ───────────────────────────────────────────────────────
    type V4Location = {
      name: string;
      locationName?: string;
      title?: string;
      primaryPhone?: string;
      address?: Record<string, unknown>;
      websiteUrl?: string;
      websiteUri?: string;
      primaryCategory?: { displayName?: string };
      categories?: { primaryCategory?: { displayName?: string } };
      phoneNumbers?: { primaryPhone?: string };
      storefrontAddress?: Record<string, unknown>;
    };

    const allLocations: V4Location[] = [];
    const locationAccountMap: Record<string, string> = {};

    const fetchLocationsV4 = async (parent: string): Promise<V4Location[]> => {
      const r = await apiFetch(`v4/locations(${parent})`, `https://mybusiness.googleapis.com/v4/${parent}/locations`, h);
      const locErr = googleApiError(r);
      if (locErr) throw new Error(`v4/locations(${parent}): ${locErr}`);
      const d = r.body as { locations?: V4Location[] };
      return d.locations || [];
    };

    if (accounts.length > 0) {
      for (const acct of accounts) {
        const locs = await fetchLocationsV4(acct.name);
        for (const loc of locs) {
          allLocations.push(loc);
          locationAccountMap[loc.name] = acct.name;
        }
      }
    }

    // Wildcard fallback for manager/invited accounts
    if (allLocations.length === 0) {
      console.log("[gbp] trying wildcard v4 accounts/-/locations");
      const locs = await fetchLocationsV4("accounts/-");
      for (const loc of locs) {
        allLocations.push(loc);
        const parts = loc.name.split("/");
        if (parts.length >= 2) locationAccountMap[loc.name] = `${parts[0]}/${parts[1]}`;
      }
    }

    // Last resort: v1 Business Information API wildcard
    if (allLocations.length === 0) {
      console.log("[gbp] trying v1 mybusinessbusinessinformation wildcard");
      const r = await apiFetch("v1/locations", "https://mybusinessbusinessinformation.googleapis.com/v1/accounts/-/locations?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,categories&pageSize=100", h);
      const v1LocErr = googleApiError(r);
      if (v1LocErr) throw new Error(`v1/locations: ${v1LocErr}`);
      const d = r.body as { locations?: V4Location[] };
      for (const loc of d.locations || []) {
        allLocations.push(loc);
        const parts = loc.name.split("/");
        if (parts.length >= 2) locationAccountMap[loc.name] = `${parts[0]}/${parts[1]}`;
      }
    }

    console.log("[gbp] total locations:", allLocations.length);

    if (allLocations.length === 0) {
      return ok({
        success: false,
        error: accounts.length === 0
          ? "This Google account has no Google Business Profile accounts. Sign in with the account that owns or manages the GBP listing."
          : `Found ${accounts.length} account(s) but 0 locations. The GBP listing may be unverified or suspended.`,
      });
    }

    // ── 4. Extract location data (handles both v4 and v1 schemas) ──────────
    const location = allLocations[0];
    const locParts = location.name.split("/"); // ["accounts","123","locations","456"]
    const accountNameForLoc = locationAccountMap[location.name] || locParts.slice(0, 2).join("/");
    const locationShortName = locParts.slice(2).join("/"); // "locations/456"
    const fullLocationName = location.name; // full: "accounts/123/locations/456"

    const businessName = location.locationName || location.title || clientLabel;
    const phone = location.primaryPhone || location.phoneNumbers?.primaryPhone || null;
    const addrRaw = location.address || location.storefrontAddress;
    const address = addrRaw ? formatAddressV4(addrRaw as Record<string, unknown>) : null;
    const website = location.websiteUrl || location.websiteUri || null;
    const category = location.primaryCategory?.displayName || location.categories?.primaryCategory?.displayName || null;

    console.log("[gbp] location:", fullLocationName, "—", businessName);

    // ── 5. Reviews ─────────────────────────────────────────────────────────
    // Try v4 reviews endpoint
    const rvRes = await apiFetch("reviews", `https://mybusiness.googleapis.com/v4/${fullLocationName}/reviews?pageSize=200`, h);
    const rvErr = googleApiError(rvRes);
    if (rvErr) return ok({ success: false, error: `reviews: ${rvErr}` });
    const rvBody = rvRes.body as { reviews?: Array<Record<string, unknown>>; totalReviewCount?: number; averageRating?: number };
    const reviews = rvBody.reviews || [];
    const avgRating = rvBody.averageRating ?? (reviews.length > 0
      ? reviews.reduce((s, r) => s + starRatingToNumber(r.starRating as string), 0) / reviews.length
      : null);

    // ── 6. Upsert gbp_connection ───────────────────────────────────────────
    const { data: existingByLoc } = await supabase.from("gbp_connections").select("id").eq("google_location_name", locationShortName).maybeSingle();
    const { data: existingByLabel } = !existingByLoc
      ? await supabase.from("gbp_connections").select("id").eq("client_label", clientLabel).maybeSingle()
      : { data: null };

    const napPayload = {
      client_label: clientLabel, business_name: businessName, address, phone, website, category,
      rating: avgRating, review_count: rvBody.totalReviewCount ?? reviews.length,
      google_access_token: accessToken, google_refresh_token: refreshToken, google_token_expiry: tokenExpiry,
      google_location_name: locationShortName, google_account_name: accountNameForLoc,
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
    console.log("[gbp] connectionId:", connectionId);

    // ── 7. Sync reviews ────────────────────────────────────────────────────
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

    // ── 8. Sync posts ──────────────────────────────────────────────────────
    const ptRes = await apiFetch("posts", `https://mybusiness.googleapis.com/v4/${fullLocationName}/localPosts?pageSize=20`, h);
    const ptErr = googleApiError(ptRes);
    if (ptErr) return ok({ success: false, error: `posts: ${ptErr}` });
    const ptBody = ptRes.body as { localPosts?: Array<Record<string, unknown>> };
    const posts = ptBody.localPosts || [];
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

    // ── 9. Link CRM + portal ───────────────────────────────────────────────
    if (crmClientId) await linkCrmClient(crmClientId, connectionId);
    if (linkUserId) {
      await supabase.from("portal_users").upsert(
        { user_id: linkUserId, connection_id: connectionId, role: "owner" },
        { onConflict: "user_id,connection_id" },
      );
    }

    return ok({ success: true, connectionId, businessName, crmClientId, linkUserId, reviewCount: reviews.length, postCount: posts.length });
  } catch (err) {
    console.error("[gbp] exception:", err);
    return ok({ success: false, error: (err as Error).message || "Unexpected error" });
  }
});
