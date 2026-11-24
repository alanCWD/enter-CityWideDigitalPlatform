// Social Studio access management (CED side).
//
// Actions:
//   { action: "list" }                                  → workspaces + their tokens
//   { action: "createToken", workspace_id, label }      → issue a token (plaintext once)
//   { action: "revokeToken", id }                       → revoke a token
//
// Authorization: a valid Bearer access token for a CED super admin or admin.
// The plaintext token is returned exactly once and stored only as a SHA-256
// hash; it is never logged and never shown again.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uuid(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

const ALLOWED_ROLES = new Set(["super_admin", "admin"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Only POST is supported" }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Missing bearer token" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: roles, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (roleErr) return json({ error: roleErr.message }, 500);
    if (!(roles ?? []).some((r) => ALLOWED_ROLES.has(String(r.role)))) {
      return json({ error: "Forbidden: super-admin only" }, 403);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "list") {
      const [workspacesRes, tokensRes] = await Promise.all([
        admin
          .from("workspace_entitlement_workspaces")
          .select("workspace_id, crm_client_id, agency_id, timezone, gst_rate, updated_at")
          .order("workspace_id", { ascending: true }),
        admin
          .from("workspace_api_tokens")
          .select("id, workspace_id, label, token_prefix, created_at, last_used_at, revoked_at")
          .order("created_at", { ascending: false }),
      ]);
      if (workspacesRes.error) return json({ error: workspacesRes.error.message }, 500);
      if (tokensRes.error) return json({ error: tokensRes.error.message }, 500);
      return json({ workspaces: workspacesRes.data ?? [], tokens: tokensRes.data ?? [] });
    }

    if (action === "createToken") {
      const workspaceId = String(body.workspace_id ?? "").trim();
      const label = String(body.label ?? "").trim().slice(0, 80) || "Untitled token";
      if (!workspaceId) return json({ error: "workspace_id is required" }, 400);

      const { data: workspace, error: wsErr } = await admin
        .from("workspace_entitlement_workspaces")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (wsErr) return json({ error: wsErr.message }, 500);
      if (!workspace) return json({ error: "Unknown workspace" }, 404);

      const secret = `cwd_ent_${uuid()}${uuid().slice(0, 16)}`;
      const id = `wtk_${uuid().slice(0, 12)}`;
      const { error: insErr } = await admin.from("workspace_api_tokens").insert({
        id,
        workspace_id: workspaceId,
        label,
        token_prefix: secret.slice(0, 12),
        token_hash: await sha256Hex(secret),
        scope: "entitlements:read",
      });
      if (insErr) return json({ error: insErr.message }, 500);

      // Returned once; only the hash is stored.
      return json({ id, token: secret, label, workspace_id: workspaceId });
    }

    if (action === "revokeToken") {
      const id = String(body.id ?? "").trim();
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await admin
        .from("workspace_api_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .is("revoked_at", null);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("studio-access-admin error:", (e as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});
