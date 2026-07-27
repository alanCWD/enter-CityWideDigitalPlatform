import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Runs on a daily pg_cron schedule (see migration). QuickBooks cannot push webhook
// notifications directly to this platform's backend functions — the gateway in
// front of every function requires an Authorization header that Intuit's webhook
// system has no way to send. So instead of waiting for a push, this function pulls:
// once a day, it asks each connected QuickBooks company for invoices that were
// updated recently, and sends a review-request email for any that are now fully paid.

const NOTIFY_EMAIL = "alan@citywidedigital.ca";

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
      headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "CityWide Reviews <reviews@citywidedigital.ca>", to: [to], subject, html }),
    });
  } catch (e) {
    console.error("[qbo-poll-invoices] send email failed:", e);
  }
}

async function notifyExpired(resendApiKey: string, crmClientId: string, errorMessage: string) {
  const { name, email } = await getClientInfo(crmClientId);
  const label = name || crmClientId;

  await sendEmail(
    resendApiKey,
    NOTIFY_EMAIL,
    `Action needed: QuickBooks disconnected for ${label}`,
    `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; background:#f9f9f9; margin:0; padding:20px;"><div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"><h2 style="color:#B91C1C; font-size:20px; margin:0 0 12px;">QuickBooks connection expired</h2><p style="color:#555; line-height:1.6; margin:0 0 8px;"><strong>${label}</strong>'s QuickBooks Online connection has expired or been revoked. Review requests for this client have stopped.</p><p style="color:#999; font-size:12px; margin:16px 0 0;">Error: ${errorMessage}</p><p style="color:#555; line-height:1.6; margin:16px 0 0;">Generate a new connection link from the client's page and send it to them to reconnect.</p></div></body></html>`,
  );

  if (email) {
    await sendEmail(
      resendApiKey,
      email,
      "Action required: reconnect your QuickBooks account",
      `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; background:#f4f6f9; margin:0; padding:20px;"><div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 8px rgba(0,0,0,0.08);"><h2 style="color:#111827; font-size:20px; margin:0 0 12px;">Your QuickBooks connection has expired</h2><p style="color:#4B5563; line-height:1.6; margin:0 0 12px;">Hi ${name || ""},</p><p style="color:#4B5563; line-height:1.6; margin:0 0 12px;">Your QuickBooks Online connection needs to be renewed so we can keep sending review requests to your customers after invoices are paid.</p><p style="color:#4B5563; line-height:1.6; margin:0 0 12px;">We'll send you a new connection link shortly — please click it and re-authorize when it arrives.</p></div></body></html>`,
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

  const { data: connections, error } = await supabase.from("quickbooks_connections").select("*");
  if (error) {
    console.error("[qbo-poll-invoices] failed to load connections:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let checked = 0;
  let sent = 0;
  let skipped = 0;

  for (const conn of connections || []) {
    if (conn.status === "expired") continue;

    // Refresh token if expired
    let accessToken = conn.access_token as string;
    if (new Date(conn.token_expiry) <= new Date()) {
      const creds = btoa(`${clientId}:${clientSecret}`);
      try {
        const refreshRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
          method: "POST",
          headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
        });
        const newTokens = await refreshRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
        if (!newTokens.access_token) {
          const errMsg = newTokens.error_description || newTokens.error || "Unknown refresh error";
          console.error(`[qbo-poll-invoices] token refresh failed for ${conn.crm_client_id}:`, errMsg);
          if (conn.status !== "expired" && resendApiKey) await notifyExpired(resendApiKey, conn.crm_client_id, errMsg);
          await supabase.from("quickbooks_connections").update({ status: "expired", last_error: errMsg, updated_at: new Date().toISOString() }).eq("id", conn.id);
          continue;
        }
        accessToken = newTokens.access_token;
        await supabase.from("quickbooks_connections").update({
          access_token: accessToken,
          refresh_token: newTokens.refresh_token || conn.refresh_token,
          token_expiry: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", conn.id);
      } catch (e) {
        console.error(`[qbo-poll-invoices] refresh exception for ${conn.crm_client_id}:`, e);
        continue;
      }
    }

    // Look back a bit further than the exact last-sync timestamp to tolerate
    // any gaps (e.g. this job failing to run one day) — 2 days of overlap is
    // harmless since already-processed invoices are skipped via review_requests.
    const since = conn.last_invoice_sync_at
      ? new Date(new Date(conn.last_invoice_sync_at).getTime() - 2 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sinceStr = since.toISOString().slice(0, 19);

    try {
      const query = `SELECT * FROM Invoice WHERE Metadata.LastUpdatedTime >= '${sinceStr}' MAXRESULTS 200`;
      const res = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${conn.realm_id}/query?query=${encodeURIComponent(query)}&minorversion=65`,
        { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } },
      );
      const data = await res.json() as {
        QueryResponse?: { Invoice?: Array<{ Id: string; Balance: number; BillEmail?: { Address?: string }; CustomerRef?: { name?: string } }> };
        Fault?: { Error: Array<{ Message: string }> };
      };

      if (data.Fault) {
        console.error(`[qbo-poll-invoices] query error for ${conn.crm_client_id}:`, JSON.stringify(data.Fault));
        continue;
      }

      const invoices = data.QueryResponse?.Invoice || [];
      checked += invoices.length;

      for (const invoice of invoices) {
        if (invoice.Balance !== 0) continue; // still owes money — not paid yet

        const { data: existing } = await supabase.from("review_requests").select("id").eq("qbo_invoice_id", invoice.Id).maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        const customerEmail = invoice.BillEmail?.Address;
        const customerName = invoice.CustomerRef?.name || "Valued Customer";
        if (!customerEmail) {
          console.warn(`[qbo-poll-invoices] Invoice ${invoice.Id} has no billing email — skipping`);
          continue;
        }

        const reviewLink = conn.review_link || "";
        const fromName = conn.from_name || "CityWide Reviews";
        const fromAddress = `${fromName} <reviews@citywidedigital.ca>`;

        let status: "sent" | "failed" = "sent";
        let errorMessage: string | null = null;

        try {
          const emailHtml = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 20px;"><div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);"><h2 style="color: #111; font-size: 22px; margin: 0 0 16px;">Thank you, ${customerName}!</h2><p style="color: #555; line-height: 1.7; margin: 0 0 16px;">We truly appreciate your business. Your experience matters to us, and we'd love to hear your feedback.</p><p style="color: #555; line-height: 1.7; margin: 0 0 24px;">Would you mind taking a moment to leave us a review? It helps us improve and helps others discover our services.</p>${reviewLink ? `<div style="text-align: center; margin: 0 0 24px;"><a href="${reviewLink}" style="display: inline-block; background: #0078D7; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">Leave a Review</a></div>` : ""}<p style="color: #999; font-size: 12px; margin: 0;">Thank you for choosing us. We look forward to serving you again!</p></div></body></html>`;

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: fromAddress, to: [customerEmail], subject: "Thanks for your business — leave us a review?", html: emailHtml }),
          });
          const emailResult = await emailRes.json() as { id?: string; name?: string; message?: string };
          if (!emailRes.ok) throw new Error(emailResult.message || emailResult.name || `Resend HTTP ${emailRes.status}`);
          console.log(`[qbo-poll-invoices] Review request sent to ${customerEmail} from "${fromAddress}" (id: ${emailResult.id})`);
          sent++;
        } catch (e) {
          status = "failed";
          errorMessage = (e as Error).message;
          console.error("[qbo-poll-invoices] Email send failed:", errorMessage);
        }

        await supabase.from("review_requests").insert({
          crm_client_id: conn.crm_client_id,
          qbo_invoice_id: invoice.Id,
          customer_name: customerName,
          customer_email: customerEmail,
          review_link: reviewLink || null,
          status,
          error_message: errorMessage,
        });
      }

      await supabase.from("quickbooks_connections").update({ last_invoice_sync_at: new Date().toISOString() }).eq("id", conn.id);
    } catch (e) {
      console.error(`[qbo-poll-invoices] exception for ${conn.crm_client_id}:`, e);
    }
  }

  console.log(`[qbo-poll-invoices] done — checked: ${checked}, sent: ${sent}, skipped: ${skipped}`);
  return new Response(JSON.stringify({ checked, sent, skipped }), { headers: { "Content-Type": "application/json" } });
});
