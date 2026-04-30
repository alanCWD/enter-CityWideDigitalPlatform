// Admin-only user management endpoints.
//
// Actions:
//   { action: "list" }                                      → list all users + roles
//   { action: "setRole", userId, role, enabled }            → grant/revoke a role
//   { action: "deleteUser", userId }                        → delete an auth user
//
// Authorization: caller must present a valid Bearer access token AND be an
// admin (verified via the `is_admin()` security-definer function on the DB).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing bearer token" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Verify caller identity using the user's own token
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
    const callerId = userData.user.id;

    // 2) Verify admin via security-definer RPC
    const { data: isAdmin, error: roleErr } = await userClient.rpc("is_admin");
    if (roleErr) return json({ error: roleErr.message }, 500);
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    // 3) Service-role client for privileged operations
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case "list": {
        const { data: usersList, error: e1 } = await admin.auth.admin.listUsers({ perPage: 200 });
        if (e1) return json({ error: e1.message }, 500);
        const { data: roles, error: e2 } = await admin
          .from("user_roles")
          .select("user_id,role");
        if (e2) return json({ error: e2.message }, 500);
        const rolesByUser: Record<string, string[]> = {};
        for (const r of roles ?? []) {
          (rolesByUser[r.user_id] ||= []).push(r.role as string);
        }
        const users = (usersList?.users ?? []).map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          roles: rolesByUser[u.id] ?? [],
        }));
        return json({ users });
      }

      case "setRole": {
        const { userId, role, enabled } = body;
        if (!userId || !role) return json({ error: "userId and role required" }, 400);
        if (!["admin", "agency", "client"].includes(role))
          return json({ error: "invalid role" }, 400);

        // Safety: don't let the last admin demote themselves
        if (role === "admin" && enabled === false && userId === callerId) {
          const { count } = await admin
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");
          if ((count ?? 0) <= 1) {
            return json({ error: "Cannot remove the last admin" }, 400);
          }
        }

        if (enabled) {
          const { error } = await admin
            .from("user_roles")
            .insert({ user_id: userId, role })
            .select()
            .maybeSingle();
          if (error && !error.message.includes("duplicate")) return json({ error: error.message }, 500);
        } else {
          const { error } = await admin
            .from("user_roles")
            .delete()
            .eq("user_id", userId)
            .eq("role", role);
          if (error) return json({ error: error.message }, 500);
        }
        return json({ success: true });
      }

      case "deleteUser": {
        const { userId } = body;
        if (!userId) return json({ error: "userId required" }, 400);
        if (userId === callerId) return json({ error: "Cannot delete yourself" }, 400);
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
