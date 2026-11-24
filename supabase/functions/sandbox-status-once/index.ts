// One-off sandbox helper: switch the Starter sandbox client between active and
// suspended so the suspended-account contract can be verified against live CED
// data. It can touch exactly one client id and two status values, nothing else.
//
// Guard: `x-seed-secret` must hash to the value below; the plaintext was
// generated outside the repository and is never stored here. The secret is
// deleted after the check, which makes this endpoint inert.

const SEED_SECRET_SHA256 = "60374c6add94f29b79473137878ab9b4b0015ec81a0b268cea73ffbd0c521572";
const ALLOWED_CLIENT = "cwd-citywide-starter";
const ALLOWED_STATUS = new Set(["active", "suspended"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function bunnyHttpBase(): string {
  let u = (Deno.env.get("BUNNY_DB_URL") ?? "").trim().replace(/\/$/, "");
  u = u.replace(/^libsql:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BUNNY_TOKEN = Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "";

async function exec(sql: string, args: Array<string | number | null> = []): Promise<void> {
  const res = await fetch(`${bunnyHttpBase()}/v2/pipeline`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUNNY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: args.map((v) => ({
              type: v === null ? "null" : typeof v === "number" ? "integer" : "text",
              ...(v === null ? {} : { value: String(v) }),
            })),
          },
        },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`CRM database HTTP ${res.status}`);
  const data = await res.json() as { results?: Array<{ type?: string; error?: { message?: string } }> };
  const r = data.results?.[0];
  if (!r || r.type === "error" || r.error) throw new Error(r.error?.message ?? "CRM database error");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const provided = (req.headers.get("x-seed-secret") ?? "").trim();
  if (!provided || (await sha256Hex(provided)) !== SEED_SECRET_SHA256) {
    return json({ error: "forbidden" }, 403);
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({})) as { status?: string };
  const status = String(body.status ?? "").toLowerCase();
  if (!ALLOWED_STATUS.has(status)) {
    return json({ error: "status must be active or suspended" }, 400);
  }

  try {
    await exec(`UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      status,
      ALLOWED_CLIENT,
    ]);
    return json({ ok: true, client: ALLOWED_CLIENT, status });
  } catch (e) {
    console.error("sandbox status toggle failed:", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
