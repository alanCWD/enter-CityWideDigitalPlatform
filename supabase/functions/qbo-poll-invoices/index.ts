import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Runs on a daily pg_cron schedule (see migration). QuickBooks cannot push webhook
// notifications directly to this platform's backend functions — the gateway in
// front of every function requires an Authorization header that Intuit's webhook
// system has no way to send. So instead of waiting for a push, this function pulls:
// once a day, it asks each connected QuickBooks company for invoices that were
// updated recently, and sends a review-request email for any that are now fully paid.

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

type PlatformKey = "google" | "facebook" | "bbb" | "yelp";

const PLATFORM_EMAIL_UI: Record<PlatformKey, { bg: string; label: string }> = {
  google: { bg: "#4285F4", label: "Review us on Google" },
  facebook: { bg: "#1877F2", label: "Review us on Facebook" },
  bbb: { bg: "#0B5CAB", label: "Review us on BBB" },
  yelp: { bg: "#D32323", label: "Review us on Yelp" },
};

const DEFAULT_SUBJECT = "Thanks for your business — leave us a review?";
const DEFAULT_INTRO_PARAS =
  '<p style="color:#555;line-height:1.7;margin:0 0 16px;">We truly appreciate your business. Your experience matters to us, and we\'d love to hear your feedback.</p>' +
  '<p style="color:#555;line-height:1.7;margin:0 0 24px;">Would you mind taking a moment to leave us a review? It helps us improve and helps others discover our services.</p>';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Resolve the enabled review platforms for a connection, in fixed order.
// Falls back to the legacy single review_link as a Google entry when the new
// structured review_platforms field is empty (so upgraded connections keep working).
function resolvePlatforms(conn: {
  review_platforms: unknown;
  review_link: string | null;
}): { platform: PlatformKey; url: string }[] {
  const order: PlatformKey[] = ["google", "facebook", "bbb", "yelp"];
  const raw = conn.review_platforms;
  if (!raw || (Array.isArray(raw) && (raw as unknown[]).length === 0)) {
    return conn.review_link ? [{ platform: "google", url: conn.review_link }] : [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>();
  (raw as Array<{ platform: string; url?: string; enabled?: boolean }>).forEach((p) => {
    if (p && p.platform) map.set(p.platform, p);
  });
  return order
    .map((k) => map.get(k))
    .filter((p) => p && p.enabled && p.url && String(p.url).trim())
    .map((p) => ({ platform: p.platform as PlatformKey, url: String(p.url).trim() }));
}

function platformButtonHtml(p: { platform: PlatformKey; url: string }): string {
  const ui = PLATFORM_EMAIL_UI[p.platform];
  return `<a href="${escapeHtml(p.url)}" style="display:block;text-align:center;background:${ui.bg};color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:bold;margin:0 0 10px;">${ui.label}</a>`;
}

// MUST be kept in sync with buildReviewEmailHtml in QuickBooksPanel.tsx.
function buildReviewEmailHtml(opts: {
  customerName: string;
  platforms: { platform: PlatformKey; url: string }[];
  logoUrl: string | null;
  subject: string | null;
  intro: string | null;
}): string {
  const heading = opts.subject && opts.subject.trim() ? opts.subject : `Thank you, ${opts.customerName}!`;
  const introHtml =
    opts.intro && opts.intro.trim()
      ? `<p style="color:#555;line-height:1.7;margin:0 0 24px;">${escapeHtml(opts.intro).replace(/\n/g, "<br>")}</p>`
      : DEFAULT_INTRO_PARAS;
  const logoHtml = opts.logoUrl
    ? `<div style="text-align:center;margin:0 0 16px;"><img src="${escapeHtml(opts.logoUrl)}" alt="" style="max-height:56px;max-width:240px;display:inline-block;" /></div>`
    : "";
  const buttonsHtml = opts.platforms.length
    ? `<div style="margin:0 0 24px;">${opts.platforms.map(platformButtonHtml).join("")}</div>`
    : `<p style="color:#aaa;font-style:italic;text-align:center;margin:0 0 24px;">(Review buttons will appear here once you add a review link)</p>`;
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:20px;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">${logoHtml}<h2 style="color:#111;font-size:22px;margin:0 0 16px;">${escapeHtml(heading)}</h2>${introHtml}${buttonsHtml}<p style="color:#999;font-size:12px;margin:0;">Thank you for choosing us. We look forward to serving you again!</p></div></body></html>`;
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
  let deferred = 0;

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

    const delayDays = typeof conn.review_delay_days === "number" ? conn.review_delay_days : 7;
    const overlapDays = delayDays + 2;

    // Look back further than the exact last-sync timestamp to tolerate gaps and —
    // crucially — to re-see invoices that were too young to email on a previous
    // run (they have no review_requests row, so they must remain visible until the
    // configured delay has elapsed). Already-emailed customers are skipped via the
    // per-customer dedup check below.
    const since = conn.last_invoice_sync_at
      ? new Date(new Date(conn.last_invoice_sync_at).getTime() - overlapDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - Math.max(30, overlapDays) * 24 * 60 * 60 * 1000);
    const sinceStr = since.toISOString().slice(0, 19);

    // Per-connection email branding/copy (resolved once, reused for every invoice).
    const platforms = resolvePlatforms(conn);
    const { data: brand } = await supabase
      .from("client_brand_assets")
      .select("logo_rect_url")
      .eq("crm_client_id", conn.crm_client_id)
      .maybeSingle();
    const logoUrl = brand?.logo_rect_url || null;
    const emailSubject = conn.email_subject || DEFAULT_SUBJECT;
    const emailIntro = conn.email_intro || null;
    const fromName = conn.from_name || "CityWide Reviews";
    const fromAddress = `${fromName} <reviews@citywidedigital.ca>`;
    // For logging only: the first enabled platform URL (or legacy link).
    const loggedReviewLink = platforms[0]?.url || conn.review_link || null;

    try {
      const query = `SELECT * FROM Invoice WHERE Metadata.LastUpdatedTime >= '${sinceStr}' MAXRESULTS 200`;
      const res = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${conn.realm_id}/query?query=${encodeURIComponent(query)}&minorversion=65`,
        { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } },
      );
      const data = await res.json() as {
        QueryResponse?: {
          Invoice?: Array<{
            Id: string;
            Balance: number;
            BillEmail?: { Address?: string };
            CustomerRef?: { name?: string };
            MetaData?: { LastUpdatedTime?: string; CreateTime?: string };
          }>;
        };
        Fault?: { Error: Array<{ Message: string }> };
      };

      if (data.Fault) {
        const faultMessage = data.Fault.Error?.map((e) => e.Message).filter(Boolean).join("; ") || "Unknown QuickBooks query error";
        console.error(`[qbo-poll-invoices] query error for ${conn.crm_client_id}:`, JSON.stringify(data.Fault));
        await supabase.from("quickbooks_connections").update({ last_error: faultMessage, updated_at: new Date().toISOString() }).eq("id", conn.id);
        continue;
      }

      const invoices = data.QueryResponse?.Invoice || [];
      checked += invoices.length;

      for (const invoice of invoices) {
        if (invoice.Balance !== 0) continue; // still owes money — not paid yet

        const customerEmail = invoice.BillEmail?.Address;
        const customerName = invoice.CustomerRef?.name || "Valued Customer";
        if (!customerEmail) {
          console.warn(`[qbo-poll-invoices] Invoice ${invoice.Id} has no billing email — skipping`);
          continue;
        }

        // Per-customer dedup: one review request per (client, customer email) ever,
        // regardless of how many invoices they pay. Compared case-insensitively
        // (the unique index on review_requests enforces lower(email)).
        const { data: existing } = await supabase
          .from("review_requests")
          .select("id")
          .eq("crm_client_id", conn.crm_client_id)
          .ilike("customer_email", customerEmail)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        // Delay gate: only email once the invoice has been paid for at least
        // review_delay_days. QuickBooks has no clean "fully-paid-at" timestamp, so
        // we approximate with MetaData.LastUpdatedTime (updated when Balance last
        // changed). Too-young invoices are left alone — no row is written, so they
        // are re-evaluated on a later poll once the delay elapses.
        const lastUpdated = invoice.MetaData?.LastUpdatedTime;
        if (lastUpdated) {
          const elapsedMs = Date.now() - new Date(lastUpdated).getTime();
          if (elapsedMs < delayDays * 24 * 60 * 60 * 1000) {
            deferred++;
            continue;
          }
        }

        let status: "sent" | "failed" = "sent";
        let errorMessage: string | null = null;
        // One unguessable token per request — powers the click-tracking links.
        const clickToken = crypto.randomUUID();

        try {
          const trackedPlatforms = platforms.map((p) => ({
            platform: p.platform,
            url: trackingUrl(clickToken, p.platform, p.url),
          }));

          const emailHtml = buildReviewEmailHtml({
            customerName,
            platforms: trackedPlatforms,
            logoUrl,
            subject: emailSubject,
            intro: emailIntro,
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: fromAddress, to: [customerEmail], subject: emailSubject, html: emailHtml }),
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
          review_link: loggedReviewLink,
          status,
          error_message: errorMessage,
          click_token: clickToken,
        });
      }

      await supabase.from("quickbooks_connections").update({ last_invoice_sync_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
    } catch (e) {
      const errMsg = (e as Error).message || "Unknown error while syncing invoices";
      console.error(`[qbo-poll-invoices] exception for ${conn.crm_client_id}:`, e);
      await supabase.from("quickbooks_connections").update({ last_error: errMsg, updated_at: new Date().toISOString() }).eq("id", conn.id);
    }
  }

  console.log(`[qbo-poll-invoices] done — checked: ${checked}, sent: ${sent}, skipped: ${skipped}, deferred: ${deferred}`);
  return new Response(JSON.stringify({ checked, sent, skipped, deferred }), { headers: { "Content-Type": "application/json" } });
});
