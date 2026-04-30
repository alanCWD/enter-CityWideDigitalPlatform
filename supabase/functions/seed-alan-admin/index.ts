// One-off bootstrap: ensures alan@citywidedigital.ca exists with the given
// password and has the `admin` role. Idempotent — safe to call repeatedly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const email = "alan@citywidedigital.ca";
  const password = "87654321";

  let userId: string | null = null;

  // Look for an existing user (paginate just in case)
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    // Reset password and ensure email confirmed
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) {
      return new Response(JSON.stringify({ error: `update failed: ${updErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return new Response(
        JSON.stringify({ error: `create failed: ${createErr?.message ?? "unknown"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    userId = created.user.id;
  }

  // Grant admin role (idempotent via unique constraint)
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });
  if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
    return new Response(JSON.stringify({ error: `role grant failed: ${roleErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      userId,
      email,
      message: "User ensured + admin role granted",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
