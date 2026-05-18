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
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { action, payload } = body;

    // Basic routing for social operations
    switch (action) {
      case "social.connect":
        // Mandatory Google Business check
        const { platform, client_id } = payload;
        if (platform !== "google_business") {
          // Check if Google Business is already connected for this client
          const { data: existing } = await supabase
            .from("social_accounts")
            .select("id")
            .eq("client_id", client_id)
            .eq("platform", "google_business")
            .maybeSingle();
            
          if (!existing) {
            return json({ error: "Google Business must be connected first." }, 403);
          }
        }
        
        // Logic for OAuth flow initiation
        return json({ ok: true, message: "OAuth flow initiated for " + platform });
      case "social.post":
        // Logic for unified posting
        return json({ ok: true, message: "Post scheduled" });
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});