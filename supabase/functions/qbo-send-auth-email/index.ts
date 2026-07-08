import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { recipientEmail, authUrl, clientName } = await req.json() as {
      recipientEmail: string;
      authUrl: string;
      clientName?: string;
    };

    if (!recipientEmail || !authUrl) {
      return new Response(JSON.stringify({ error: "recipientEmail and authUrl are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const greeting = clientName ? `Hi ${clientName},` : "Hi,";

    const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #111827; font-size: 20px; margin: 0 0 16px;">Connect your QuickBooks account</h2>
    <p style="color: #4B5563; line-height: 1.7; margin: 0 0 12px;">${greeting}</p>
    <p style="color: #4B5563; line-height: 1.7; margin: 0 0 24px;">
      Please click the button below to securely connect your QuickBooks Online account. This allows us to automatically send review requests to your customers when an invoice is marked as paid.
    </p>
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${authUrl}" style="display: inline-block; background: #2CA01C; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
        Connect QuickBooks
      </a>
    </div>
    <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0;">
      This link is unique to your account. If you did not expect this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CityWide Reviews <reviews@citywidedigital.ca>",
        to: [recipientEmail],
        subject: "Action required: Connect your QuickBooks account",
        html,
      }),
    });

    const result = await emailRes.json() as { id?: string; name?: string; message?: string };
    if (!emailRes.ok) {
      throw new Error(result.message || result.name || `Resend HTTP ${emailRes.status}`);
    }

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
