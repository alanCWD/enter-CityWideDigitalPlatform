import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Records a click on a review-request email's button and returns where to send
// the customer. Called by the app's /r redirect page (which attaches the anon key
// as Authorization — the gateway rejects header-less requests from email clients,
// so the link must go through the SPA). The random click_token is the capability:
// only a request that knows a real token (i.e. someone with the actual email) can
// record a click.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let token: string;
  let platform: string;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    token = String(body.token ?? "").trim();
    platform = String(body.platform ?? "google").trim();
  } catch {
    return json({ error: "invalid request" }, 400);
  }
  if (!token) return json({ error: "missing token" }, 400);

  const { data: row, error } = await supabase
    .from("review_requests")
    .select("id, crm_client_id, review_link")
    .eq("click_token", token)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!row) return json({ ok: false, url: null });

  // Record the first click only (preserve earliest timestamp + platform).
  await supabase
    .from("review_requests")
    .update({ clicked_at: new Date().toISOString(), clicked_platform: platform })
    .eq("id", row.id)
    .is("clicked_at", null);

  // Resolve the redirect URL from the connection's enabled review platforms.
  let url: string | null = null;
  const { data: conn } = await supabase
    .from("quickbooks_connections")
    .select("review_platforms, review_link")
    .eq("crm_client_id", row.crm_client_id)
    .maybeSingle();

  if (conn) {
    const raw = conn.review_platforms as Array<{ platform?: string; url?: string; enabled?: boolean }> | null;
    if (Array.isArray(raw)) {
      const found = raw.find((p) => p.platform === platform && p.enabled && p.url && String(p.url).trim());
      if (found) url = String(found.url).trim();
    }
    if (!url && platform === "google") url = conn.review_link || null;
  }

  return json({ ok: true, url });
});
