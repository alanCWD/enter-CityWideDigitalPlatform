import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const email = "alan@citywidedigital.ca";
    const password = "admin123!!!";
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const user = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) throw new Error("user not found");
    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (updErr) throw updErr;
    // Ensure admin role
    await admin.from("user_roles").upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    return new Response(JSON.stringify({ ok: true, id: user.id, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
