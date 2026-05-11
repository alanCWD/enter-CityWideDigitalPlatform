// Portal Vault — read-only endpoint used by client-portal users to access
// the items their agency has marked as `client_visible` for them.
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
const STORAGE_BUCKET = "client-files";

type SqlValue = string | number | null;
function bunnyHttpBase() { let u = (BUNNY_URL ?? "").trim().replace(/\/$/, ""); u = u.replace(/^libsql:\/\//i, "https://"); if (!/^https?:\/\//i.test(u)) u = `https://${u}`; return u; }

async function exec(sql: string, args: SqlValue[] = []) {
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql, args: args.map((v) => v === null ? { type: "null" } : typeof v === "number" ? { type: "integer", value: String(v) } : { type: "text", value: String(v) }) } }, { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`Bunny HTTP ${res.status}`);
  const data = await res.json() as { results: Array<{ response?: { result?: { cols: { name: string }[]; rows: Array<Array<{ type: string; value?: string }>> } }; error?: { message: string } }> };
  const r = data.results[0];
  if (r.error) throw new Error(r.error.message);
  const cols = r.response?.result?.cols ?? [];
  return (r.response?.result?.rows ?? []).map((row) => {
    const obj: Record<string, SqlValue> = {};
    cols.forEach((c, i) => { const v = row[i]; if (!v || v.type === "null") obj[c.name] = null; else if (v.type === "integer" || v.type === "float") obj[c.name] = Number(v.value); else obj[c.name] = v.value ?? null; });
    return obj;
  });
}

const adminStorage = createClient(SUPABASE_URL, SERVICE_KEY).storage;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing bearer token" });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid token" });

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const payload = (body.payload as Record<string, unknown>) ?? {};

    async function resolveClient(connectionId: string) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: pu } = await admin.from("portal_users").select("connection_id").eq("user_id", userData.user!.id).eq("connection_id", connectionId).maybeSingle();
      if (!pu) throw new Error("Forbidden: not a portal user for this connection");
      const rows = await exec(`SELECT id, agency_id, name FROM clients WHERE gbp_connection_id = ? LIMIT 1`, [connectionId]);
      if (!rows[0]) throw new Error("No CRM client linked to this connection yet");
      return rows[0];
    }

    switch (action) {
      case "list": {
        const client = await resolveClient(payload.connection_id as string);
        const clientId = client.id as string;
        const notes = await exec(`SELECT id, title, body, pinned, created_at, updated_at FROM vault_notes WHERE client_id = ? AND visibility = 'client_visible' ORDER BY pinned DESC, updated_at DESC`, [clientId]);
        const credentials = await exec(`SELECT id, label, category, url, username, password, mfa_notes, notes, updated_at FROM vault_credentials WHERE client_id = ? AND visibility = 'client_visible' ORDER BY label`, [clientId]);
        const files = await exec(`SELECT id, filename, mime_type, size_bytes, kind, created_at FROM vault_files WHERE client_id = ? AND visibility = 'client_visible' ORDER BY created_at DESC`, [clientId]);
        return json({ client_name: client.name, notes, credentials, files });
      }
      case "download": {
        const fileId = payload.file_id as string;
        const rows = await exec(`SELECT * FROM vault_files WHERE id = ? LIMIT 1`, [fileId]);
        const f = rows[0]; if (!f) return json({ error: "not found" });
        if (f.visibility !== "client_visible") return json({ error: "Forbidden" });
        const linked = await exec(`SELECT gbp_connection_id FROM clients WHERE id = ?`, [f.client_id as string]);
        const connectionId = linked[0]?.gbp_connection_id as string | null;
        if (!connectionId) return json({ error: "client not linked" });
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: pu } = await admin.from("portal_users").select("connection_id").eq("user_id", userData.user!.id).eq("connection_id", connectionId).maybeSingle();
        if (!pu) return json({ error: "Forbidden" });
        const { data, error } = await adminStorage.from(STORAGE_BUCKET).createSignedUrl(f.storage_path as string, 300);
        if (error) return json({ error: error.message });
        return json({ url: data.signedUrl, filename: f.filename, mime_type: f.mime_type });
      }
      default: return json({ error: `unknown action: ${action}` });
    }
  } catch (err) {
    console.error("portal-vault error", err);
    return json({ error: (err as Error).message ?? "internal error" });
  }
});
