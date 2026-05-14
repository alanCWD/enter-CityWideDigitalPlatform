// CRM gateway with Vault (notes, credentials, files) + multi-agency tenancy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUNNY_URL = Deno.env.get("BUNNY_DB_URL")!;
const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type SqlValue = string | number | null;
interface ExecRequest { sql: string; args?: SqlValue[] }
interface BunnyRow { [k: string]: SqlValue }
interface BunnyCol { name: string }
interface BunnyValue { type: string; value?: string }

function bunnyHttpBase(): string {
  let u = (BUNNY_URL ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

async function exec(req: ExecRequest) { return (await execMany([req]))[0]; }
async function execMany(stmts: ExecRequest[]) {
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        ...stmts.map((s) => ({
          type: "execute",
          stmt: {
            sql: s.sql,
            args: (s.args ?? []).map((v) =>
              v === null || v === undefined
                ? { type: "null" }
                : typeof v === "number"
                ? { type: "integer", value: String(v) }
                : { type: "text", value: String(v) }
            ),
          },
        })),
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Bunny HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as { results: Array<{ type: string; response?: { result?: { cols: BunnyCol[]; rows: Array<Array<BunnyValue>> } }; error?: { message: string } }> };
  const out: { rows: BunnyRow[] }[] = [];
  for (let i = 0; i < stmts.length; i++) {
    const r = data.results[i];
    if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "bunny error");
    const cols = r.response?.result?.cols ?? [];
    const rows = (r.response?.result?.rows ?? []).map((arr) => {
      const o: BunnyRow = {};
      cols.forEach((c, i) => {
        const v = arr[i];
        if (!v || v.type === "null") o[c.name] = null;
        else if (v.type === "integer" || v.type === "float") o[c.name] = Number(v.value);
        else o[c.name] = v.value ?? null;
      });
      return o;
    });
    out.push({ rows });
  }
  return out;
}

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

let bootstrapped = false;
// Run each statement individually so a single ALTER-on-existing-column error
// (or any other recoverable error) cannot abort the rest of the bootstrap.
async function execSafe(sql: string) {
  try { await exec({ sql }); } catch (_e) { /* swallow re-run / not-applicable errors */ }
}
async function bootstrap() {
  if (bootstrapped) return;
  const stmts: string[] = [
    `CREATE TABLE IF NOT EXISTS agencies (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `INSERT OR IGNORE INTO agencies (id, name, slug) VALUES ('citywide', 'Citywide Digital', 'citywide')`,
    `CREATE TABLE IF NOT EXISTS agency_members (user_id TEXT NOT NULL, agency_id TEXT NOT NULL REFERENCES agencies(id), role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, agency_id))`,
    `CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'lead', source TEXT, owner_id TEXT, billing_email TEXT, phone TEXT, address_line1 TEXT, city TEXT, region TEXT, postal_code TEXT, country TEXT, gbp_connection_id TEXT, stripe_customer_id TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE clients ADD COLUMN agency_id TEXT NOT NULL DEFAULT 'citywide'`,
    `CREATE INDEX IF NOT EXISTS clients_agency_idx ON clients(agency_id)`,
    `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, name TEXT NOT NULL, email TEXT, phone TEXT, role TEXT, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'CAD', interval TEXT NOT NULL DEFAULT 'month', stripe_price_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    // Safety ALTERs in case the products table was created earlier under an older schema.
    `ALTER TABLE products ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN description TEXT`,
    `ALTER TABLE products ADD COLUMN currency TEXT NOT NULL DEFAULT 'CAD'`,
    `ALTER TABLE products ADD COLUMN interval TEXT NOT NULL DEFAULT 'month'`,
    `ALTER TABLE products ADD COLUMN stripe_price_id TEXT`,
    `ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1`,
    `CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', start_date TEXT, current_period_end TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, stripe_subscription_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, subscription_id TEXT, number TEXT, amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'CAD', status TEXT NOT NULL DEFAULT 'draft', issued_at TEXT, due_at TEXT, paid_at TEXT, hosted_invoice_url TEXT, stripe_invoice_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'CAD', method TEXT, status TEXT NOT NULL DEFAULT 'succeeded', stripe_payment_intent_id TEXT, paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS vault_notes (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, agency_id TEXT NOT NULL DEFAULT 'citywide', title TEXT NOT NULL, body TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'agency_only', pinned INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS vault_notes_client_idx ON vault_notes(client_id)`,
    `CREATE TABLE IF NOT EXISTS vault_credentials (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, agency_id TEXT NOT NULL DEFAULT 'citywide', label TEXT NOT NULL, category TEXT, username TEXT, password TEXT, url TEXT, mfa_method TEXT, mfa_codes TEXT, notes TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS vault_credentials_client_idx ON vault_credentials(client_id)`,
    `CREATE TABLE IF NOT EXISTS vault_files (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, agency_id TEXT NOT NULL DEFAULT 'citywide', storage_path TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER, kind TEXT, visibility TEXT NOT NULL DEFAULT 'agency_only', uploaded_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS vault_files_client_idx ON vault_files(client_id)`,
    `CREATE TABLE IF NOT EXISTS health_checks (client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, agency_id TEXT NOT NULL DEFAULT 'citywide', key TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', weight INTEGER NOT NULL DEFAULT 1, auto INTEGER NOT NULL DEFAULT 1, client_visible INTEGER NOT NULL DEFAULT 1, evidence TEXT, evidence_url TEXT, metric_value TEXT, updated_by TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (client_id, key))`,
    `CREATE INDEX IF NOT EXISTS health_checks_client_idx ON health_checks(client_id)`,
    `CREATE TABLE IF NOT EXISTS health_audits (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, url TEXT NOT NULL, strategy TEXT NOT NULL, performance INTEGER, seo INTEGER, accessibility INTEGER, best_practices INTEGER, lcp_ms INTEGER, cls REAL, inp_ms INTEGER, cwv_pass INTEGER, error TEXT, raw_report_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS health_audits_client_idx ON health_audits(client_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS health_citations (client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, directory TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', listing_url TEXT, evidence TEXT, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (client_id, directory))`,
  ];
  for (const sql of stmts) await execSafe(sql);
  bootstrapped = true;
}

interface AuthCtx { userId: string; isSuperAdmin: boolean; agencyId: string; }
async function resolveAuth(token: string): Promise<AuthCtx | { error: string }> {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return { error: "Invalid token" };
  const userId = userData.user.id;
  const { data: isAdmin } = await userClient.rpc("is_admin");
  const { data: isAgency } = await userClient.rpc("has_role", { _user_id: userId, _role: "agency" });
  if (!isAdmin && !isAgency) return { error: `Forbidden: requires admin or agency role` };
  const isSuperAdmin = !!isAdmin;
  let agencyId = "citywide";
  try {
    const { rows } = await exec({ sql: `SELECT agency_id FROM agency_members WHERE user_id = ? LIMIT 1`, args: [userId] });
    if (rows[0]?.agency_id) agencyId = rows[0].agency_id as string;
  } catch { /* table may not exist on first call */ }
  return { userId, isSuperAdmin, agencyId };
}

function tenantScope(ctx: AuthCtx): { sql: string; args: SqlValue[] } {
  if (ctx.isSuperAdmin) return { sql: "1=1", args: [] };
  return { sql: "agency_id = ?", args: [ctx.agencyId] };
}

async function assertClientAccess(ctx: AuthCtx, clientId: string): Promise<void> {
  const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
  if (!rows[0]) throw new Error(`client ${clientId} not found`);
  if (ctx.isSuperAdmin) return;
  if (rows[0].agency_id !== ctx.agencyId) throw new Error("Forbidden: client belongs to another agency");
}

const adminStorage = createClient(SUPABASE_URL, SERVICE_KEY).storage;
function safeName(name: string) { return name.replace(/[^\w.-]+/g, "_").slice(0, 200); }

// ──────────────────────────────────────────────────────────────────
// Health-check catalogue (kept in sync with src/lib/healthCatalog.ts)
// ──────────────────────────────────────────────────────────────────
type HealthStatus = "pass" | "warn" | "fail" | "unknown" | "skipped";
type HealthCategory = "foundation" | "gbp" | "performance" | "search" | "citations" | "ops";
type Evaluator = "derived" | "lighthouse" | "citation" | "manual";
interface HealthCheckDef { key: string; category: HealthCategory; label: string; description?: string; weight: number; auto: boolean; client_visible_default: boolean; evaluator: Evaluator; }

const FREE_EMAIL_DOMAINS = new Set(["gmail.com","yahoo.com","yahoo.ca","hotmail.com","hotmail.ca","outlook.com","live.com","live.ca","icloud.com","aol.com","msn.com","rogers.com","shaw.ca","telus.net","bell.net","sympatico.ca","videotron.ca","me.com","mac.com","protonmail.com","ymail.com"]);

const HEALTH_CATALOG: HealthCheckDef[] = [
  { key: "has_website", category: "foundation", label: "Has a website", weight: 5, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_https", category: "foundation", label: "Website uses HTTPS", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_business_email", category: "foundation", label: "Domain-level business email", description: "Not a free provider (gmail/yahoo/outlook/etc.)", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_phone", category: "foundation", label: "Phone number on file", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_address", category: "foundation", label: "Physical address on file", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "has_category", category: "foundation", label: "Primary GBP category set", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "gbp_connected", category: "gbp", label: "Google Business Profile linked", weight: 5, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "gbp_recently_synced", category: "gbp", label: "GBP synced within 7 days", weight: 2, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "review_count_floor", category: "gbp", label: "At least 25 Google reviews", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "review_rating_floor", category: "gbp", label: "Average rating at or above 4.0", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "review_response_rate", category: "gbp", label: "Owner responds to reviews", weight: 3, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "posts_recency", category: "gbp", label: "GBP post within 30 days", weight: 2, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "lighthouse_performance", category: "performance", label: "Lighthouse Performance at or above 80", weight: 4, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "lighthouse_seo", category: "performance", label: "Lighthouse SEO at or above 90", weight: 4, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "lighthouse_accessibility", category: "performance", label: "Lighthouse Accessibility at or above 90", weight: 3, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "lighthouse_best_practices", category: "performance", label: "Lighthouse Best Practices at or above 90", weight: 3, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "core_web_vitals", category: "performance", label: "Core Web Vitals pass", description: "LCP / CLS / INP all in 'good' range", weight: 4, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "mobile_friendly", category: "performance", label: "Mobile audit succeeded", weight: 2, auto: true, client_visible_default: true, evaluator: "lighthouse" },
  { key: "search_console_connected", category: "search", label: "Search Console connected", weight: 3, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "ga4_connected", category: "search", label: "Google Analytics 4 connected", weight: 3, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "indexed_pages", category: "search", label: "Indexed pages in Google", weight: 2, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "monthly_organic_clicks", category: "search", label: "Monthly organic clicks", weight: 2, auto: false, client_visible_default: true, evaluator: "manual" },
  { key: "citation_yelp", category: "citations", label: "Listed on Yelp", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_bing", category: "citations", label: "Listed on Bing Places", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_apple", category: "citations", label: "Listed on Apple Maps", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_facebook", category: "citations", label: "Listed on Facebook", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_yellowpages", category: "citations", label: "Listed on Yellow Pages CA", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_411", category: "citations", label: "Listed on 411.ca", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_cylex", category: "citations", label: "Listed on Cylex", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_foursquare", category: "citations", label: "Listed on Foursquare", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_bbb", category: "citations", label: "Listed on Better Business Bureau", weight: 2, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_mapquest", category: "citations", label: "Listed on MapQuest", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_tripadvisor", category: "citations", label: "Listed on TripAdvisor", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_hotfrog", category: "citations", label: "Listed on Hotfrog", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_brownbook", category: "citations", label: "Listed on Brownbook", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_manta", category: "citations", label: "Listed on Manta", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citation_findus", category: "citations", label: "Listed on FindUsLocal", weight: 1, auto: true, client_visible_default: true, evaluator: "citation" },
  { key: "citations_overall", category: "citations", label: "Citation coverage at or above 70%", weight: 4, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "nap_consistency", category: "citations", label: "NAP consistent across listings", description: "Name, Address, Phone match wherever found", weight: 3, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "contract_signed", category: "ops", label: "Service agreement signed", weight: 3, auto: false, client_visible_default: false, evaluator: "manual" },
  { key: "payment_method_on_file", category: "ops", label: "Payment method on file", weight: 3, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "brand_assets_uploaded", category: "ops", label: "Logo / brand kit in Vault", weight: 2, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "gbp_credentials_in_vault", category: "ops", label: "GBP login saved to Vault", weight: 2, auto: true, client_visible_default: false, evaluator: "derived" },
  { key: "monthly_report_scheduled", category: "ops", label: "Monthly report cadence agreed", weight: 1, auto: false, client_visible_default: false, evaluator: "manual" },
  { key: "local_seo_active", category: "ops", label: "Active Local SEO subscription", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "social_active", category: "ops", label: "Active Social Marketing subscription", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
  { key: "reputation_active", category: "ops", label: "Active Reputation Management subscription", weight: 2, auto: true, client_visible_default: true, evaluator: "derived" },
];

interface DirectoryDef { key: string; name: string; searchUrl: (q: string, c: string) => string; }
const enc = encodeURIComponent;
const DIRECTORIES: DirectoryDef[] = [
  { key: "citation_yelp",        name: "Yelp",                       searchUrl: (q, c) => `https://www.yelp.com/search?find_desc=${enc(q)}&find_loc=${enc(c)}` },
  { key: "citation_bing",        name: "Bing Places",                searchUrl: (q, c) => `https://www.bing.com/maps?q=${enc(q + " " + c)}` },
  { key: "citation_apple",       name: "Apple Maps",                 searchUrl: (q, c) => `https://duckduckgo.com/?q=site%3Amaps.apple.com+${enc(q + " " + c)}` },
  { key: "citation_facebook",    name: "Facebook",                   searchUrl: (q, _c) => `https://www.facebook.com/public/${enc(q)}` },
  { key: "citation_yellowpages", name: "Yellow Pages CA",            searchUrl: (q, c) => `https://www.yellowpages.ca/search/si/1/${enc(q)}/${enc(c)}` },
  { key: "citation_411",         name: "411.ca",                     searchUrl: (q, c) => `https://411.ca/search/?q=${enc(q + " " + c)}` },
  { key: "citation_cylex",       name: "Cylex",                      searchUrl: (q, c) => `https://www.cylex.ca/search.html?q=${enc(q + " " + c)}` },
  { key: "citation_foursquare",  name: "Foursquare",                 searchUrl: (q, c) => `https://foursquare.com/explore?q=${enc(q)}&near=${enc(c)}` },
  { key: "citation_bbb",         name: "Better Business Bureau",     searchUrl: (q, c) => `https://www.bbb.org/search?find_country=CAN&find_text=${enc(q)}&find_loc=${enc(c)}` },
  { key: "citation_mapquest",    name: "MapQuest",                   searchUrl: (q, c) => `https://www.mapquest.com/search/results?query=${enc(q + " " + c)}` },
  { key: "citation_tripadvisor", name: "TripAdvisor",                searchUrl: (q, c) => `https://www.tripadvisor.com/Search?q=${enc(q + " " + c)}` },
  { key: "citation_hotfrog",     name: "Hotfrog",                    searchUrl: (q, _c) => `https://www.hotfrog.ca/search/canada/${enc(q)}` },
  { key: "citation_brownbook",   name: "Brownbook",                  searchUrl: (q, c) => `https://www.brownbook.net/search/?what=${enc(q)}&where=${enc(c)}` },
  { key: "citation_manta",       name: "Manta",                      searchUrl: (q, _c) => `https://www.manta.com/search?search_source=business&search=${enc(q)}` },
  { key: "citation_findus",      name: "FindUsLocal",                searchUrl: (q, c) => `https://www.findusinternational.ca/find/?searchterm=${enc(q + " " + c)}` },
];

const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; CityWideHealthBot/1.0)", "Accept": "text/html,application/xhtml+xml" };

function normalize(s: string): string { return (s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
function digits(s: string): string { return (s ?? "").replace(/\D+/g, ""); }

async function probeDirectory(def: DirectoryDef, q: string, city: string, name: string, phone: string, postal: string): Promise<{ status: HealthStatus; listing_url: string | null; evidence: string }> {
  const url = def.searchUrl(q, city);
  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok) return { status: "unknown", listing_url: url, evidence: `HTTP ${res.status}` };
    const html = (await res.text()).slice(0, 250_000);
    const lower = normalize(html);
    const nameTokens = normalize(name).split(" ").filter((t) => t.length > 2);
    const cityTokens = normalize(city).split(" ").filter((t) => t.length > 2);
    const nameHits = nameTokens.filter((t) => lower.includes(t)).length;
    const cityHit = cityTokens.length === 0 ? true : cityTokens.some((t) => lower.includes(t));
    const phoneHit = phone ? html.replace(/\D+/g, "").includes(digits(phone).slice(-7)) : false;
    const postalHit = postal ? lower.includes(normalize(postal)) : false;
    const strongMatch = (nameHits >= Math.max(1, Math.ceil(nameTokens.length * 0.6))) && (cityHit || phoneHit || postalHit);
    const weakMatch = nameHits >= 1 && (cityHit || phoneHit || postalHit);
    if (strongMatch) return { status: "pass", listing_url: url, evidence: `name+${phoneHit ? "phone" : postalHit ? "postal" : "city"} match` };
    if (weakMatch) return { status: "warn", listing_url: url, evidence: "partial name match" };
    return { status: "fail", listing_url: url, evidence: "no listing detected" };
  } catch (e) {
    return { status: "unknown", listing_url: url, evidence: (e as Error).message.slice(0, 120) };
  }
}

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
async function runPSI(url: string, strategy: "mobile" | "desktop") {
  const params = new URLSearchParams({ url, strategy, category: "performance" });
  ["seo", "accessibility", "best-practices"].forEach((c) => params.append("category", c));
  const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PSI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const cats = data?.lighthouseResult?.categories ?? {};
  const audits = data?.lighthouseResult?.audits ?? {};
  const cwv = data?.loadingExperience?.metrics ?? {};
  return {
    performance: Math.round(((cats.performance?.score ?? 0) * 100)),
    seo: Math.round(((cats.seo?.score ?? 0) * 100)),
    accessibility: Math.round(((cats.accessibility?.score ?? 0) * 100)),
    best_practices: Math.round(((cats["best-practices"]?.score ?? 0) * 100)),
    lcp_ms: Math.round(audits["largest-contentful-paint"]?.numericValue ?? cwv.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? 0),
    cls: Number(((audits["cumulative-layout-shift"]?.numericValue ?? cwv.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? 0) as number).toFixed(3)),
    inp_ms: Math.round(audits["interaction-to-next-paint"]?.numericValue ?? cwv.INTERACTION_TO_NEXT_PAINT?.percentile ?? 0),
  };
}

function cwvPass(lcp: number, cls: number, inp: number): boolean {
  return lcp > 0 && lcp <= 2500 && cls <= 0.1 && (inp === 0 || inp <= 200);
}

async function upsertCheck(clientId: string, agencyId: string, def: HealthCheckDef, status: HealthStatus, evidence: string | null, evidenceUrl: string | null, metric: string | null, userId: string | null) {
  const exists = (await exec({ sql: `SELECT client_id FROM health_checks WHERE client_id = ? AND key = ? LIMIT 1`, args: [clientId, def.key] })).rows[0];
  if (exists) {
    await exec({ sql: `UPDATE health_checks SET category=?, status=?, weight=?, auto=?, evidence=?, evidence_url=?, metric_value=?, updated_by=?, updated_at=? WHERE client_id=? AND key=?`, args: [def.category, status, def.weight, def.auto ? 1 : 0, evidence, evidenceUrl, metric, userId, now(), clientId, def.key] });
  } else {
    await exec({ sql: `INSERT INTO health_checks (client_id, agency_id, key, category, status, weight, auto, client_visible, evidence, evidence_url, metric_value, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [clientId, agencyId, def.key, def.category, status, def.weight, def.auto ? 1 : 0, def.client_visible_default ? 1 : 0, evidence, evidenceUrl, metric, userId, now()] });
  }
}

async function loadGbpFor(clientId: string): Promise<{ business_name: string | null; category: string | null; website: string | null; address: string | null; phone: string | null; rating: number | null; review_count: number | null; updated_at: string | null } | null> {
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { rows } = await exec({ sql: `SELECT gbp_connection_id FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
    const gbpId = rows[0]?.gbp_connection_id as string | null;
    if (!gbpId) return null;
    const { data, error } = await sb.from("gbp_connections").select("business_name,category,website,address,phone,rating,review_count,updated_at").eq("id", gbpId).maybeSingle();
    if (error || !data) return null;
    return data as { business_name: string | null; category: string | null; website: string | null; address: string | null; phone: string | null; rating: number | null; review_count: number | null; updated_at: string | null };
  } catch { return null; }
}

interface ClientRow { id: string; name: string; agency_id: string; billing_email: string | null; phone: string | null; address_line1: string | null; city: string | null; region: string | null; postal_code: string | null; gbp_connection_id: string | null; stripe_customer_id: string | null; }

async function refreshAutoChecks(client: ClientRow, userId: string | null): Promise<void> {
  const gbp = await loadGbpFor(client.id);
  const [logoFiles, gbpCreds, subs] = await execMany([
    { sql: `SELECT id FROM vault_files WHERE client_id = ? AND (kind = 'logo' OR kind = 'brand') LIMIT 1`, args: [client.id] },
    { sql: `SELECT id FROM vault_credentials WHERE client_id = ? AND category = 'GBP' LIMIT 1`, args: [client.id] },
    { sql: `SELECT s.status, p.name FROM subscriptions s JOIN products p ON p.id = s.product_id WHERE s.client_id = ? AND s.status IN ('active','trialing')`, args: [client.id] },
  ]);
  const subNames = (subs.rows as Array<{ name: string | null }>).map((r) => (r.name || "").toLowerCase());
  const hasLocal = subNames.some((n) => n.includes("local") || n.includes("seo"));
  const hasSocial = subNames.some((n) => n.includes("social"));
  const hasReputation = subNames.some((n) => n.includes("reputation") || n.includes("review"));

  const website = gbp?.website ?? null;
  const email = client.billing_email ?? null;
  const emailDomain = email ? email.split("@")[1]?.toLowerCase() ?? "" : "";
  const businessEmail = email ? !FREE_EMAIL_DOMAINS.has(emailDomain) : false;
  const phone = client.phone ?? gbp?.phone ?? null;
  const address = client.address_line1 ?? gbp?.address ?? null;

  const lastSyncIso = gbp?.updated_at ?? null;
  const recentlySynced = lastSyncIso ? (Date.now() - new Date(lastSyncIso).getTime()) < 7 * 24 * 60 * 60 * 1000 : false;

  const cit = await exec({ sql: `SELECT status FROM health_citations WHERE client_id = ?`, args: [client.id] });
  const citRows = cit.rows as Array<{ status: string }>;
  const citPass = citRows.filter((r) => r.status === "pass").length;
  const citTotal = citRows.length;
  const citCoverage = citTotal > 0 ? citPass / citTotal : 0;

  const def = (k: string) => HEALTH_CATALOG.find((c) => c.key === k)!;
  const setSimple = (key: string, status: HealthStatus, evidence: string | null = null, metric: string | null = null) =>
    upsertCheck(client.id, client.agency_id, def(key), status, evidence, null, metric, userId);

  await setSimple("has_website", website ? "pass" : "fail", website ?? "no website on GBP", website);
  await setSimple("has_https", website ? (/^https:\/\//i.test(website) ? "pass" : "fail") : "unknown", website ? (/^https:\/\//i.test(website) ? "secure" : "uses HTTP only") : "no website");
  await setSimple("has_business_email", email ? (businessEmail ? "pass" : "fail") : "fail", email ?? "no email on file", email);
  await setSimple("has_phone", phone ? "pass" : "fail", phone ?? "no phone");
  await setSimple("has_address", address ? "pass" : "fail", address ?? "no address");
  await setSimple("has_category", gbp?.category ? "pass" : "fail", gbp?.category ?? "no GBP category", gbp?.category ?? null);

  await setSimple("gbp_connected", client.gbp_connection_id ? "pass" : "fail", client.gbp_connection_id ? "linked" : "not linked");
  await setSimple("gbp_recently_synced", client.gbp_connection_id ? (recentlySynced ? "pass" : "warn") : "skipped", lastSyncIso ?? "never synced");

  if (gbp?.review_count != null) {
    const n = gbp.review_count as number;
    await setSimple("review_count_floor", n >= 25 ? "pass" : n >= 10 ? "warn" : "fail", `${n} reviews`, String(n));
  } else {
    await setSimple("review_count_floor", "unknown", "no GBP data");
  }
  if (gbp?.rating != null) {
    const r = gbp.rating as number;
    await setSimple("review_rating_floor", r >= 4.0 ? "pass" : r >= 3.5 ? "warn" : "fail", `${r.toFixed(1)} stars`, r.toFixed(1));
  } else {
    await setSimple("review_rating_floor", "unknown", "no GBP data");
  }

  await setSimple("citations_overall", citTotal === 0 ? "unknown" : citCoverage >= 0.7 ? "pass" : citCoverage >= 0.4 ? "warn" : "fail", citTotal === 0 ? "run citation scan" : `${citPass}/${citTotal} listed (${Math.round(citCoverage * 100)}%)`, String(Math.round(citCoverage * 100)));
  await setSimple("nap_consistency", citTotal === 0 ? "unknown" : citPass >= 3 ? "pass" : citPass >= 1 ? "warn" : "fail", citTotal === 0 ? "run citation scan" : `${citPass} confirmed listings`);

  await setSimple("payment_method_on_file", client.stripe_customer_id ? "pass" : "fail", client.stripe_customer_id ? "Stripe customer linked" : "no Stripe customer");
  await setSimple("brand_assets_uploaded", logoFiles.rows[0] ? "pass" : "fail", logoFiles.rows[0] ? "logo/brand asset in Vault" : "no brand assets");
  await setSimple("gbp_credentials_in_vault", gbpCreds.rows[0] ? "pass" : "fail", gbpCreds.rows[0] ? "GBP credential stored" : "no GBP credential");
  await setSimple("local_seo_active", hasLocal ? "pass" : "fail", hasLocal ? "Local SEO subscription active" : "no Local SEO subscription");
  await setSimple("social_active", hasSocial ? "pass" : "fail", hasSocial ? "Social subscription active" : "no Social subscription");
  await setSimple("reputation_active", hasReputation ? "pass" : "fail", hasReputation ? "Reputation subscription active" : "no Reputation subscription");

  for (const c of HEALTH_CATALOG.filter((d) => !d.auto)) {
    const existing = (await exec({ sql: `SELECT status FROM health_checks WHERE client_id = ? AND key = ? LIMIT 1`, args: [client.id, c.key] })).rows[0];
    if (!existing) await upsertCheck(client.id, client.agency_id, c, "unknown", null, null, null, userId);
  }
}

function bucketFor(score: number): { bucket: "critical" | "needs_work" | "healthy" | "excellent"; label: string } {
  if (score >= 90) return { bucket: "excellent", label: "Excellent" };
  if (score >= 75) return { bucket: "healthy", label: "Healthy" };
  if (score >= 50) return { bucket: "needs_work", label: "Needs work" };
  return { bucket: "critical", label: "Critical" };
}
function statusWeight(s: string): number { return s === "pass" ? 1 : s === "warn" ? 0.5 : s === "fail" ? 0 : -1; }

async function summariseHealth(clientId: string) {
  const [checks, audits] = await execMany([
    { sql: `SELECT * FROM health_checks WHERE client_id = ? ORDER BY category, key`, args: [clientId] },
    { sql: `SELECT * FROM health_audits WHERE client_id = ? ORDER BY created_at DESC LIMIT 4`, args: [clientId] },
  ]);
  let totalWeight = 0; let earned = 0;
  for (const r of checks.rows as Array<{ status: string; weight: number }>) {
    const w = statusWeight(r.status); if (w < 0) continue;
    totalWeight += r.weight; earned += w * r.weight;
  }
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
  return { score, ...bucketFor(score), checks: checks.rows, audits: audits.rows };
}

async function handle(action: string, payload: Record<string, unknown>, ctx: AuthCtx): Promise<unknown> {
  const ts = tenantScope(ctx);
  switch (action) {
    case "ping": return { ok: true, agency_id: ctx.agencyId, super_admin: ctx.isSuperAdmin };

    case "metrics.summary": {
      const [clients, mrr, openInv, paid30] = await execMany([
        { sql: `SELECT COUNT(*) as count FROM clients WHERE status = 'active' AND ${ts.sql}`, args: ts.args },
        { sql: `SELECT COALESCE(SUM(p.price_cents * s.quantity), 0) as cents FROM subscriptions s JOIN products p ON p.id = s.product_id JOIN clients c ON c.id = s.client_id WHERE s.status IN ('active','trialing') AND ${ts.sql.replace(/agency_id/g, "c.agency_id")}`, args: ts.args },
        { sql: `SELECT COUNT(*) as count, COALESCE(SUM(amount_cents),0) as cents FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.status IN ('open','past_due') AND ${ts.sql.replace(/agency_id/g, "c.agency_id")}`, args: ts.args },
        { sql: `SELECT COALESCE(SUM(amount_cents),0) as cents FROM payments p JOIN clients c ON c.id = p.client_id WHERE p.status = 'succeeded' AND p.paid_at >= datetime('now','-30 day') AND ${ts.sql.replace(/agency_id/g, "c.agency_id")}`, args: ts.args },
      ]);
      return { active_clients: clients.rows[0]?.count ?? 0, mrr_cents: mrr.rows[0]?.cents ?? 0, open_invoices: openInv.rows[0]?.count ?? 0, open_invoice_cents: openInv.rows[0]?.cents ?? 0, paid30_cents: paid30.rows[0]?.cents ?? 0 };
    }

    case "products.list": {
      const { rows } = await exec({ sql: `SELECT * FROM products WHERE active = 1 ORDER BY price_cents ASC` });
      return rows;
    }
    case "products.upsert": {
      const id = (payload.id as string) || uuid();
      await exec({ sql: `INSERT INTO products (id, name, description, price_cents, currency, interval, stripe_price_id, active) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, price_cents=excluded.price_cents, currency=excluded.currency, interval=excluded.interval, stripe_price_id=excluded.stripe_price_id, active=excluded.active`, args: [id, payload.name as string, (payload.description as string) ?? null, (payload.price_cents as number) ?? 0, (payload.currency as string) ?? "CAD", (payload.interval as string) ?? "month", (payload.stripe_price_id as string) ?? null, (payload.active as number) ?? 1] });
      return { id };
    }

    case "clients.list": {
      const status = payload.status as string | undefined;
      const search = payload.search as string | undefined;
      const where: string[] = [ts.sql]; const args: SqlValue[] = [...ts.args];
      if (status && status !== "all") { where.push("status = ?"); args.push(status); }
      if (search) { where.push("(name LIKE ? OR billing_email LIKE ? OR city LIKE ?)"); const s = `%${search}%`; args.push(s, s, s); }
      const { rows } = await exec({ sql: `SELECT id, name, status, billing_email, phone, city, region, gbp_connection_id, agency_id, created_at FROM clients WHERE ${where.join(" AND ")} ORDER BY updated_at DESC LIMIT 200`, args });
      return rows;
    }
    case "clients.get": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      const [client, contacts, subs, invs, pays] = await execMany([
        { sql: `SELECT * FROM clients WHERE id = ? LIMIT 1`, args: [id] },
        { sql: `SELECT * FROM contacts WHERE client_id = ? ORDER BY is_primary DESC, name ASC`, args: [id] },
        { sql: `SELECT s.*, p.name as product_name, p.price_cents as product_price_cents, p.currency as product_currency, p.interval as product_interval FROM subscriptions s JOIN products p ON p.id = s.product_id WHERE s.client_id = ? ORDER BY s.created_at DESC`, args: [id] },
        { sql: `SELECT * FROM invoices WHERE client_id = ? ORDER BY issued_at DESC LIMIT 50`, args: [id] },
        { sql: `SELECT * FROM payments WHERE client_id = ? ORDER BY paid_at DESC LIMIT 50`, args: [id] },
      ]);
      return { client: client.rows[0] ?? null, contacts: contacts.rows, subscriptions: subs.rows, invoices: invs.rows, payments: pays.rows };
    }
    case "clients.create": {
      const id = (payload.id as string) || uuid();
      await exec({ sql: `INSERT INTO clients (id, name, status, source, owner_id, billing_email, phone, address_line1, city, region, postal_code, country, gbp_connection_id, notes, agency_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, payload.name as string, (payload.status as string) ?? "lead", (payload.source as string) ?? null, (payload.owner_id as string) ?? null, (payload.billing_email as string) ?? null, (payload.phone as string) ?? null, (payload.address_line1 as string) ?? null, (payload.city as string) ?? null, (payload.region as string) ?? null, (payload.postal_code as string) ?? null, (payload.country as string) ?? null, (payload.gbp_connection_id as string) ?? null, (payload.notes as string) ?? null, ctx.agencyId] });
      return { id };
    }
    case "clients.update": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      const fields: string[] = []; const args: SqlValue[] = [];
      const updatable = ["name","status","source","owner_id","billing_email","phone","address_line1","city","region","postal_code","country","gbp_connection_id","stripe_customer_id","notes"];
      for (const k of updatable) if (k in payload) { fields.push(`${k} = ?`); args.push((payload[k] as SqlValue) ?? null); }
      fields.push("updated_at = ?"); args.push(now());
      args.push(id);
      await exec({ sql: `UPDATE clients SET ${fields.join(", ")} WHERE id = ?`, args });
      return { ok: true };
    }
    case "clients.archive": {
      const id = payload.id as string; await assertClientAccess(ctx, id);
      await exec({ sql: `UPDATE clients SET status = 'archived', updated_at = ? WHERE id = ?`, args: [now(), id] });
      return { ok: true };
    }
    case "clients.bulkImport": {
      const items = (payload.items as Array<Record<string, SqlValue>>) ?? [];
      let created = 0; let skipped = 0;
      for (const r of items) {
        const id = uuid();
        try {
          await exec({ sql: `INSERT INTO clients (id, name, status, source, billing_email, phone, address_line1, city, region, postal_code, country, notes, agency_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, (r.name as string) ?? "Untitled", (r.status as string) ?? "prospect", (r.source as string) ?? "import", (r.billing_email as string) ?? null, (r.phone as string) ?? null, (r.address_line1 as string) ?? null, (r.city as string) ?? null, (r.region as string) ?? null, (r.postal_code as string) ?? null, (r.country as string) ?? null, (r.notes as string) ?? null, ctx.agencyId] });
          created++;
        } catch { skipped++; }
      }
      return { created, skipped };
    }

    case "contacts.upsert": {
      const id = (payload.id as string) || uuid();
      await assertClientAccess(ctx, payload.client_id as string);
      await exec({ sql: `INSERT INTO contacts (id, client_id, name, email, phone, role, is_primary) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, phone=excluded.phone, role=excluded.role, is_primary=excluded.is_primary`, args: [id, payload.client_id as string, payload.name as string, (payload.email as string) ?? null, (payload.phone as string) ?? null, (payload.role as string) ?? null, (payload.is_primary as number) ?? 0] });
      return { id };
    }
    case "contacts.delete": {
      await exec({ sql: `DELETE FROM contacts WHERE id = ?`, args: [payload.id as string] });
      return { ok: true };
    }

    case "subscriptions.create": {
      await assertClientAccess(ctx, payload.client_id as string);
      const id = uuid();
      await exec({ sql: `INSERT INTO subscriptions (id, client_id, product_id, quantity, status, start_date) VALUES (?,?,?,?,?,?)`, args: [id, payload.client_id as string, payload.product_id as string, (payload.quantity as number) ?? 1, "active", now()] });
      return { id };
    }
    case "subscriptions.cancel": {
      await exec({ sql: `UPDATE subscriptions SET status = ?, cancel_at_period_end = ?, updated_at = ? WHERE id = ?`, args: [payload.at_period_end ? "active" : "canceled", payload.at_period_end ? 1 : 0, now(), payload.id as string] });
      return { ok: true };
    }
    case "invoices.list": {
      const { rows } = await exec({ sql: `SELECT i.* FROM invoices i JOIN clients c ON c.id = i.client_id WHERE ${ts.sql.replace(/agency_id/g, "c.agency_id")} ORDER BY i.issued_at DESC LIMIT 200`, args: ts.args });
      return rows;
    }

    case "stripe.checkoutForSubscription": {
      await assertClientAccess(ctx, payload.client_id as string);
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY"); if (!stripeKey) return { error: "Stripe not configured" };
      const { default: Stripe } = await import("https://esm.sh/stripe@14.21.0?target=deno");
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
      const { rows: clientRows } = await exec({ sql: `SELECT id, name, billing_email, stripe_customer_id FROM clients WHERE id = ?`, args: [payload.client_id as string] });
      const c = clientRows[0]; if (!c) return { error: "client not found" };
      const { rows: prodRows } = await exec({ sql: `SELECT * FROM products WHERE id = ?`, args: [payload.product_id as string] });
      const p = prodRows[0]; if (!p) return { error: "product not found" };
      let customerId = c.stripe_customer_id as string | null;
      if (!customerId && c.billing_email) { const cust = await stripe.customers.create({ email: c.billing_email as string, name: c.name as string, metadata: { client_id: c.id as string } }); customerId = cust.id; await exec({ sql: `UPDATE clients SET stripe_customer_id = ? WHERE id = ?`, args: [customerId, c.id as string] }); }
      let priceId = p.stripe_price_id as string | null;
      if (!priceId) { const price = await stripe.prices.create({ unit_amount: p.price_cents as number, currency: (p.currency as string).toLowerCase(), recurring: { interval: (p.interval as "day"|"week"|"month"|"year") }, product_data: { name: p.name as string } }); priceId = price.id; await exec({ sql: `UPDATE products SET stripe_price_id = ? WHERE id = ?`, args: [priceId, p.id as string] }); }
      const session = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId ?? undefined, customer_email: customerId ? undefined : (c.billing_email as string | undefined), line_items: [{ price: priceId, quantity: (payload.quantity as number) ?? 1 }], success_url: payload.success_url as string, cancel_url: payload.cancel_url as string, metadata: { client_id: c.id as string, product_id: p.id as string } });
      return { url: session.url };
    }

    // ── Vault ────────────────────────────────────────────────
    case "vault.list": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const [notes, creds, files] = await execMany([
        { sql: `SELECT * FROM vault_notes WHERE client_id = ? ORDER BY pinned DESC, updated_at DESC`, args: [clientId] },
        { sql: `SELECT * FROM vault_credentials WHERE client_id = ? ORDER BY label ASC`, args: [clientId] },
        { sql: `SELECT * FROM vault_files WHERE client_id = ? ORDER BY created_at DESC`, args: [clientId] },
      ]);
      return { notes: notes.rows, credentials: creds.rows, files: files.rows };
    }
    case "vault.notes.upsert": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const id = (payload.id as string) || uuid();
      const exists = (await exec({ sql: `SELECT id FROM vault_notes WHERE id = ?`, args: [id] })).rows[0];
      if (exists) {
        await exec({ sql: `UPDATE vault_notes SET title=?, body=?, visibility=?, pinned=?, updated_at=? WHERE id=?`, args: [payload.title as string, payload.body as string, (payload.visibility as string) ?? "agency_only", (payload.pinned as number) ?? 0, now(), id] });
      } else {
        await exec({ sql: `INSERT INTO vault_notes (id, client_id, agency_id, title, body, visibility, pinned, created_by) VALUES (?,?,?,?,?,?,?,?)`, args: [id, clientId, ctx.agencyId, payload.title as string, payload.body as string, (payload.visibility as string) ?? "agency_only", (payload.pinned as number) ?? 0, ctx.userId] });
      }
      return { id };
    }
    case "vault.notes.delete": {
      await exec({ sql: `DELETE FROM vault_notes WHERE id = ?`, args: [payload.id as string] });
      return { ok: true };
    }
    case "vault.creds.upsert": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const id = (payload.id as string) || uuid();
      const exists = (await exec({ sql: `SELECT id FROM vault_credentials WHERE id = ?`, args: [id] })).rows[0];
      const args: SqlValue[] = [
        payload.label as string, (payload.category as string) ?? null, (payload.username as string) ?? null,
        (payload.password as string) ?? null, (payload.url as string) ?? null, (payload.mfa_method as string) ?? null,
        (payload.mfa_codes as string) ?? null, (payload.notes as string) ?? null, (payload.visibility as string) ?? "agency_only", now(),
      ];
      if (exists) {
        await exec({ sql: `UPDATE vault_credentials SET label=?, category=?, username=?, password=?, url=?, mfa_method=?, mfa_codes=?, notes=?, visibility=?, updated_at=? WHERE id=?`, args: [...args, id] });
      } else {
        await exec({ sql: `INSERT INTO vault_credentials (id, client_id, agency_id, label, category, username, password, url, mfa_method, mfa_codes, notes, visibility, created_by, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, clientId, ctx.agencyId, payload.label as string, (payload.category as string) ?? null, (payload.username as string) ?? null, (payload.password as string) ?? null, (payload.url as string) ?? null, (payload.mfa_method as string) ?? null, (payload.mfa_codes as string) ?? null, (payload.notes as string) ?? null, (payload.visibility as string) ?? "agency_only", ctx.userId, now()] });
      }
      return { id };
    }
    case "vault.creds.delete": {
      await exec({ sql: `DELETE FROM vault_credentials WHERE id = ?`, args: [payload.id as string] });
      return { ok: true };
    }
    case "vault.files.uploadUrl": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const fileId = uuid();
      const filename = safeName(payload.filename as string);
      const path = `${ctx.agencyId}/${clientId}/${fileId}/${filename}`;
      const { data, error } = await adminStorage.from("client-files").createSignedUploadUrl(path);
      if (error) return { error: error.message };
      return { id: fileId, path, signedUrl: data.signedUrl, token: data.token };
    }
    case "vault.files.confirm": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      await exec({ sql: `INSERT INTO vault_files (id, client_id, agency_id, storage_path, filename, mime_type, size_bytes, kind, visibility, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)`, args: [payload.id as string, clientId, ctx.agencyId, payload.path as string, payload.filename as string, (payload.mime_type as string) ?? null, (payload.size_bytes as number) ?? null, (payload.kind as string) ?? null, (payload.visibility as string) ?? "agency_only", ctx.userId] });
      return { ok: true };
    }
    case "vault.files.update": {
      await exec({ sql: `UPDATE vault_files SET kind=?, visibility=? WHERE id=?`, args: [(payload.kind as string) ?? null, (payload.visibility as string) ?? "agency_only", payload.id as string] });
      return { ok: true };
    }
    case "vault.files.download": {
      const { rows } = await exec({ sql: `SELECT storage_path, filename FROM vault_files WHERE id = ?`, args: [payload.id as string] });
      if (!rows[0]) return { error: "file not found" };
      const { data, error } = await adminStorage.from("client-files").createSignedUrl(rows[0].storage_path as string, 300, { download: rows[0].filename as string });
      if (error) return { error: error.message };
      return { url: data.signedUrl };
    }
    case "vault.files.delete": {
      const { rows } = await exec({ sql: `SELECT storage_path FROM vault_files WHERE id = ?`, args: [payload.id as string] });
      if (rows[0]) await adminStorage.from("client-files").remove([rows[0].storage_path as string]);
      await exec({ sql: `DELETE FROM vault_files WHERE id = ?`, args: [payload.id as string] });
      return { ok: true };
    }

    // ── Agencies ────────────────────────────────────────────
    case "agencies.list": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const { rows } = await exec({ sql: `SELECT * FROM agencies ORDER BY name ASC` });
      return rows;
    }
    case "agencies.create": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const id = (payload.slug as string).toLowerCase();
      await exec({ sql: `INSERT INTO agencies (id, name, slug) VALUES (?,?,?)`, args: [id, payload.name as string, id] });
      return { id };
    }
    case "agencies.invite": {
      if (!ctx.isSuperAdmin) return { error: "Forbidden: super-admin only" };
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const email = (payload.email as string).toLowerCase();
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) return { error: listErr.message };
      const user = list.users.find((u) => u.email?.toLowerCase() === email);
      if (!user) return { error: `No user with email ${email}. Have them sign up first.` };
      await exec({ sql: `INSERT OR REPLACE INTO agency_members (user_id, agency_id, role) VALUES (?,?,?)`, args: [user.id, payload.agency_id as string, (payload.role as string) ?? "member"] });
      return { ok: true, user_id: user.id };
    }

    case "health.summary": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const data = await summariseHealth(clientId);
      return data;
    }
    case "health.refreshAuto": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const { rows } = await exec({ sql: `SELECT id, name, agency_id, billing_email, phone, address_line1, city, region, postal_code, gbp_connection_id, stripe_customer_id FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
      const client = rows[0] as unknown as ClientRow | undefined;
      if (!client) return { error: "client not found" };
      await refreshAutoChecks(client, ctx.userId);
      const data = await summariseHealth(clientId);
      return { ok: true, ...data };
    }
    case "health.runLighthouse": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const gbp = await loadGbpFor(clientId);
      const { rows: cRows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ?`, args: [clientId] });
      const agencyId = (cRows[0]?.agency_id as string) || ctx.agencyId;
      const url = (payload.url as string) || gbp?.website || null;
      if (!url) return { error: "No website URL on file. Add a website to the client's GBP first." };
      const def = (k: string) => HEALTH_CATALOG.find((c) => c.key === k)!;
      const [mobile, desktop] = await Promise.allSettled([runPSI(url, "mobile"), runPSI(url, "desktop")]);
      let mobileRes: Awaited<ReturnType<typeof runPSI>> | null = null;
      let desktopRes: Awaited<ReturnType<typeof runPSI>> | null = null;
      if (mobile.status === "fulfilled") mobileRes = mobile.value;
      if (desktop.status === "fulfilled") desktopRes = desktop.value;
      if (!mobileRes && !desktopRes) {
        const err = mobile.status === "rejected" ? (mobile.reason as Error).message : (desktop as PromiseRejectedResult).reason?.message;
        await upsertCheck(clientId, agencyId, def("mobile_friendly"), "fail", err?.slice(0, 200) ?? "audit failed", url, null, ctx.userId);
        await exec({ sql: `INSERT INTO health_audits (id, client_id, url, strategy, error) VALUES (?,?,?,?,?)`, args: [uuid(), clientId, url, "mobile", err?.slice(0, 500) ?? "audit failed"] });
        return { error: `PageSpeed audit failed: ${err}` };
      }
      const stmts: ExecRequest[] = [];
      for (const [strategy, r] of [["mobile", mobileRes], ["desktop", desktopRes]] as const) {
        if (!r) continue;
        const cwv = cwvPass(r.lcp_ms, r.cls, r.inp_ms);
        stmts.push({ sql: `INSERT INTO health_audits (id, client_id, url, strategy, performance, seo, accessibility, best_practices, lcp_ms, cls, inp_ms, cwv_pass) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, args: [uuid(), clientId, url, strategy, r.performance, r.seo, r.accessibility, r.best_practices, r.lcp_ms, r.cls, r.inp_ms, cwv ? 1 : 0] });
      }
      if (stmts.length) await execMany(stmts);
      const primary = mobileRes ?? desktopRes!;
      const score = (n: number, good: number, warn: number): HealthStatus => n >= good ? "pass" : n >= warn ? "warn" : "fail";
      await upsertCheck(clientId, agencyId, def("lighthouse_performance"), score(primary.performance, 80, 50), `${primary.performance}/100 (mobile)`, url, String(primary.performance), ctx.userId);
      await upsertCheck(clientId, agencyId, def("lighthouse_seo"), score(primary.seo, 90, 70), `${primary.seo}/100`, url, String(primary.seo), ctx.userId);
      await upsertCheck(clientId, agencyId, def("lighthouse_accessibility"), score(primary.accessibility, 90, 70), `${primary.accessibility}/100`, url, String(primary.accessibility), ctx.userId);
      await upsertCheck(clientId, agencyId, def("lighthouse_best_practices"), score(primary.best_practices, 90, 70), `${primary.best_practices}/100`, url, String(primary.best_practices), ctx.userId);
      const cwvOk = cwvPass(primary.lcp_ms, primary.cls, primary.inp_ms);
      await upsertCheck(clientId, agencyId, def("core_web_vitals"), cwvOk ? "pass" : "fail", `LCP ${primary.lcp_ms}ms · CLS ${primary.cls} · INP ${primary.inp_ms}ms`, url, null, ctx.userId);
      await upsertCheck(clientId, agencyId, def("mobile_friendly"), mobileRes ? "pass" : "warn", mobileRes ? "Mobile audit succeeded" : "Mobile audit failed", url, null, ctx.userId);
      const data = await summariseHealth(clientId);
      return { ok: true, mobile: mobileRes, desktop: desktopRes, ...data };
    }
    case "health.runCitations": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const { rows } = await exec({ sql: `SELECT id, name, agency_id, billing_email, phone, address_line1, city, region, postal_code, gbp_connection_id, stripe_customer_id FROM clients WHERE id = ? LIMIT 1`, args: [clientId] });
      const client = rows[0] as unknown as ClientRow | undefined; if (!client) return { error: "client not found" };
      const gbp = await loadGbpFor(clientId);
      const name = client.name || gbp?.business_name || "";
      const city = client.city || "";
      const phone = client.phone ?? gbp?.phone ?? "";
      const postal = client.postal_code ?? "";
      if (!name) return { error: "client name is required for citation scan" };
      const def = (k: string) => HEALTH_CATALOG.find((c) => c.key === k)!;
      const results: Array<{ key: string; name: string; status: HealthStatus; listing_url: string | null; evidence: string }> = [];
      for (const dir of DIRECTORIES) {
        const r = await probeDirectory(dir, name, city, name, phone, postal);
        results.push({ key: dir.key, name: dir.name, ...r });
        await exec({ sql: `INSERT OR REPLACE INTO health_citations (client_id, directory, status, listing_url, evidence, checked_at) VALUES (?,?,?,?,?,?)`, args: [clientId, dir.key, r.status, r.listing_url, r.evidence, now()] });
        await upsertCheck(clientId, client.agency_id, def(dir.key), r.status, r.evidence, r.listing_url, null, ctx.userId);
        await new Promise((res) => setTimeout(res, 400));
      }
      await refreshAutoChecks(client, ctx.userId);
      const data = await summariseHealth(clientId);
      return { ok: true, results, ...data };
    }
    case "health.toggleCheck": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const key = payload.key as string; const status = (payload.status as HealthStatus) || "unknown";
      const def = HEALTH_CATALOG.find((c) => c.key === key);
      if (!def) return { error: `unknown check key: ${key}` };
      const evidence = (payload.evidence as string) ?? null;
      const { rows } = await exec({ sql: `SELECT agency_id FROM clients WHERE id = ?`, args: [clientId] });
      const agencyId = (rows[0]?.agency_id as string) || ctx.agencyId;
      await upsertCheck(clientId, agencyId, def, status, evidence, null, null, ctx.userId);
      if ("client_visible" in payload) await exec({ sql: `UPDATE health_checks SET client_visible = ? WHERE client_id = ? AND key = ?`, args: [payload.client_visible ? 1 : 0, clientId, key] });
      const data = await summariseHealth(clientId);
      return { ok: true, ...data };
    }
    case "health.setMetric": {
      const clientId = payload.client_id as string; await assertClientAccess(ctx, clientId);
      const key = payload.key as string;
      await exec({ sql: `UPDATE health_checks SET metric_value = ?, updated_by = ?, updated_at = ? WHERE client_id = ? AND key = ?`, args: [(payload.metric as string) ?? null, ctx.userId, now(), clientId, key] });
      return { ok: true };
    }

    default: return { error: `unknown action: ${action}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing bearer token" });
    if (!BUNNY_URL || !BUNNY_TOKEN) return json({ error: "Bunny database not configured" });
    await bootstrap();
    const ctxOrErr = await resolveAuth(token);
    if ("error" in ctxOrErr) return json(ctxOrErr);
    const body = await req.json().catch(() => ({}));
    const result = await handle(body.action as string, (body.payload as Record<string, unknown>) ?? {}, ctxOrErr);
    return json(result);
  } catch (err) {
    console.error("bunny-rpc error", err);
    return json({ error: (err as Error).message ?? "internal error" });
  }
});
