
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Must match EXACTLY what is registered in the Intuit Developer Portal → Keys & Credentials → Redirect URIs
const REDIRECT_URI = "https://dashboard.citywidedigital.ca/qbo/callback";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { crmClientId, frontendOrigin } = await req.json();
    const clientId = Deno.env.get("QBO_CLIENT_ID");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "QBO_CLIENT_ID not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const origin = (frontendOrigin || "").replace(/\/$/, "");

    const state = btoa(JSON.stringify({
      crmClientId: crmClientId || null,
      frontendOrigin: origin,
    }));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      state,
    });

    const url = `https://appcenter.intuit.com/connect/oauth2?${params}`;
    return new Response(JSON.stringify({ url, redirectUri: REDIRECT_URI }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
