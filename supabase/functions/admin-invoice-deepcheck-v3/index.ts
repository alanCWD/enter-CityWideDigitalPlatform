const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function bunnyBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}
const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";
type SqlValue = string | number | null;
async function exec(sql: string, args: SqlValue[] = []) {
  const res = await fetch(`${bunnyBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql, args: args.map((v) => v === null || v === undefined ? { type: "null" } : typeof v === "number" ? { type: "integer", value: String(v) } : { type: "text", value: String(v) }) } }, { type: "close" }] }),
  });
  if (!res.ok) throw new Error(`Bunny ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const r = data.results[0];
  if (r.type === "error" || r.error) throw new Error(r.error?.message ?? "bunny error");
  const cols = r.response?.result?.cols ?? [];
  return (r.response?.result?.rows ?? []).map((arr: Array<{ type: string; value?: string }>) => {
    const o: Record<string, SqlValue> = {};
    cols.forEach((c: { name: string }, i: number) => {
      const v = arr[i];
      if (!v || v.type === "null") o[c.name] = null;
      else if (v.type === "integer" || v.type === "float") o[c.name] = Number(v.value);
      else o[c.name] = v.value ?? null;
    });
    return o;
  });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const rows = await exec(`SELECT id, number, client_id, line_items, subscription_id, subtotal_cents, total_cents FROM invoices WHERE id IN (?,?,?,?)`, [
      "4fea4f7a-dda4-4088-895b-7fba7fc86973",
      "f840292d-9c66-487d-ad8e-678c51e7dbdd",
      "5ab0034c-0178-4993-abaf-fb75cd388fdd",
      "b2516706-5232-4fa1-a595-693ae981759c",
    ]);
    return new Response(JSON.stringify({ rows }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
