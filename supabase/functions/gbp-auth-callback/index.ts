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

    // Frontend passes: code, clientLabel, and the exact redirectUri used in the auth URL
    const { code, clientLabel, redirectUri } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: "No auth code provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!redirectUri) {
      return new Response(JSON.stringify({ error: "redirectUri is required for token exchange" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Exchanging code with redirectUri:", redirectUri);

    // Exchange code for tokens — redirectUri must exactly match the one used in the auth URL
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

    const tokens = await tokenRes.json();
    console.log("Token exchange status:", tokenRes.status, tokens.error || "ok");

    if (!tokens.access_token) {
      return new Response(JSON.stringify({
        error: "Token exchange failed",
        detail: tokens.error_description || tokens.error,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiresIn = tokens.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch GBP accounts
    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const accountsData = await accountsRes.json();
    console.log("Accounts count:", accountsData.accounts?.length || 0);
    const accounts = accountsData.accounts || [];

    let googleAccountId = null;
    let locationId = null;
    let businessName = clientLabel || "New Client";
    let address = null;
    let phone = null;
    let website = null;
    let category = null;

    if (accounts.length > 0) {
      const account = accounts[0];
      const accountName = account.name;
      googleAccountId = accountName.split("/")[1];

      // Fetch locations
      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const locationsData = await locationsRes.json();
      console.log("Locations count:", locationsData.locations?.length || 0);
      const locations = locationsData.locations || [];

      if (locations.length > 0) {
        const location = locations[0];
        locationId = location.name;
        businessName = location.title || clientLabel;
        address = [
          location.storefrontAddress?.addressLines?.[0],
          location.storefrontAddress?.locality,
          location.storefrontAddress?.administrativeArea,
        ].filter(Boolean).join(", ") || null;
        phone = location.phoneNumbers?.primaryPhone || null;
        website = location.websiteUri || null;
        category = location.categories?.primaryCategory?.displayName || null;
      }
    }

    // Save connection to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: connection, error: dbError } = await supabase
      .from("gbp_connections")
      .insert({
        client_label: clientLabel || "New Client",
        google_account_id: googleAccountId,
        location_id: locationId,
        business_name: businessName,
        address,
        phone,
        website,
        category,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(JSON.stringify({ error: "Database error", detail: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync reviews (best effort)
    if (locationId) {
      try {
        const reviewsRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${locationId}/reviews`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const reviewsData = await reviewsRes.json();
        const reviews = reviewsData.reviews || [];
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
        }
      } catch (e) { console.warn("Reviews sync failed:", e); }

      // Sync posts (best effort)
      try {
        const postsRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const postsData = await postsRes.json();
        const posts = postsData.localPosts || [];
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
        }
      } catch (e) { console.warn("Posts sync failed:", e); }
    }

    return new Response(JSON.stringify({
      success: true,
      connectionId: connection.id,
      businessName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Callback error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
