// Creates a portal invite linking an email to a gbp_connection.
// When the user signs up at /portal/signup with that email, an auth trigger
// auto-links them via portal_users.
//
// Body: { email: string, connectionId: string }
// Returns: { success: true, inviteUrl: string } or { error: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, connectionId } = await req.json();
    if (!email || !connectionId) {
      return new Response(JSON.stringify({ error: "email and connectionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the connection exists
    const { data: conn, error: connErr } = await supabase
      .from("gbp_connections")
      .select("id, business_name, client_label")
      .eq("id", connectionId)
      .single();
    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert invite (idempotent: keep multiple invites if not yet accepted; trigger handles dupes)
    const { error: insErr } = await supabase
      .from("portal_invites")
      .insert({ email: email.toLowerCase().trim(), connection_id: connectionId });
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the signup URL the agency can hand to the client
    const origin = req.headers.get("origin") || "";
    const inviteUrl = `${origin}/portal/signup?email=${encodeURIComponent(email)}`;

    return new Response(
      JSON.stringify({
        success: true,
        inviteUrl,
        businessName: conn.business_name || conn.client_label,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
