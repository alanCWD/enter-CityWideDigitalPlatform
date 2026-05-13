// Read-only client-portal endpoint for the Digital Health dashboard.
// Returns only checks marked client_visible = 1, hides agency-internal evidence.
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

function bunnyHttpBase(): string { let u = (BUNNY_URL ?? "").trim().replace(/\/$/, ""); u = u.replace(/^libsql:\/\//i, "https://"); if (!/^https?:\/\//i.test(u)) u = `https://${u}`; return u; }

async function execMany(stmts: ExecRequest[]) {
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [...stmts.map((s) => ({ type: "execute", stmt: { sql: s.sql, args: (s.args ?? []).map((v) => v === null || v === undefined ? { type: "null" } : typeof v === "number" ? { type: "integer", value: String(v) } : { type: "text", value: String(v) }) } })), { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`Bunny HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json() as { results: Array<{ type: string; response?: { result?: { cols: { name: string }[]; rows: Array<Array<{ type: string; value?: string }>> } }; error?: { message: string } }> };
  const out: { rows: BunnyRow[] }[] = [];
  for (let i = 0; i < stmts.length; i++) {
    const r = data.results[i];
    if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "bunny error");
    const cols = r.response?.result?.cols ?? [];
    const rows = (r.response?.result?.rows ?? []).map((arr) => { const o: BunnyRow = {}; cols.forEach((c, i) => { const v = arr[i]; if (!v || v.type === "null") o[c.name] = null; else if (v.type === "integer" || v.type === "float") o[c.name] = Number(v.value); else o[c.name] = v.value ?? null; }); return o; });
    out.push({ rows });
  }
  return out;
}

function bucketFor(score: number): { bucket: string; label: string } {
  if (score >= 90) return { bucket: "excellent", label: "Excellent" };
  if (score >= 75) return { bucket: "healthy", label: "Healthy" };
  if (score >= 50) return { bucket: "needs_work", label: "Needs work" };
  return { bucket: "critical", label: "Critical" };
}
function statusWeight(s: string): number { return s === "pass" ? 1 : s === "warn" ? 0.5 : s === "fail" ? 0 : -1; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing bearer token" });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid token" });
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const connectionId = body.connection_id as string;
    if (!connectionId) return json({ error: "connection_id required" });

    // Verify portal access via portal_users -> gbp_connections
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: pu, error: puErr } = await admin.from("portal_users").select("connection_id").eq("user_id", userId).eq("connection_id", connectionId).maybeSingle();
    if (puErr || !pu) return json({ error: "Forbidden: portal access not granted" });

    // Resolve CRM client by gbp connection
    const [clientLookup] = await execMany([
      { sql: `SELECT id, name, status FROM clients WHERE gbp_connection_id = ? LIMIT 1`, args: [connectionId] },
    ]);
    const client = clientLookup.rows[0];
    if (!client) return json({ error: "No CRM client linked to this connection yet" });
    const clientId = client.id as string;

    const [checks, audits] = await execMany([
      { sql: `SELECT key, category, status, weight, evidence, evidence_url, metric_value, updated_at FROM health_checks WHERE client_id = ? AND client_visible = 1 ORDER BY category, key`, args: [clientId] },
      { sql: `SELECT strategy, performance, seo, accessibility, best_practices, lcp_ms, cls, inp_ms, cwv_pass, created_at FROM health_audits WHERE client_id = ? ORDER BY created_at DESC LIMIT 4`, args: [clientId] },
    ]);

    let totalWeight = 0; let earned = 0;
    for (const r of checks.rows as Array<{ status: string; weight: number }>) {
      const w = statusWeight(r.status); if (w < 0) continue;
      totalWeight += r.weight; earned += w * r.weight;
    }
    const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
    return json({ score, ...bucketFor(score), client_name: client.name, checks: checks.rows, audits: audits.rows });
  } catch (err) {
    console.error("portal-health error", err);
    return json({ error: (err as Error).message ?? "internal error" });
  }
});
