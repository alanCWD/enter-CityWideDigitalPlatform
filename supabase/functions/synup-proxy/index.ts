/**
 * synup-proxy — secure server-side proxy for the Synup Local SEO Agency API.
 * Base URL:  https://api.synup.com
 * Auth:      Authorization: Token {SYNUP_API_KEY}
 *
 * Request body: { path: string, params?: Record<string, string> }
 * Examples:
 *   { path: "/v2/locations/{id}/listings" }
 *   { path: "/v2/interactions", params: { location_id: "123", limit: "20" } }
 *   { path: "/v2/keywords/performance", params: { location_id: "123" } }
 *   { path: "/v2/interaction_analytics", params: { location_id: "123" } }
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYNUP_BASE = "https://api.synup.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const apiKey = Deno.env.get("SYNUP_API_KEY");
  if (!apiKey) {
    console.error("synup-proxy: SYNUP_API_KEY secret not set");
    return new Response(JSON.stringify({ error: "SYNUP_API_KEY not configured" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let path: string;
  let params: Record<string, string> = {};

  try {
    const body = await req.json();
    path = body.path;
    params = body.params ?? {};
    if (!path || typeof path !== "string") throw new Error("missing path");
  } catch (e) {
    return new Response(JSON.stringify({ error: `bad request: ${(e as Error).message}` }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Build upstream URL
  const url = new URL(`${SYNUP_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  console.log(`synup-proxy → ${req.method} ${url.toString()}`);

  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log(`synup-proxy ← ${upstream.status}`);
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("synup-proxy fetch error:", e);
    return new Response(JSON.stringify({ error: `upstream error: ${(e as Error).message}` }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
