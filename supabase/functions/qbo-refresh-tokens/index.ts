import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ---------------------------------------------------------------------------
// QuickBooks token handling.
// QuickBooks rotates the refresh token on EVERY successful refresh, and reusing
// an old one permanently invalidates the connection. qbo-poll-invoices also
// refreshes tokens, so every write below is a compare-and-swap on the refresh
// token we actually used: whoever loses the race adopts the winner's new tokens
// instead of burning the connection.
// MUST be kept in sync with the copy in qbo-poll-invoices/index.ts.
// ---------------------------------------------------------------------------
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

interface TokenConn {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  status: string;
}

function qboBasicAuth(): string {
  return btoa(`${Deno.env.get("QBO_CLIENT_ID")!}:${Deno.env.get("QBO_CLIENT_SECRET")!}`);
}

function tokenUsable(accessToken: string | null, expiry: string | null): boolean {
  if (!accessToken || !expiry) return false;
  return new Date(expiry).getTime() > Date.now() + 60_000;
}

/** Mark a connection as needing re-authorization, without clobbering fresher tokens. */
async function markConnectionExpired(supabase: Db, conn: TokenConn, error: string) {
  await supabase
    .from("quickbooks_connections")
    .update({ status: "expired", last_error: error, updated_at: new Date().toISOString() })
    .eq("id", conn.id)
    .eq("refresh_token", conn.refresh_token ?? "");
}

async function storedTokens(supabase: Db, id: string) {
  const { data } = await supabase
    .from("quickbooks_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("id", id)
    .maybeSingle();
  return data as { access_token: string | null; refresh_token: string | null; token_expiry: string | null } | null;
}

type TokenOutcome = { ok: true; accessToken: string } | { ok: false; error: string };

/** Returns a valid access token, refreshing only when the stored one has expired. */
async function ensureAccessToken(supabase: Db, conn: TokenConn): Promise<TokenOutcome> {
  if (tokenUsable(conn.access_token, conn.token_expiry)) {
    // Heal a status left behind by an earlier failure: these tokens still work.
    if (conn.status === "expired") {
      await supabase
        .from("quickbooks_connections")
        .update({ status: "active", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", conn.id)
        .eq("refresh_token", conn.refresh_token ?? "");
    }
    return { ok: true, accessToken: conn.access_token as string };
  }

  if (!conn.refresh_token) {
    await markConnectionExpired(supabase, conn, "No refresh token stored — reconnect required.");
    return { ok: false, error: "No refresh token stored" };
  }

  let tokens: { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  try {
    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${qboBasicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
    });
    tokens = await res.json();
  } catch (e) {
    return { ok: false, error: `Token refresh request failed: ${(e as Error).message}` };
  }

  if (!tokens.access_token) {
    const errMsg = tokens.error_description || tokens.error || "Unknown refresh error";
    // Lost the race? Another job may already have rotated the token successfully.
    const latest = await storedTokens(supabase, conn.id);
    if (latest && latest.refresh_token !== conn.refresh_token && tokenUsable(latest.access_token, latest.token_expiry)) {
      return { ok: true, accessToken: latest.access_token as string };
    }
    await markConnectionExpired(supabase, conn, errMsg);
    return { ok: false, error: errMsg };
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  const { data: saved } = await supabase
    .from("quickbooks_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || conn.refresh_token,
      token_expiry: expiresAt,
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id)
    .eq("refresh_token", conn.refresh_token)
    .select("id");

  if (!Array.isArray(saved) || saved.length === 0) {
    const latest = await storedTokens(supabase, conn.id);
    if (latest && tokenUsable(latest.access_token, latest.token_expiry)) {
      return { ok: true, accessToken: latest.access_token as string };
    }
  }

  return { ok: true, accessToken: tokens.access_token };
}

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

  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

  const { data: connections, error } = await supabase.from("quickbooks_connections").select("*");
  if (error) {
    console.error("[qbo-refresh-tokens] failed to load connections:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let refreshed = 0;
  let expired = 0;

  for (const conn of connections || []) {
    // One guarded refresh path shared with qbo-poll-invoices: QuickBooks rotates
    // the refresh token on every use, so a second unguarded renewal would
    // invalidate the connection permanently.
    const result = await ensureAccessToken(supabase, conn as TokenConn);

    if (result.ok) {
      refreshed++;
      continue;
    }

    // Only notify on the transition into "expired" so we don't spam daily
    if (conn.status !== "expired" && resendApiKey) {
      await notifyExpired(resendApiKey, conn.crm_client_id, result.error);
    }
    console.warn(`[qbo-refresh-tokens] refresh failed for ${conn.crm_client_id}:`, result.error);
    expired++;
  }

  console.log(`[qbo-refresh-tokens] done — refreshed: ${refreshed}, expired: ${expired}`);
  return new Response(JSON.stringify({ refreshed, expired }), {
    headers: { "Content-Type": "application/json" },
  });
});
