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
  starter: { name: "CityWide Digital — Starter", amount: 19700, description: "Get found online — fast" },
  growth:  { name: "CityWide Digital — Growth",  amount: 39700, description: "Everything you need to compete" },
  pro:     { name: "CityWide Digital — Pro",     amount: 59700, description: "Maximum presence, zero effort" },
} as const;

type PlanKey = keyof typeof PLANS;

// GST (5%, exclusive) is applied to every plan subscription, matching the
// tax rate used for CRM subscriptions and invoices.
const GST_PERCENT = 5;

let cachedGstTaxRateId: string | null = null;
async function ensureGstTaxRate(stripe: Stripe): Promise<string> {
  if (cachedGstTaxRateId) return cachedGstTaxRateId;
  const rates = await stripe.taxRates.list({ active: true, limit: 100 });
  const existing = rates.data.find(
    (r) => Math.abs(r.percentage - GST_PERCENT) < 0.01 && !r.inclusive &&
      (r.country === "CA" || (r.display_name ?? "").toUpperCase().includes("GST")),
  );
  if (existing) {
    cachedGstTaxRateId = existing.id;
    return existing.id;
  }
  const created = await stripe.taxRates.create({
    display_name: "GST",
    description: "Canadian Goods and Services Tax",
    jurisdiction: "CA",
    percentage: GST_PERCENT,
    inclusive: false,
    country: "CA",
    tax_type: "gst",
  });
  cachedGstTaxRateId = created.id;
  return created.id;
}

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
    // Reuse only a monthly price that matches the current plan amount.
    const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
    const monthly = prices.data.find(
      (p) => p.recurring?.interval === "month" && p.unit_amount === plan.amount && p.currency === "cad",
    );
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

    // Fail closed: a checkout that silently drops GST would under-bill.
    const gstTaxRateId = await ensureGstTaxRate(stripe).catch((e) => {
      console.error("pricing-checkout GST rate error:", e);
      return null;
    });
    if (!gstTaxRateId) {
      return json({ error: "GST could not be applied to this checkout. Please try again." }, 500);
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1, tax_rates: [gstTaxRateId] }],
      payment_method_collection: "if_required",
      subscription_data: {
        trial_period_days: 30,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        default_tax_rates: [gstTaxRateId],
        metadata: { citywide_plan: plan },
      },
      success_url,
      cancel_url,
      allow_promotion_codes: true,
      locale: "en",
    };

    if (email) sessionParams.customer_email = email;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return json({ url: session.url });
  } catch (err) {
    console.error("pricing-checkout error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
