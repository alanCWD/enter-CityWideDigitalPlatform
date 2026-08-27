// Read-only proxy for the LedgerBridge sync status API.
//
// LedgerBridge is a separate project that runs a Clover -> QuickBooks daily sync
// for this agency. It exposes GET /citywide-api, gated by a shared API key. This
// function keeps that key server-side (Deno.env.get, never shipped to the
// browser) and returns the upstream JSON payload unchanged.
//
// Secrets:
//   CITYWIDE_API_KEY      shared key mirrored in the LedgerBridge project
//   LEDGERBRIDGE_BASE_URL https://spb-t4n611neql9e2ec2.supabase.opentrust.net/functions/v1

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CITYWIDE_API_KEY");
    const baseUrl = Deno.env.get("LEDGERBRIDGE_BASE_URL");

    if (!apiKey) {
      console.error("[ledgerbridge-status] CITYWIDE_API_KEY secret is not configured");
      return new Response(JSON.stringify({ error: "LedgerBridge API key is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!baseUrl) {
      console.error("[ledgerbridge-status] LEDGERBRIDGE_BASE_URL secret is not configured");
      return new Response(JSON.stringify({ error: "LedgerBridge base URL is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/citywide-api`, {
      method: "GET",
      headers: { "x-api-key": apiKey, "Accept": "application/json" },
    });

    // Return the upstream payload unchanged (status + body).
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    console.error("[ledgerbridge-status] upstream request failed:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Failed to reach LedgerBridge" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
