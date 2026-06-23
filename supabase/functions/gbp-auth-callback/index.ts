import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  // Parse state
  let clientLabel = "New Client";
  let frontendOrigin = "";
  let linkUserId: string | null = null;
  try {
    const parsed = JSON.parse(atob(state || ""));
    clientLabel = parsed.clientLabel || clientLabel;
    frontendOrigin = parsed.frontendOrigin || "";
    linkUserId = parsed.linkUserId || null;
  } catch { /* use defaults */ }

  const redirectTo = (path: string) => {
    const base = frontendOrigin || "https://app.enter.pro";
    return new Response(null, { status: 302, headers: { Location: `${base}${path}` } });
  };

  // Google sent an error (e.g. user cancelled, or access_denied for non-test-user)
  if (oauthError || !code) {
    const msg = oauthError === "access_denied"
      ? "This Google account is not authorised. Make sure the business owner's email is added as a Test User in Google Cloud Console."
      : (oauthError || "no_code");
    return redirectTo(`/gbp?error=google_rejected&diag=${encodeURIComponent(msg)}`);
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supabaseUrl}/functions/v1/gbp-auth-callback`;

  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json() as {
      access_token?: string; refresh_token?: string;
      expires_in?: number; error?: string; error_description?: string;
    };

    if (!tokens.access_token) {
      console.error("Token exchange failed:", JSON.stringify(tokens));
      const msg = tokens.error_description || tokens.error || "unknown";
      return redirectTo(`/gbp?error=token_exchange_failed&diag=${encodeURIComponent(msg)}`);
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token || null;
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    const h = { Authorization: `Bearer ${accessToken}` };

    // 2. Get accounts list
    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: h });
    const accountsData = await accountsRes.json() as { accounts?: Array<{ name: string; accountName: string; type?: string }> };
    const accountCount = accountsData.accounts?.length ?? 0;
    console.log("Accounts found:", accountCount, JSON.stringify(accountsData).slice(0, 300));

    if (accountCount === 0) {
      return redirectTo(`/gbp?error=no_accounts&diag=${encodeURIComponent(
        "The Google account you signed in with has no Google Business Profiles. " +
        "You must sign in with the account that OWNS the business GBP listing."
      )}`);
    }

    const account = accountsData.accounts![0];
    const accountName = account.name; // e.g. "accounts/123456"

    // 3. Get locations
    const locListRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
      `?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,categories`,
      { headers: h },
    );
    const locListData = await locListRes.json() as { locations?: Array<Record<string, unknown>> };
    const locationCount = locListData.locations?.length ?? 0;
    console.log("Locations found:", locationCount, JSON.stringify(locListData).slice(0, 500));

    if (locationCount === 0) {
      return redirectTo(`/gbp?error=no_locations&diag=${encodeURIComponent(
        `Account "${account.accountName || accountName}" was found but has 0 GBP locations. ` +
        "Make sure this is the account that owns the GBP listing."
      )}`);
    }

    const location = locListData.locations![0] as Record<string, unknown>;
    const locationName = location.name as string; // e.g. "locations/456789"
    const fullName = `${accountName}/${locationName}`;

    // Extract NAP
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
    console.log("Reviews status:", rvRes.status, "count:", rvData.reviews?.length);
    const reviews = rvData.reviews || [];
    const avgRating = rvData.averageRating ??
      (reviews.length > 0 ? reviews.reduce((s, r) => s + starRatingToNumber(r.starRating as string), 0) / reviews.length : null);

    // 5. Upsert connection — try matching by location name first, then by client_label (reconnect)
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
        console.error("Insert failed:", insertErr);
        return redirectTo(`/gbp?error=db_insert_failed&diag=${encodeURIComponent(insertErr?.message || "unknown")}`);
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

    // 7. Fetch posts (v4 API)
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

    // 8. Link portal user if self-connect flow
    if (linkUserId) {
      await supabase.from("portal_users").upsert(
        { user_id: linkUserId, connection_id: connectionId, role: "owner" },
        { onConflict: "user_id,connection_id" },
      );
      return redirectTo(`/portal/${connectionId}?status=connected`);
    }

    return redirectTo(
      `/gbp?status=connected&business=${encodeURIComponent(businessName)}&reviews=${reviews.length}&posts=${posts.length}`,
    );
  } catch (err) {
    console.error("gbp-auth-callback exception:", err);
    return redirectTo(`/gbp?error=exception&diag=${encodeURIComponent((err as Error).message)}`);
  }
});
