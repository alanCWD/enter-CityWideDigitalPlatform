import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const redirectUri = `https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/gbp-auth-callback`;

  // Parse state
  let clientLabel = "New Client";
  let returnTo = "/gbp";
  try {
    const parsed = JSON.parse(atob(state || ""));
    clientLabel = parsed.clientLabel || clientLabel;
    returnTo = parsed.returnTo || returnTo;
  } catch { /* use defaults */ }

  // Handle OAuth error
  if (error) {
    console.error("OAuth error:", error);
    return Response.redirect(`https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/gbp?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code) {
    return Response.redirect(`https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/gbp?error=no_code`, 302);
  }

  try {
    // Exchange code for tokens
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
    if (!tokens.access_token) {
      console.error("Token exchange failed:", tokens);
      return Response.redirect(`https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/gbp?error=token_exchange_failed`, 302);
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
    const accounts = accountsData.accounts || [];

    if (accounts.length === 0) {
      return Response.redirect(`https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/gbp?error=no_accounts`, 302);
    }

    // Use first account
    const account = accounts[0];
    const accountName = account.name; // e.g. "accounts/123456789"
    const googleAccountId = accountName.split("/")[1];

    // Fetch locations
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const locationsData = await locationsRes.json();
    const locations = locationsData.locations || [];

    // Use first location
    const location = locations[0] || {};
    const locationId = location.name || "";
    const businessName = location.title || clientLabel;
    const address = [
      location.storefrontAddress?.addressLines?.[0],
      location.storefrontAddress?.locality,
      location.storefrontAddress?.administrativeArea,
    ].filter(Boolean).join(", ");
    const phone = location.phoneNumbers?.primaryPhone || "";
    const website = location.websiteUri || "";
    const category = location.categories?.primaryCategory?.displayName || "";

    // Save to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: connection, error: dbError } = await supabase
      .from("gbp_connections")
      .insert({
        client_label: clientLabel,
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
      return Response.redirect(`https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/gbp?error=db_error`, 302);
    }

    // Fetch and store reviews
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
      } catch (e) {
        console.warn("Reviews fetch failed:", e);
      }

      // Fetch and store posts
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
      } catch (e) {
        console.warn("Posts fetch failed:", e);
      }
    }

    // Redirect back to app with success
    return Response.redirect(
      `https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/gbp?status=connected&business=${encodeURIComponent(businessName)}`,
      302
    );
  } catch (err) {
    console.error("Callback error:", err);
    return Response.redirect(`https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/gbp?error=unexpected`, 302);
  }
});
