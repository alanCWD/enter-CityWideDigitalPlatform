import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NOTIFY_EMAIL = "alan@citywidedigital.ca";

// Public origin of the app. Review buttons are wrapped in a tracking link that
// points here (/r?tok=...): the SPA records the click (the gateway rejects
// header-less requests from email clients, so the link must go through the app)
// and then redirects to the review page.
const APP_URL = (Deno.env.get("APP_URL") || "https://dashboard.citywidedigital.ca").replace(/\/$/, "");

/** Build a click-tracking link for one review button. */
function trackingUrl(clickToken: string, platform: string, dest: string): string {
  return `${APP_URL}/r?tok=${encodeURIComponent(clickToken)}&p=${encodeURIComponent(platform)}&u=${encodeURIComponent(dest)}`;
}

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
    console.error("[qbo-webhook] send email failed:", e);
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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  console.log("[qbo-webhook] incoming request, body length:", body.length);

  const signature = req.headers.get("intuit-signature") || "";
  const verifierToken = Deno.env.get("QBO_WEBHOOK_VERIFIER_TOKEN") || "";

  if (verifierToken && signature) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(verifierToken), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
    if (computed !== signature) {
      console.warn("[qbo-webhook] invalid signature");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

  const notifications = (payload.eventNotifications as Array<Record<string, unknown>>) || [];

  for (const notification of notifications) {
    const realmId = notification.realmId as string;
    const dataChangeEvent = notification.dataChangeEvent as Record<string, unknown>;
    const entities = (dataChangeEvent?.entities as Array<Record<string, unknown>>) || [];

    for (const entity of entities) {
      const entityName = entity.name as string;
      const entityId = entity.id as string;
      if (entityName !== "Invoice") continue;

      console.log(`[qbo-webhook] Invoice ${entityId} changed in realm ${realmId}`);

      const { data: conn } = await supabase.from("quickbooks_connections").select("*").eq("realm_id", realmId).maybeSingle();
      if (!conn) {
        console.warn(`[qbo-webhook] No connection found for realm ${realmId}`);
        continue;
      }

      const { data: existing } = await supabase.from("review_requests").select("id").eq("qbo_invoice_id", entityId).maybeSingle();
      if (existing) {
        console.log(`[qbo-webhook] Invoice ${entityId} already processed`);
        continue;
      }

      let accessToken = conn.access_token;
      if (new Date(conn.token_expiry) <= new Date()) {
        console.log("[qbo-webhook] Token expired, refreshing…");
        const creds = btoa(`${clientId}:${clientSecret}`);
        const refreshRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
          method: "POST",
          headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
        });
        const newTokens = await refreshRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
        if (!newTokens.access_token) {
          const errMsg = newTokens.error_description || newTokens.error || "Unknown refresh error";
          console.error("[qbo-webhook] Token refresh failed:", errMsg);
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
      }

      const invoiceRes = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${entityId}?minorversion=65`, {
        headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" },
      });

      const invoiceData = await invoiceRes.json() as {
        Invoice?: { Id: string; Balance: number; BillEmail?: { Address?: string }; CustomerRef?: { name?: string } };
        Fault?: { Error: Array<{ Message: string }> };
      };

      if (invoiceData.Fault) {
        console.error("[qbo-webhook] Invoice fetch error:", JSON.stringify(invoiceData.Fault));
        continue;
      }

      const invoice = invoiceData.Invoice;
      if (!invoice) continue;

      if (invoice.Balance !== 0) {
        console.log(`[qbo-webhook] Invoice ${entityId} not fully paid (Balance: ${invoice.Balance}) — skipping`);
        continue;
      }

      const customerEmail = invoice.BillEmail?.Address;
      const customerName = invoice.CustomerRef?.name || "Valued Customer";
      if (!customerEmail) {
        console.warn(`[qbo-webhook] Invoice ${entityId} has no billing email — skipping`);
        continue;
      }

      const reviewLink = conn.review_link || "";
      const fromName = conn.from_name || "CityWide Reviews";
      const fromAddress = `${fromName} <reviews@citywidedigital.ca>`;
      // One unguessable token per request — powers the click-tracking link.
      const clickToken = crypto.randomUUID();
      const trackedLink = reviewLink ? trackingUrl(clickToken, "google", reviewLink) : null;

      let status: "sent" | "failed" = "sent";
      let errorMessage: string | null = null;

      try {
        const emailHtml = `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 20px;"><div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);"><h2 style="color: #111; font-size: 22px; margin: 0 0 16px;">Thank you, ${customerName}!</h2><p style="color: #555; line-height: 1.7; margin: 0 0 16px;">We truly appreciate your business. Your experience matters to us, and we'd love to hear your feedback.</p><p style="color: #555; line-height: 1.7; margin: 0 0 24px;">Would you mind taking a moment to leave us a review? It helps us improve and helps others discover our services.</p>${trackedLink ? `<div style="text-align: center; margin: 0 0 24px;"><a href="${trackedLink}" style="display: inline-block; background: #0078D7; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">Leave a Review</a></div>` : ""}<p style="color: #999; font-size: 12px; margin: 0;">Thank you for choosing us. We look forward to serving you again!</p></div></body></html>`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromAddress, to: [customerEmail], subject: "Thanks for your business — leave us a review?", html: emailHtml }),
        });

        const emailResult = await emailRes.json() as { id?: string; name?: string; message?: string };
        if (!emailRes.ok) throw new Error(emailResult.message || emailResult.name || `Resend HTTP ${emailRes.status}`);
        console.log(`[qbo-webhook] Review request sent to ${customerEmail} from "${fromAddress}" (id: ${emailResult.id})`);
      } catch (e) {
        status = "failed";
        errorMessage = (e as Error).message;
        console.error("[qbo-webhook] Email send failed:", errorMessage);
      }

      await supabase.from("review_requests").insert({
        crm_client_id: conn.crm_client_id,
        qbo_invoice_id: entityId,
        customer_name: customerName,
        customer_email: customerEmail,
        review_link: reviewLink || null,
        status,
        error_message: errorMessage,
        click_token: clickToken,
      });
    }
  }

  return new Response("ok", { status: 200 });
});
