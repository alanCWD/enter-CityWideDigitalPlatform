
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Must match EXACTLY what was sent to Intuit in qbo-auth-url (and what is registered in the portal)
const REDIRECT_URI = "https://dashboard.citywidedigital.ca/qbo/callback";
const NOTIFY_EMAIL = "alan@citywidedigital.ca";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Look up the client's display name from the Bunny CRM database (best-effort; never throws)
async function getClientName(crmClientId: string): Promise<string | null> {
  try {
    const bunnyUrl = Deno.env.get("BUNNY_DB_URL");
    const bunnyToken = Deno.env.get("BUNNY_DB_AUTH_TOKEN");
    if (!bunnyUrl || !bunnyToken) return null;

    let base = bunnyUrl.trim().replace(/\/$/, "").replace(/^libsql:\/\//i, "https://");
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;

    const res = await fetch(`${base}/v2/pipeline`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${bunnyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "SELECT name FROM clients WHERE id = ? LIMIT 1", args: [{ type: "text", value: crmClientId }] } },
          { type: "close" },
        ],
      }),
    });
    const data = await res.json();
    const row = data?.results?.[0]?.response?.result?.rows?.[0];
    return row?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

// Notify the agency owner that a client just authorized QuickBooks (best-effort; never throws)
async function notifyConnected(crmClientId: string, realmId: string) {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return;

    const clientName = await getClientName(crmClientId);
    const label = clientName || crmClientId;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CityWide Reviews <reviews@citywidedigital.ca>",
        to: [NOTIFY_EMAIL],
        subject: `QuickBooks connected: ${label}`,
        html: `<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; background:#f9f9f9; margin:0; padding:20px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#111; font-size:20px; margin:0 0 12px;">QuickBooks connected</h2>
    <p style="color:#555; line-height:1.6; margin:0 0 8px;"><strong>${label}</strong> just authorized the QuickBooks Online connection.</p>
    <p style="color:#999; font-size:12px; margin:16px 0 0;">Realm ID: ${realmId}</p>
  </div>
</body></html>`,
      }),
    });
  } catch (e) {
    console.error("[qbo-auth-callback] notify failed:", e);
  }
}

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

    // Fire-and-forget notification; don't block or fail the response on this
    notifyConnected(payload.crm_client_id, realmId);

    return ok({ success: true, crmClientId, realmId });
  } catch (err) {
    console.error("[qbo-auth-callback] exception:", err);
    return ok({ success: false, error: (err as Error).message || "Unexpected error" });
  }
});
