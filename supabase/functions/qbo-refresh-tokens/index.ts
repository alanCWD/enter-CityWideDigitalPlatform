import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NOTIFY_EMAIL = "alan@citywidedigital.ca";

// Look up the client's name + billing email from the Bunny CRM database (best-effort; never throws)
async function getClientInfo(crmClientId: string): Promise<{ name: string | null; email: string | null }> {
  try {
    const bunnyUrl = Deno.env.get("BUNNY_DB_URL");
    const bunnyToken = Deno.env.get("BUNNY_DB_AUTH_TOKEN");
    if (!bunnyUrl || !bunnyToken) return { name: null, email: null };

    let base = bunnyUrl.trim().replace(/\/$/, "").replace(/^libsql:\/\//i, "https://");
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;

    const res = await fetch(`${base}/v2/pipeline`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${bunnyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql: "SELECT name, billing_email FROM clients WHERE id = ? LIMIT 1", args: [{ type: "text", value: crmClientId }] } },
          { type: "close" },
        ],
      }),
    });
    const data = await res.json();
    const row = data?.results?.[0]?.response?.result?.rows?.[0];
    return { name: row?.[0]?.value ?? null, email: row?.[1]?.value ?? null };
  } catch {
    return { name: null, email: null };
  }
}

async function sendEmail(resendApiKey: string, to: string, subject: string, html: string) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CityWide Reviews <reviews@citywidedigital.ca>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("[qbo-refresh-tokens] send email failed:", e);
  }
}

// Fires whenever a connection transitions from active -> expired.
// Notifies BOTH the agency admin and the client so someone re-authorizes promptly.
async function notifyExpired(resendApiKey: string, crmClientId: string, errorMessage: string) {
  const { name, email } = await getClientInfo(crmClientId);
  const label = name || crmClientId;

  await sendEmail(
    resendApiKey,
    NOTIFY_EMAIL,
    `Action needed: QuickBooks disconnected for ${label}`,
    `<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; background:#f9f9f9; margin:0; padding:20px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#B91C1C; font-size:20px; margin:0 0 12px;">QuickBooks connection expired</h2>
    <p style="color:#555; line-height:1.6; margin:0 0 8px;"><strong>${label}</strong>'s QuickBooks Online connection has expired or been revoked. Review requests for this client have stopped.</p>
    <p style="color:#999; font-size:12px; margin:16px 0 0;">Error: ${errorMessage}</p>
    <p style="color:#555; line-height:1.6; margin:16px 0 0;">Generate a new connection link from the client's page and send it to them to reconnect.</p>
  </div>
</body></html>`,
  );

  if (email) {
    await sendEmail(
      resendApiKey,
      email,
      "Action required: reconnect your QuickBooks account",
      `<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; background:#f4f6f9; margin:0; padding:20px;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#111827; font-size:20px; margin:0 0 12px;">Your QuickBooks connection has expired</h2>
    <p style="color:#4B5563; line-height:1.6; margin:0 0 12px;">Hi ${name || ""},</p>
    <p style="color:#4B5563; line-height:1.6; margin:0 0 12px;">Your QuickBooks Online connection needs to be renewed so we can keep sending review requests to your customers after invoices are paid.</p>
    <p style="color:#4B5563; line-height:1.6; margin:0 0 12px;">We'll send you a new connection link shortly — please click it and re-authorize when it arrives.</p>
  </div>
</body></html>`,
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

  const { data: connections, error } = await supabase.from("quickbooks_connections").select("*");
  if (error) {
    console.error("[qbo-refresh-tokens] failed to load connections:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let refreshed = 0;
  let expired = 0;

  for (const conn of connections || []) {
    const creds = btoa(`${clientId}:${clientSecret}`);
    try {
      const refreshRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
      });
      const tokens = await refreshRes.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };

      if (!tokens.access_token) {
        const errMsg = tokens.error_description || tokens.error || "Unknown refresh error";
        console.warn(`[qbo-refresh-tokens] refresh failed for ${conn.crm_client_id}:`, errMsg);

        // Only notify on the transition into "expired" so we don't spam daily
        if (conn.status !== "expired" && resendApiKey) {
          await notifyExpired(resendApiKey, conn.crm_client_id, errMsg);
        }

        await supabase.from("quickbooks_connections").update({
          status: "expired",
          last_error: errMsg,
          updated_at: new Date().toISOString(),
        }).eq("id", conn.id);

        expired++;
        continue;
      }

      await supabase.from("quickbooks_connections").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || conn.refresh_token,
        token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", conn.id);

      refreshed++;
    } catch (e) {
      console.error(`[qbo-refresh-tokens] exception for ${conn.crm_client_id}:`, e);
    }
  }

  console.log(`[qbo-refresh-tokens] done — refreshed: ${refreshed}, expired: ${expired}`);
  return new Response(JSON.stringify({ refreshed, expired }), {
    headers: { "Content-Type": "application/json" },
  });
});
