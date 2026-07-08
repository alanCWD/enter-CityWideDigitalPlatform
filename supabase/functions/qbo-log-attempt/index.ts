import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Public (anon-callable) logging endpoint so the client-side QBO callback page
// can record what actually happened in the client's browser during OAuth —
// even if the request to qbo-auth-callback never fires (network block, ad
// blocker, closed tab, etc). This lets the agency diagnose "I clicked
// authorize but nothing happened" without guessing.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { crmClientId, realmId, stage, message } = await req.json();
    if (!stage) {
      return new Response(JSON.stringify({ error: "stage is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("qbo_connection_attempts").insert({
      crm_client_id: crmClientId || null,
      realm_id: realmId || null,
      stage,
      message: message || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Never fail the caller's flow just because logging failed
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
