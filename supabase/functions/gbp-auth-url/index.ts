const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { clientLabel, frontendOrigin, linkUserId, crmClientId } = await req.json();
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!clientId) return new Response(JSON.stringify({ error: "GOOGLE_CLIENT_ID not configured" }), { status: 500, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Keep the Supabase function URL as the registered redirect_uri in Google Cloud Console.
    // The function will then relay the browser to the frontend callback page.
    const redirectUri = `${supabaseUrl}/functions/v1/gbp-auth-callback`;

    const state = btoa(JSON.stringify({
      clientLabel: (clientLabel || "New Client").trim(),
      frontendOrigin: (frontendOrigin || "").replace(/\/$/, ""),
      linkUserId: linkUserId || null,
      crmClientId: crmClientId || null,
    }));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/business.manage",
      access_type: "offline",
      prompt: "consent select_account",
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return new Response(JSON.stringify({ url }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: cors,
    });
  }
});
