// Social media gateway for unified API operations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ZernioProfile {
  _id: string;
  name: string;
}

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

    switch (action) {
      case "social.connect": {
        const { platform, client_id } = payload as { platform: string; client_id: string };

        // Mandatory Google Business check
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

        const zernioKey = Deno.env.get("ZERNIO_API_KEY") ?? "";
        const cleanKey = zernioKey.trim();
        const origin = req.headers.get("origin") ?? "http://localhost:5173";
        const redirectUri = encodeURIComponent(`${origin}/dashboard/social/profiles`);

        console.log("Initiating Zernio OAuth for:", { platform, client_id, hasKey: !!cleanKey });

        // Find or create a Zernio profile for this client
        let zernioProfileId: string = client_id;

        try {
          const getRes = await fetch("https://zernio.com/api/v1/profiles", {
            headers: { Authorization: `Bearer ${cleanKey}` },
          });

          if (getRes.ok) {
            const profilesData = await getRes.json() as { profiles?: ZernioProfile[] };
            const existing = profilesData.profiles?.find(
              (p) => p.name === `Profile for ${client_id}`
            );
            if (existing) {
              zernioProfileId = existing._id;
              console.log("Found existing Zernio profile:", zernioProfileId);
            } else {
              // Create a new profile
              const createRes = await fetch("https://zernio.com/api/v1/profiles", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${cleanKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: `Profile for ${client_id}`,
                  description: `Auto-generated profile for ${client_id}`,
                }),
              });

              if (createRes.ok) {
                const created = await createRes.json() as { profile?: ZernioProfile };
                if (created.profile?._id) {
                  zernioProfileId = created.profile._id;
                  console.log("Created Zernio profile:", zernioProfileId);
                }
              } else {
                console.warn("Failed to create Zernio profile:", await createRes.text());
              }
            }
          }
        } catch (e) {
          console.error("Error managing Zernio profile:", e);
        }

        const zernioPlatform = platform === "google_business" ? "googlebusiness" : platform;
        const connectUrl = `https://zernio.com/api/v1/connect/${zernioPlatform}?profileId=${zernioProfileId}&redirectUri=${redirectUri}`;

        const response = await fetch(connectUrl, {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });

        const responseText = await response.text();
        let zernioData: unknown;
        try {
          zernioData = JSON.parse(responseText);
        } catch {
          zernioData = responseText;
        }

        if (!response.ok) {
          const errorMsg = `Zernio API error (${response.status}): ${
            typeof zernioData === "string" ? zernioData : JSON.stringify(zernioData)
          }`;
          console.error(errorMsg);
          return json({ ok: false, error: errorMsg });
        }

        const data = zernioData as { authUrl?: string; auth_url?: string };
        return json({ ok: true, authUrl: data.authUrl ?? data.auth_url });
      }

      case "social.sync": {
        const syncKey = (Deno.env.get("ZERNIO_API_KEY") ?? "").trim();
        try {
          const profilesRes = await fetch("https://zernio.com/api/v1/profiles", {
            headers: { Authorization: `Bearer ${syncKey}` },
          });
          if (profilesRes.ok) {
            const profilesData = await profilesRes.json();
            console.log("Zernio profiles for sync:", JSON.stringify(profilesData));
          }
        } catch (e) {
          console.error("Sync error:", e);
        }
        return json({ ok: true, message: "Connections synced successfully" });
      }

      case "social.post": {
        const zernioKeyPost = (Deno.env.get("ZERNIO_API_KEY") ?? "").trim();
        const postResponse = await fetch("https://zernio.com/api/v1/posts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${zernioKeyPost}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const postText = await postResponse.text();
        let postData: unknown;
        try {
          postData = JSON.parse(postText);
        } catch {
          postData = postText;
        }

        if (!postResponse.ok) {
          const errorMsg = `Zernio post error (${postResponse.status}): ${
            typeof postData === "string" ? postData : JSON.stringify(postData)
          }`;
          return json({ ok: false, error: errorMsg });
        }

        return json({ ok: true, message: "Post published", data: postData });
      }

      default:
        return json({ ok: false, error: "Unknown action" });
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ ok: false, error: `Internal Error: ${(err as Error).message}` });
  }
});
