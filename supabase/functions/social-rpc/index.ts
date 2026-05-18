// Social media gateway for unified API operations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { action, payload } = body;

    // Basic routing for social operations
    switch (action) {
      case "social.connect":
        // Mandatory Google Business check
        const { platform, client_id } = payload;
        if (platform !== "google_business") {
          const { data: existing } = await supabase
            .from("social_accounts")
            .select("id")
            .eq("client_id", client_id)
            .eq("platform", "google_business")
            .maybeSingle();
            
          if (!existing) {
            return json({ ok: false, error: "Google Business must be connected first." });
          }
        }
        
        // OAuth flow initiation using Zernio
        const zernioKey = Deno.env.get("ZERNIO_API_KEY");
        // Use the frontend URL for the redirect, not the Supabase backend URL
        const origin = req.headers.get("origin") || "http://localhost:5173";
        const payloadData = { platform, profileId: client_id, redirect_uri: `${origin}/dashboard/social/profiles` };
        console.log("Initiating Zernio OAuth for:", { platform, client_id, hasKey: !!zernioKey, redirect_uri: payloadData.redirect_uri });
        
        // Ensure the API key is clean (no whitespace/newlines)
        const cleanKey = zernioKey ? zernioKey.trim() : "";
        
        // Step 1: Create or get a profile in Zernio
        // We use the client_id (e.g., 'citywide') as the name/reference
        let zernioProfileId = client_id;
        
        try {
          // First, try to get existing profiles to see if we already created one for this client
          const getProfilesResponse = await fetch("https://zernio.com/api/v1/profiles", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${cleanKey}`
            }
          });
          
          let profileExists = false;
          if (getProfilesResponse.ok) {
            const profilesData = await getProfilesResponse.json();
            const existingProfile = profilesData.profiles?.find((p: any) => p.name === `Profile for ${client_id}`);
            if (existingProfile) {
              zernioProfileId = existingProfile._id;
              profileExists = true;
              console.log(`Found existing Zernio profile: ${zernioProfileId}`);
            }
          }

          // If it doesn't exist, create it
          if (!profileExists) {
            const profileResponse = await fetch("https://zernio.com/api/v1/profiles", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cleanKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                name: `Profile for ${client_id}`,
                description: `Auto-generated profile for ${client_id}`
              })
            });
            
            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              if (profileData.profile && profileData.profile._id) {
                zernioProfileId = profileData.profile._id;
                console.log(`Created Zernio profile: ${zernioProfileId}`);
              }
            } else {
              console.warn("Failed to create Zernio profile, proceeding with client_id", await profileResponse.text());
            }
          }
        } catch (e) {
          console.error("Error managing Zernio profile:", e);
        }
        
        // Zernio API uses GET for connect URL, not POST
        // Note: Zernio expects 'googlebusiness' not 'google_business'
        const zernioPlatform = platform === 'google_business' ? 'googlebusiness' : platform;
        
        const response = await fetch(`https://zernio.com/api/v1/connect/${zernioPlatform}?profileId=${zernioProfileId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${cleanKey}`
          }
        });
        
        const text = await response.text();
        let zernioData;
        try {
          zernioData = JSON.parse(text);
        } catch (e) {
          zernioData = text;
        }

        if (!response.ok) {
          const errorMsg = `Zernio API error (${response.status}): ${typeof zernioData === 'string' ? zernioData : JSON.stringify(zernioData)}`;
          console.error(errorMsg);
          // Always return 200 so the Supabase client doesn't throw a generic error,
          // but include the error message in the JSON payload.
          return json({ ok: false, error: errorMsg });
        }
        
        // Zernio returns { authUrl: "..." } or { auth_url: "..." } depending on the endpoint version
        const authUrl = zernioData.authUrl || zernioData.auth_url;
        return json({ ok: true, authUrl });
      case "social.post":
        // Logic for unified posting via Zernio
        const zernioKeyPost = Deno.env.get("ZERNIO_API_KEY");
        const postResponse = await fetch("https://api.zernio.com/v1/posts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${zernioKeyPost}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        
        const postText = await postResponse.text();
        let postData;
        try {
          postData = JSON.parse(postText);
        } catch (e) {
          postData = postText;
        }
        return json({ ok: true, message: "Post scheduled", data: postData });
      default:
        return json({ ok: false, error: "Unknown action" });
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ ok: false, error: `Internal Edge Function Error: ${(err as Error).message}` });
  }
});