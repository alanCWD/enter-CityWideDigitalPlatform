// Creates a Stripe Checkout session for a CityWide Digital pricing plan.
// Public endpoint — no JWT required.
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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

const PLANS = {
  starter: { name: "CityWide Digital — Starter", amount: 9700, description: "Get found online — fast" },
  growth:  { name: "CityWide Digital — Growth",  amount: 19700, description: "Everything you need to compete" },
  pro:     { name: "CityWide Digital — Pro",     amount: 29700, description: "Maximum presence, zero effort" },
} as const;

type PlanKey = keyof typeof PLANS;

async function getOrCreatePriceId(stripe: Stripe, planKey: PlanKey): Promise<string> {
  const plan = PLANS[planKey];

  // Look up existing product by metadata tag
  const existing = await stripe.products.search({
    query: `metadata['citywide_plan']:'${planKey}' AND active:'true'`,
    limit: 1,
  });

  let productId: string;

  if (existing.data.length > 0) {
    productId = existing.data[0].id;
    // Find active monthly recurring price
    const prices = await stripe.prices.list({ product: productId, active: true, limit: 20 });
    const monthly = prices.data.find((p) => p.recurring?.interval === "month");
    if (monthly) return monthly.id;
  } else {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { citywide_plan: planKey },
    });
    productId = product.id;
  }

  // Create a new monthly price
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.amount,
    currency: "cad",
    recurring: { interval: "month" },
    metadata: { citywide_plan: planKey },
  });
  return price.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe not configured" }, 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });

    const body = await req.json().catch(() => ({}));
    const { plan, success_url, cancel_url, email } = body as {
      plan?: string;
      success_url?: string;
      cancel_url?: string;
      email?: string;
    };

    if (!plan || !(plan in PLANS)) {
      return json({ error: "Invalid plan. Must be: starter, growth, or pro" }, 400);
    }
    if (!success_url || !cancel_url) {
      return json({ error: "success_url and cancel_url are required" }, 400);
    }

    const priceId = await getOrCreatePriceId(stripe, plan as PlanKey);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "if_required",
      subscription_data: {
        trial_period_days: 30,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: { citywide_plan: plan },
      },
      success_url,
      cancel_url,
      allow_promotion_codes: true,
    };

    if (email) sessionParams.customer_email = email;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return json({ url: session.url });
  } catch (err) {
    console.error("pricing-checkout error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
