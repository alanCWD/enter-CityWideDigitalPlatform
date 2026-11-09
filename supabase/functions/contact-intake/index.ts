// Contact form intake for the /contact page.
// Public endpoint (anon key only): validates the submission, records it as a
// lead in the CRM so nothing is lost, then emails the owner.
//
// Body: { name, business, email, phone, type, message, website /* honeypot */ }
// Returns: { success: true } or { error: string, fields?: {...} }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const AGENCY_ID = "citywide";
const OWNER_EMAIL = "alan@citywidedigital.ca";
const FROM_EMAIL = "CityWide Digital <reviews@citywidedigital.ca>";

function bunnyBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";

type SqlValue = string | number | null;

async function exec(sql: string, args: SqlValue[] = []) {
  if (!BUNNY_TOKEN) throw new Error("BUNNY_DB_AUTH_TOKEN not configured");
  const base = bunnyBase();
  if (!base || base === "https://") throw new Error("BUNNY_DB_URL not configured");

  const res = await fetch(`${base}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        type: "execute",
        stmt: {
          sql,
          args: args.map((v) =>
            v === null || v === undefined
              ? { type: "null" }
              : typeof v === "number"
              ? { type: "integer", value: String(v) }
              : { type: "text", value: String(v) }
          ),
        },
      }, { type: "close" }],
    }),
  });
  if (!res.ok) throw new Error(`Bunny ${res.status}: ${await res.text()}`);
  return res.json();
}

const uuid = () => crypto.randomUUID();

const text = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailHtml(f: {
  name: string; business: string; email: string; phone: string; type: string; message: string; receivedAt: string;
}) {
  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:6px 16px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#111827;font-size:14px">${esc(value)}</td></tr>`
      : "";
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px">
  <h2 style="margin:0 0 4px;font-size:19px;color:#111827">New contact form message</h2>
  <p style="margin:0 0 18px;color:#6b7280;font-size:13px">Received ${esc(f.receivedAt)}</p>
  <table style="border-collapse:collapse">
    ${row("Name", f.name)}
    ${row("Business", f.business)}
    ${row("Email", f.email)}
    ${row("Phone", f.phone)}
    ${row("Business type", f.type)}
  </table>
  <div style="margin-top:18px;padding:14px 16px;background:#f6f7f9;border-radius:10px;color:#111827;font-size:14px;white-space:pre-wrap">${
    f.message ? esc(f.message) : "<span style=\"color:#6b7280\">No message provided.</span>"
  }</div>
  <p style="margin:18px 0 0;color:#6b7280;font-size:12px">Reply to this email to answer the visitor directly. Saved as a lead in the CRM (source: website contact form).</p>
</div>`;
}

async function sendNotification(f: {
  name: string; business: string; email: string; phone: string; type: string; message: string; receivedAt: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      reply_to: [f.email],
      subject: `Contact form: ${f.business} — ${f.name}`,
      html: emailHtml(f),
    }),
  });

  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // Honeypot: real visitors never fill this hidden field.
    if (text(body.website, 200) !== "") return json({ success: true });

    const name = text(body.name, 120);
    const business = text(body.business, 160);
    const email = text(body.email, 160).toLowerCase();
    const phone = text(body.phone, 40);
    const type = text(body.type, 80);
    const message = text(body.message, 4000);

    const fields: Record<string, string> = {};
    if (!name) fields.name = "Enter your name.";
    if (!business) fields.business = "Enter your business name.";
    if (!isEmail(email)) fields.email = "Enter a valid email address.";
    if (Object.keys(fields).length > 0) {
      return json({ error: "Please complete the highlighted fields.", fields }, 400);
    }

    const now = new Date();
    const receivedAt = now.toISOString();

    const notes = [
      `Website contact form submission — ${receivedAt}.`,
      `Business: ${business}.`,
      `Contact: ${name} <${email}>.`,
      phone ? `Phone: ${phone}.` : null,
      type ? `Business type: ${type}.` : null,
      "",
      "Message:",
      message || "(no message provided)",
    ].filter((l) => l !== null).join("\n");

    const clientId = uuid();

    await exec(
      `INSERT INTO clients (id, name, status, source, billing_email, phone, industry, notes, agency_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clientId,
        business,
        "lead",
        "website_contact",
        email,
        phone || null,
        type || null,
        notes,
        AGENCY_ID,
        receivedAt,
        receivedAt,
      ],
    );

    await exec(
      `INSERT INTO contacts (id, client_id, full_name, email, phone, role, is_primary)
       VALUES (?,?,?,?,?,?,?)`,
      [uuid(), clientId, name, email, phone || null, "Owner", 1],
    );

    try {
      await sendNotification({ name, business, email, phone, type, message, receivedAt });
    } catch (mailErr) {
      console.error("contact-intake email error:", mailErr);
      return json({
        error: `Your message was saved, but we couldn't send the email notification. Please email ${OWNER_EMAIL} directly.`,
        saved: true,
      }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("contact-intake error:", err);
    return json({ error: "We couldn't send your message. Please try again, or email alan@citywidedigital.ca." }, 500);
  }
});
