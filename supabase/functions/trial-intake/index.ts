// Free-trial intake for the /pricing page.
// Public endpoint (no JWT): validates the submission and records a free-trial
// client + primary contact in the CRM. No payment is taken or collected here.
//
// Body: {
//   plan, businessName, contactName, email, phone, businessType, website,
//   gbpListing, billingContact, billingEmail, billingAddress1, billingCity,
//   billingRegion, billingPostal, billingCountry, gbpConsent, termsConsent,
//   companyWebsite // honeypot
// }
// Returns: { success: true, trialEndsAt } or { error: string, fields?: {...} }

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

const PLANS: Record<string, { label: string; monthly: string }> = {
  starter: { label: "Starter", monthly: "$197/mo" },
  growth: { label: "Growth", monthly: "$397/mo" },
  pro: { label: "Pro", monthly: "$597/mo" },
};

const AGENCY_ID = "citywide";
const OWNER_EMAIL = "alan@citywidedigital.ca";

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

function rowsOf(response: unknown): Record<string, SqlValue>[] {
  const payload = response as {
    results?: Array<{ response?: { result?: { cols: { name: string }[]; rows: Array<Array<{ type: string; value?: string }>> } } }>;
  };
  const result = payload.results?.[0]?.response?.result;
  if (!result) return [];
  return (result.rows ?? []).map((arr) => {
    const row: Record<string, SqlValue> = {};
    result.cols.forEach((col, i) => {
      const v = arr[i];
      if (!v || v.type === "null") row[col.name] = null;
      else if (v.type === "integer" || v.type === "float") row[col.name] = Number(v.value);
      else row[col.name] = v.value ?? null;
    });
    return row;
  });
}

const uuid = () => crypto.randomUUID();

const text = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

const ADD_DAYS = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // Honeypot: real visitors never fill this hidden field.
    if (text(body.companyWebsite, 200) !== "") {
      return json({ success: true, trialEndsAt: null });
    }

    const plan = text(body.plan, 20).toLowerCase();
    const businessName = text(body.businessName, 160);
    const contactName = text(body.contactName, 120);
    const email = text(body.email, 160).toLowerCase();
    const phone = text(body.phone, 40);
    const businessType = text(body.businessType, 80);
    const website = text(body.website, 300);
    const gbpListing = text(body.gbpListing, 200);
    const billingContact = text(body.billingContact, 120);
    const billingEmail = text(body.billingEmail, 160).toLowerCase();
    const billingAddress1 = text(body.billingAddress1, 200);
    const billingCity = text(body.billingCity, 100);
    const billingRegion = text(body.billingRegion, 100);
    const billingPostal = text(body.billingPostal, 20);
    const billingCountry = text(body.billingCountry, 80) || "Canada";
    const gbpConsent = body.gbpConsent === true;
    const termsConsent = body.termsConsent === true;

    const fields: Record<string, string> = {};
    if (!(plan in PLANS)) fields.plan = "Choose a plan.";
    if (!businessName) fields.businessName = "Business name is required.";
    if (!contactName) fields.contactName = "Contact name is required.";
    if (!isEmail(email)) fields.email = "Enter a valid email address.";
    if (!phone) fields.phone = "Phone number is required.";
    if (!gbpListing) fields.gbpListing = "Your Google Business Profile name or link is required.";
    if (!billingContact) fields.billingContact = "Billing contact is required.";
    if (!isEmail(billingEmail)) fields.billingEmail = "Enter a valid billing email address.";
    if (!billingAddress1) fields.billingAddress1 = "Billing address is required.";
    if (!billingCity) fields.billingCity = "City is required.";
    if (!billingRegion) fields.billingRegion = "Province or state is required.";
    if (!billingPostal) fields.billingPostal = "Postal or ZIP code is required.";
    if (!gbpConsent) fields.gbpConsent = "Authorize Owner access to continue.";
    if (!termsConsent) fields.termsConsent = "Accept the terms to continue.";

    if (Object.keys(fields).length > 0) {
      return json({ error: "Please complete the highlighted fields.", fields }, 400);
    }

    // One request per billing email: resubmitting the form must not create a
    // duplicate client. Answer with the same success shape either way.
    const existing = rowsOf(await exec(
      `SELECT id FROM clients WHERE lower(billing_email) = ? AND agency_id = ? LIMIT 1`,
      [billingEmail, AGENCY_ID],
    ));
    if (existing.length > 0) {
      return json({ success: true, trialEndsAt: null, existing: true });
    }

    const now = new Date();
    const trialEndsAt = ADD_DAYS(now, 30).toISOString();
    const planInfo = PLANS[plan];

    const notes = [
      `Free trial requested — ${planInfo.label} (${planInfo.monthly}).`,
      `Trial: ${now.toISOString().slice(0, 10)} → ${trialEndsAt.slice(0, 10)}.`,
      businessType ? `Business type: ${businessType}.` : null,
      website ? `Website: ${website}.` : null,
      `Google Business Profile: ${gbpListing}.`,
      `Billing contact: ${billingContact} <${billingEmail}>.`,
      `Owner access authorized for ${OWNER_EMAIL} at ${now.toISOString()} — management access, not Primary Ownership; can be disconnected at any time; information is adjusted only with prior consent.`,
      `Billing after trial: Stripe (card) or Direct Deposit — team to confirm before the trial ends.`,
      `Terms accepted at ${now.toISOString()}.`,
    ].filter(Boolean).join("\n");

    const clientId = uuid();

    await exec(
      `INSERT INTO clients (id, name, status, source, billing_email, phone, address_line1, city, region, postal_code, country, notes, agency_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clientId,
        businessName,
        "lead",
        "free_trial",
        billingEmail,
        phone,
        billingAddress1,
        billingCity,
        billingRegion,
        billingPostal,
        billingCountry,
        notes,
        AGENCY_ID,
        now.toISOString(),
        now.toISOString(),
      ],
    );

    await exec(
      `INSERT INTO contacts (id, client_id, full_name, email, phone, role, is_primary)
       VALUES (?,?,?,?,?,?,?)`,
      [uuid(), clientId, contactName, email, phone, "Owner", 1],
    );

    return json({ success: true, trialEndsAt });
  } catch (err) {
    console.error("trial-intake error:", err);
    return json({ error: "We couldn't save your trial request. Please try again." }, 500);
  }
});
