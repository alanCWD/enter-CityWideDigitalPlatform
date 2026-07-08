const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const ids = [
  "in_1Tr2s6DaF43h2QwM4HvLiK5l",
  "in_1Tr2jWDaF43h2QwM0OGCfHYc",
  "in_1Tr2fqDaF43h2QwMf0DchUmH",
  "in_1Tr2eBDaF43h2QwMrSvyibHj",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const results = [];
    for (const id of ids) {
      const res = await fetch(`https://api.stripe.com/v1/invoices/${id}`, { headers: { "Authorization": `Bearer ${STRIPE_KEY}` } });
      const data = await res.json();
      const entry: Record<string, unknown> = {
        id,
        status: data.status,
        billing_reason: data.billing_reason,
        subscription: data.subscription,
        subtotal: data.subtotal,
        total: data.total,
        amount_paid: data.amount_paid,
        amount_due: data.amount_due,
        amount_remaining: data.amount_remaining,
        total_discount_amounts: data.total_discount_amounts,
        discount: data.discount,
        lines_data: data.lines?.data,
        status_transitions: data.status_transitions,
        created: data.created,
        auto_advance: data.auto_advance,
        collection_method: data.collection_method,
        customer: data.customer,
      };
      if (data.subscription) {
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${data.subscription}`, { headers: { "Authorization": `Bearer ${STRIPE_KEY}` } });
        const subData = await subRes.json();
        entry.subscription_detail = {
          status: subData.status,
          items: subData.items?.data?.map((i: any) => ({ price: i.price?.id, unit_amount: i.price?.unit_amount, quantity: i.quantity })),
          discount: subData.discount,
          trial_start: subData.trial_start,
          trial_end: subData.trial_end,
          latest_invoice: subData.latest_invoice,
        };
        if (subData.discount) {
          const promoId = subData.discount.promotion_code;
          const couponId = subData.discount.coupon?.id;
          entry.coupon_raw = subData.discount.coupon;
        }
      }
      results.push(entry);
    }
    return new Response(JSON.stringify({ results }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
