import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const { code, clientLabel, redirectUri } = await req.json();

    if (!code || !redirectUri) {
      return new Response(JSON.stringify({ error: "code and redirectUri required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      return new Response(JSON.stringify({ error: "Token exchange failed", detail: tokens.error_description || tokens.error }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    // ─── Fetch all GBP accounts (including managed/group accounts) ───
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts || [];
    const diagnostics: Record<string, unknown> = {
      accountsStatus: accountsRes.status,
      accountsCount: accounts.length,
      accountTypes: accounts.map((a: { name: string; accountName?: string; type?: string }) => ({ name: a.name, accountName: a.accountName, type: a.type })),
    };

    let googleAccountId = null;
    let locationId = null;
    let businessName = clientLabel || "New Client";
    let address = null;
    let phone = null;
    let website = null;
    let category = null;

    if (accounts.length > 0) {
      // Pick first account (could be PERSONAL, LOCATION_GROUP, or USER_GROUP)
      const account = accounts[0];
      const accountName = account.name; // e.g. "accounts/123"
      googleAccountId = accountName.split("/")[1];

      // Fetch locations for this account
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories&pageSize=20`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const locData = await locRes.json();
      diagnostics.locationsStatus = locRes.status;
      diagnostics.locationsCount = locData.locations?.length || 0;
      diagnostics.locationsError = locData.error || null;

      const locations = locData.locations || [];

      if (locations.length > 0) {
        const loc = locations[0];
        locationId = loc.name;
        businessName = loc.title || clientLabel;
        address = [
          loc.storefrontAddress?.addressLines?.[0],
          loc.storefrontAddress?.locality,
          loc.storefrontAddress?.administrativeArea,
        ].filter(Boolean).join(", ") || null;
        phone = loc.phoneNumbers?.primaryPhone || null;
        website = loc.websiteUri || null;
        category = loc.categories?.primaryCategory?.displayName || null;
      } else {
        // No locations on first account — try other accounts
        for (const acc of accounts.slice(1)) {
          const r = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories&pageSize=20`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const d = await r.json();
          if (d.locations?.length > 0) {
            const loc = d.locations[0];
            googleAccountId = acc.name.split("/")[1];
            locationId = loc.name;
            businessName = loc.title || clientLabel;
            address = [
              loc.storefrontAddress?.addressLines?.[0],
              loc.storefrontAddress?.locality,
              loc.storefrontAddress?.administrativeArea,
            ].filter(Boolean).join(", ") || null;
            phone = loc.phoneNumbers?.primaryPhone || null;
            website = loc.websiteUri || null;
            category = loc.categories?.primaryCategory?.displayName || null;
            diagnostics.foundLocationOnAccountIndex = accounts.indexOf(acc);
            break;
          }
        }
      }
    }

    diagnostics.resolvedLocationId = locationId;
    diagnostics.resolvedAccountId = googleAccountId;

    // Save connection
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: connection, error: dbError } = await supabase
      .from("gbp_connections")
      .insert({
        client_label: clientLabel || "New Client",
        google_account_id: googleAccountId,
        location_id: locationId,
        business_name: businessName,
        address, phone, website, category,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        last_synced_at: new Date().toISOString(),
      })
      .select().single();

    if (dbError) {
      return new Response(JSON.stringify({ error: "Database error", detail: dbError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync reviews + posts (best effort, only if locationId found)
    let reviewCount = 0;
    let postCount = 0;
    if (locationId) {
      try {
        const rvRes = await fetch(`https://mybusiness.googleapis.com/v4/${locationId}/reviews`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const rvData = await rvRes.json();
        diagnostics.reviewsStatus = rvRes.status;
        diagnostics.reviewsCount = rvData.reviews?.length || 0;
        diagnostics.reviewsError = rvData.error || null;
        const reviews = rvData.reviews || [];
        if (reviews.length > 0) {
          await supabase.from("gbp_reviews").insert(
            reviews.slice(0, 20).map((r: { reviewId: string; reviewer?: { displayName?: string }; starRating?: string; comment?: string; reviewReply?: { comment?: string }; createTime?: string }) => ({
              connection_id: connection.id,
              review_id: r.reviewId,
              reviewer_name: r.reviewer?.displayName || "Anonymous",
              rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating as string] || 0,
              comment: r.comment || "",
              reply: r.reviewReply?.comment || null,
              review_time: r.createTime,
            }))
          );
          reviewCount = reviews.length;
        }
      } catch (e) { diagnostics.reviewsError = String(e); }

      try {
        const ptRes = await fetch(`https://mybusiness.googleapis.com/v4/${locationId}/localPosts`, { headers: { Authorization: `Bearer ${accessToken}` } });
        const ptData = await ptRes.json();
        diagnostics.postsStatus = ptRes.status;
        diagnostics.postsCount = ptData.localPosts?.length || 0;
        diagnostics.postsError = ptData.error || null;
        const posts = ptData.localPosts || [];
        if (posts.length > 0) {
          await supabase.from("gbp_posts").insert(
            posts.slice(0, 10).map((p: { name: string; summary?: string; topicType?: string; media?: Array<{ googleUrl?: string }>; createTime?: string }) => ({
              connection_id: connection.id,
              post_id: p.name,
              summary: p.summary || "",
              topic_type: p.topicType || "STANDARD",
              media_url: p.media?.[0]?.googleUrl || null,
              post_time: p.createTime,
            }))
          );
          postCount = posts.length;
        }
      } catch (e) { diagnostics.postsError = String(e); }
    }

    return new Response(JSON.stringify({
      success: true,
      connectionId: connection.id,
      businessName,
      reviewCount,
      postCount,
      diagnostics, // included so we can debug from the frontend
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
