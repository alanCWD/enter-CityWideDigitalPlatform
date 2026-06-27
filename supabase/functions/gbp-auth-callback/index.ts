import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
  const bunnyBase = (Deno.env.get("BUNNY_DB_URL") ?? "")
    .trim().replace(/\/$/, "").replace(/^libsql:\/\//i, "https://");
  const bunnyToken = Deno.env.get("BUNNY_DB_AUTH_TOKEN");
  if (!bunnyBase || !bunnyToken) {
    console.warn("BUNNY_DB credentials not set — skipping CRM link");
    return;
  }
  const res = await fetch(`${bunnyBase}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${bunnyToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: "UPDATE clients SET gbp_connection_id = ?, updated_at = ? WHERE id = ?",
            args: [
              { type: "text", value: connectionId },
              { type: "text", value: new Date().toISOString() },
              { type: "text", value: crmClientId },
            ],
          },
        },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) console.error("BunnyDB CRM link failed:", res.status, await res.text());
  else console.log(`CRM client ${crmClientId} linked to gbp_connection ${connectionId}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Accepts POST body: { code, state, redirectUri }
    const body = await req.json();
    const code: string = body.code;
    const state: string = body.state || "";
    const redirectUri: string = body.redirectUri; // must match what was sent to Google

    if (!code) return json({ error: "no_code" }, 400);
    if (!redirectUri) return json({ error: "missing redirectUri" }, 400);

    // Parse state
    let clientLabel = "New Client";
    let frontendOrigin = "";
    let linkUserId: string | null = null;
    let crmClientId: string | null = null;
    try {
      const parsed = JSON.parse(atob(state));
      clientLabel = parsed.clientLabel || clientLabel;
      frontendOrigin = parsed.frontendOrigin || "";
      linkUserId = parsed.linkUserId || null;
      crmClientId = parsed.crmClientId || null;
    } catch { /* use defaults */ }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri, // MUST match the URI used in the OAuth URL
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as {
      access_token?: string; refresh_token?: string;
      expires_in?: number; error?: string; error_description?: string;
    };

    if (!tokens.access_token) {
      console.error("Token exchange failed:", JSON.stringify(tokens));
      return json({ error: `Token exchange failed: ${tokens.error_description || tokens.error || "unknown"}` }, 400);
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token || null;
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    const h = { Authorization: `Bearer ${accessToken}` };

    // 2. Get GBP accounts
    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: h });
    const accountsData = await accountsRes.json() as { accounts?: Array<{ name: string; accountName: string }> };
    console.log("Accounts found:", accountsData.accounts?.length, JSON.stringify(accountsData).slice(0, 300));

    if (!accountsData.accounts?.length) {
      return json({ error: "The Google account has no Google Business Profiles. Sign in with the account that owns the GBP listing." }, 400);
    }

    const account = accountsData.accounts[0];
    const accountName = account.name;

    // 3. Get locations
    const locListRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
      `?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,categories`,
      { headers: h },
    );
    const locListData = await locListRes.json() as { locations?: Array<Record<string, unknown>> };
    console.log("Locations found:", locListData.locations?.length, JSON.stringify(locListData).slice(0, 500));

    if (!locListData.locations?.length) {
      return json({ error: `Account "${account.accountName || accountName}" has 0 GBP locations. Make sure this account owns the GBP listing.` }, 400);
    }

    const location = locListData.locations[0] as Record<string, unknown>;
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

    // 4. Fetch reviews
    const rvRes = await fetch(
      `https://mybusinessreviews.googleapis.com/v1/${fullName}/reviews?pageSize=200`,
      { headers: h },
    );
    const rvData = await rvRes.json() as {
      reviews?: Array<Record<string, unknown>>;
      totalReviewCount?: number;
      averageRating?: number;
    };
    const reviews = rvData.reviews || [];
    const avgRating = rvData.averageRating ??
      (reviews.length > 0 ? reviews.reduce((s, r) => s + starRatingToNumber(r.starRating as string), 0) / reviews.length : null);

    // 5. Upsert gbp_connection
    const { data: existingByLoc } = await supabase.from("gbp_connections")
      .select("id").eq("google_location_name", locationName).maybeSingle();
    const { data: existingByLabel } = !existingByLoc
      ? await supabase.from("gbp_connections").select("id").eq("client_label", clientLabel).maybeSingle()
      : { data: null };

    const napPayload = {
      client_label: clientLabel,
      business_name: businessName,
      address, phone, website, category,
      rating: avgRating,
      review_count: rvData.totalReviewCount ?? reviews.length,
      google_access_token: accessToken,
      google_refresh_token: refreshToken,
      google_token_expiry: tokenExpiry,
      google_location_name: locationName,
      google_account_name: accountName,
      last_synced_at: new Date().toISOString(),
    };

    let connectionId: string;
    const matchId = existingByLoc?.id || existingByLabel?.id;

    if (matchId) {
      connectionId = matchId;
      const { error: updateErr } = await supabase.from("gbp_connections").update(napPayload).eq("id", connectionId);
      if (updateErr) console.error("Update failed:", updateErr);
    } else {
      const { data: newConn, error: insertErr } = await supabase
        .from("gbp_connections").insert(napPayload).select("id").single();
      if (insertErr || !newConn) {
        return json({ error: insertErr?.message || "DB insert failed" }, 500);
      }
      connectionId = newConn.id;
    }

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
      await supabase.from("gbp_reviews").upsert(rows, { onConflict: "connection_id,review_id" });
    }

    // 7. Fetch posts
    const ptRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${fullName}/localPosts?pageSize=20`,
      { headers: h },
    );
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

    // 8. Link CRM client in BunnyDB
    if (crmClientId) {
      await linkCrmClient(crmClientId, connectionId);
    }

    // 9. Link portal user
    if (linkUserId) {
      await supabase.from("portal_users").upsert(
        { user_id: linkUserId, connection_id: connectionId, role: "owner" },
        { onConflict: "user_id,connection_id" },
      );
    }

    return json({
      success: true,
      connectionId,
      businessName,
      crmClientId,
      linkUserId,
      reviewCount: reviews.length,
      postCount: posts.length,
    });
  } catch (err) {
    console.error("gbp-auth-callback exception:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
