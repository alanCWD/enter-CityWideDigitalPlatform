/**
 * Minimal read access to the CRM database (Bunny/libSQL) for the recorder
 * integration. Mirrors the read-only query path used by seo-api: credentials
 * come from server secrets and are never returned to callers or logged.
 */

export interface CrmClientRow {
  id: string;
  name: string;
  status: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  address_line1: string | null;
  industry: string | null;
  agency_id: string | null;
  updated_at: string | null;
}

type SqlValue = string | number | null;
type Row = Record<string, SqlValue>;

function bunnyHttpBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BUNNY_TOKEN = () => Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";

export function crmConfigured(): boolean {
  const base = bunnyHttpBase();
  return Boolean(BUNNY_TOKEN() && base && base !== "https://");
}

async function execMany(stmts: Array<{ sql: string; args?: SqlValue[] }>): Promise<Row[][]> {
  if (!crmConfigured()) throw new Error("CRM database is not configured.");
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${BUNNY_TOKEN()}`, "Content-Type": "application/json" },
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
  if (!res.ok) throw new Error(`CRM database answered with status ${res.status}.`);

  const data = await res.json() as {
    results: Array<{
      type: string;
      response?: { result?: { cols: Array<{ name: string }>; rows: Array<Array<{ type: string; value?: string }>> } };
      error?: { message: string };
    }>;
  };

  const out: Row[][] = [];
  for (let i = 0; i < stmts.length; i++) {
    const r = data.results?.[i];
    if (!r) throw new Error("CRM database returned an incomplete response.");
    if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "CRM query failed.");
    const cols = r.response?.result?.cols ?? [];
    const rows = (r.response?.result?.rows ?? []).map((cells) => {
      const row: Row = {};
      cols.forEach((c, idx) => {
        const v = cells[idx];
        if (!v || v.type === "null") row[c.name] = null;
        else if (v.type === "integer" || v.type === "float") row[c.name] = Number(v.value);
        else row[c.name] = v.value ?? null;
      });
      return row;
    });
    out.push(rows);
  }
  return out;
}

async function exec(sql: string, args: SqlValue[] = []): Promise<Row[]> {
  return (await execMany([{ sql, args }]))[0];
}

const CLIENT_COLUMNS =
  "id, name, status, website, phone, city, region, address_line1, industry, agency_id, updated_at";

function toClient(row: Row): CrmClientRow {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? "").toLowerCase(),
    website: row.website == null ? null : String(row.website),
    phone: row.phone == null ? null : String(row.phone),
    city: row.city == null ? null : String(row.city),
    region: row.region == null ? null : String(row.region),
    address_line1: row.address_line1 == null ? null : String(row.address_line1),
    industry: row.industry == null ? null : String(row.industry),
    agency_id: row.agency_id == null ? null : String(row.agency_id),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  };
}

export async function getCrmClient(id: string): Promise<CrmClientRow | null> {
  if (!id) return null;
  const rows = await exec(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? toClient(rows[0]) : null;
}

export async function listActiveClients(limit = 5000): Promise<CrmClientRow[]> {
  const rows = await exec(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE status = 'active' ORDER BY name ASC LIMIT ?`,
    [Math.max(1, Math.min(limit, 5000))],
  );
  return rows.map(toClient).filter((c) => c.id);
}

export async function activeClientIds(): Promise<Set<string>> {
  const rows = await exec(`SELECT id FROM clients WHERE status = 'active' LIMIT 5000`);
  return new Set(rows.map((r) => String(r.id ?? "")).filter(Boolean));
}
