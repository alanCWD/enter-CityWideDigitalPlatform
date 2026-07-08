
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Must match EXACTLY what was sent to Intuit in qbo-auth-url (and what is registered in the portal)
const REDIRECT_URI = "https://citywidedigital.ca/qbo/callback";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { code, state, realmId } = await req.json();

    if (!code) return ok({ success: false, error: "no_code" });
    if (!realmId) return ok({ success: false, error: "no_realm_id" });

    let crmClientId: string | null = null;
    try {
      const parsed = JSON.parse(atob(state || ""));
      crmClientId = parsed.crmClientId || null;
    } catch { /* use defaults */ }

    const clientId = Deno.env.get("QBO_CLIENT_ID")!;
    const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Exchange authorization code for tokens
    // redirect_uri must exactly match what was sent in the initial auth request
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    console.log("[qbo-auth-callback] token exchange:", JSON.stringify({
      error: tokens.error,
      hasAccess: !!tokens.access_token,
      hasRefresh: !!tokens.refresh_token,
    }));

    if (!tokens.access_token) {
      return ok({
        success: false,
        error: `Token error: ${tokens.error_description || tokens.error || "unknown"}`,
      });
    }

    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const payload = {
      crm_client_id: crmClientId || `realm_${realmId}`,
      realm_id: realmId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || "",
      token_expiry: tokenExpiry,
      updated_at: new Date().toISOString(),
    };

    const { error: dbErr } = await supabase
      .from("quickbooks_connections")
      .upsert(payload, { onConflict: "crm_client_id" });

    if (dbErr) {
      console.error("[qbo-auth-callback] db error:", dbErr);
      return ok({ success: false, error: `DB error: ${dbErr.message}` });
    }

    console.log("[qbo-auth-callback] connected — crmClientId:", crmClientId, "realmId:", realmId);
    return ok({ success: true, crmClientId, realmId });
  } catch (err) {
    console.error("[qbo-auth-callback] exception:", err);
    return ok({ success: false, error: (err as Error).message || "Unexpected error" });
  }
});
