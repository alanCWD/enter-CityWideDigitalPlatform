import React, { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Minus, Check } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TrialIntake } from "@/components/marketing/TrialIntake";

const tiers = [
  {
    name: "Starter",
    planKey: "starter",
    price: "$197",
    period: "/mo",
    tagline: "Get found online — fast",
    featured: false,
    cta: "Start Free Trial",
    features: [
      "GMB-synced website",
      "Niche-specific template",
      "Auto-updating content",
      "Custom domain support",
      "Social Sync — GBP + 2 platforms",
      "Post scheduling",
      "Basic SEO",
      "Email support",
    ],
  },
  {
    name: "Growth",
    planKey: "growth",
    price: "$397",
    period: "/mo",
    tagline: "Everything you need to compete",
    featured: true,
    badge: "Most Popular",
    cta: "Start Free Trial",
    features: [
      "Everything in Starter",
      "Social Sync — GBP + 3 platforms",
      "40+ directory listings",
      "Monthly performance report",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    planKey: "pro",
    price: "$597",
    period: "/mo",
    tagline: "Maximum presence, zero effort",
    featured: false,
    cta: "Start Free Trial",
    features: [
      "Everything in Growth",
      "Social Sync — up to 10 platforms, choose from 15",
      "Review Engine",
      "AI chatbot intake",
      "3 Site Concierge credits/mo",
      "Dedicated account manager",
    ],
  },
];

type Feature = {
  category: string;
  items: {
    name: string;
    starter: boolean | string;
    growth: boolean | string;
    pro: boolean | string;
  }[];
};

const features: Feature[] = [
  {
    category: "Website Builder",
    items: [
      { name: "GMB-synced website", starter: true, growth: true, pro: true },
      { name: "Niche-specific template", starter: true, growth: true, pro: true },
      { name: "Auto-updating content", starter: true, growth: true, pro: true },
      { name: "Custom domain support", starter: true, growth: true, pro: true },
      { name: "SEO optimization", starter: "Advanced", growth: "Advanced", pro: "Advanced" },
    ],
  },
  {
    category: "Social Sync Pro",
    items: [
      { name: "Auto-publish to social", starter: true, growth: true, pro: true },
      { name: "Platforms supported", starter: "3 (GBP + 2)", growth: "4 (GBP + 3)", pro: "Up to 10" },
      { name: "Choose from 15 platforms", starter: false, growth: false, pro: true },
      { name: "Post scheduling", starter: true, growth: true, pro: true },
      { name: "Extra platforms", starter: false, growth: false, pro: "+ add-on" },
    ],
  },
  {
    category: "Listing Sync Pro",
    items: [
      { name: "Directory sync", starter: false, growth: true, pro: true },
      { name: "Directories covered", starter: false, growth: "40+", pro: "40+" },
      { name: "NAP monitoring", starter: false, growth: true, pro: true },
    ],
  },
  {
    category: "Review Engine",
    items: [
      { name: "Review request campaigns", starter: false, growth: false, pro: true },
      { name: "Video testimonial collection", starter: false, growth: false, pro: true },
      { name: "Auto-embed on website", starter: false, growth: false, pro: true },
    ],
  },
  {
    category: "Site Concierge",
    items: [
      { name: "Modification credits/mo", starter: false, growth: false, pro: "3 credits" },
      { name: "AI chatbot intake", starter: false, growth: false, pro: true },
    ],
  },
  {
    category: "Support",
    items: [
      { name: "Email support", starter: true, growth: true, pro: true },
      { name: "Priority support", starter: false, growth: true, pro: true },
      { name: "Dedicated account manager", starter: false, growth: false, pro: true },
      { name: "Monthly performance report", starter: false, growth: true, pro: true },
    ],
  },
];

const faqs = [
  {
    q: "Is there really no credit card required for the free trial?",
    a: "Correct. You start with your customer and billing details — no card. Your trial runs 30 days, then you pay the plan price plus GST, by credit card through Stripe or by Direct Deposit. Nothing is charged until your payment method is confirmed with our team.",
  },
  {
    q: "How long does setup take?",
    a: "Most businesses are live within 24–48 hours. We handle the technical setup, connect your GMB, and configure your niche template. You just approve the final design.",
  },
  {
    q: "What happens if I cancel?",
    a: "You can cancel anytime from your dashboard, no questions asked. Your website will remain live for the remainder of your billing period. We don't believe in lock-ins.",
  },
  {
    q: "Can I change plans later?",
    a: "Absolutely. Upgrade or downgrade at any time. Plan changes take effect on your next billing cycle.",
  },
  {
    q: "Do I need to already have a Google Business Profile?",
    a: "You need a verified GMB to use most features. We can walk you through creating and verifying one during onboarding — it usually takes 3–5 days for Google to verify.",
  },
  {
    q: "What industries are supported?",
    a: "We have niche templates for Restaurants, Contractors, Retail, Healthcare, Salons & Spas, Auto Services, and more. New templates are added regularly. Contact us if you don't see your industry.",
  },
  {
    q: "What listings are covered in Listing Sync Pro?",
    a: "Our listing sync integrates with the leading directory data providers to ensure maximum coverage. We support 40+ directories including Yelp, Apple Maps, Bing Places, Foursquare, and more.",
  },
  {
    q: "Can I white-label CityWide Digital for my own agency?",
    a: "Yes! White-label and reseller programs are available on the Pro plan. Contact our partner team to learn more about agency pricing and commission structures.",
  },
];

const addons = [
  { name: "Extra Social Connections", price: "$5 / connection", desc: "Add extra social platform connections beyond your plan's included count. Choose from any of the 15 supported platforms." },
  { name: "Site Concierge Credits", price: "$15 / credit", desc: "Request any website change on demand. Standard requests completed in 3 business days." },
  { name: "Extra Directories Pack", price: "$29 / mo", desc: "Expand your listing coverage to niche-specific and regional directories beyond the standard 40+." },
  { name: "White-Label Licence", price: "Contact us", desc: "Resell CityWide Digital under your own brand. Includes sub-account management and commission program." },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-white/20" strokeWidth={1.5} />;
  if (value === true) return <Check className="mx-auto h-4 w-4 text-[var(--gp-blue)]" strokeWidth={2} />;
  return <span className="gp-mono text-[10px] text-[var(--gp-ice)]">{value}</span>;
}

export default function Pricing() {
  const [params] = useSearchParams();
  const location = useLocation();
  const requestedPlan = params.get("plan");
  const [plan, setPlan] = useState<string>(
    tiers.some((t) => t.planKey === requestedPlan) ? (requestedPlan as string) : tiers[0].planKey,
  );

  useEffect(() => {
    if (location.hash !== "#start-trial") return;
    const timer = window.setTimeout(() => {
      document.getElementById("start-trial")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.key]);

  const startTrial = (planKey: string) => {
    setPlan(planKey);
    document.getElementById("start-trial")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Layout variant="glass">
      <GlassHero
        kicker="03 / Pricing"
        scene
        title="Transparent plans. No surprises."
        lede="Start with a 30-day free trial. Cancel anytime. No setup fees."
      >
        <span className="gp-chip gp-chip--accent">30-day free trial</span>
        <span className="gp-chip">No credit card</span>
        <span className="gp-chip">CAD pricing · plus GST</span>
      </GlassHero>

      {/* Tier cards */}
      <section className="gp-section">
        <div className="gp-shell">
          <div className="grid items-start gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex h-full flex-col p-8 ${
                  tier.featured ? "gp-panel gp-panel--feature" : "gp-panel gp-panel--hover"
                }`}
              >
                {tier.featured && tier.badge && (
                  <span className="gp-chip gp-chip--accent absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0a1220]/90">
                    {tier.badge}
                  </span>
                )}

                <p className="gp-kicker">{tier.name}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="gp-display text-[2.6rem]">{tier.price}</span>
                  <span className="text-sm font-light text-[var(--gp-ink-55)]">{tier.period}</span>
                </div>
                <p className="gp-kicker mt-2">CAD · plus GST</p>
                <p className="gp-body mt-4 text-sm">{tier.tagline}</p>

                <div className="my-6 gp-hairline" />

                <ul className="flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gp-blue)]" strokeWidth={2} />
                      <span className="text-[13.5px] font-light leading-relaxed text-[var(--gp-ink-72)]">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => startTrial(tier.planKey)}
                  className={`mt-7 w-full ${tier.featured ? "gp-btn" : "gp-btn-ghost"}`}
                >
                  {tier.cta}
                </button>
                <p className="gp-kicker mt-4 text-center">30-day free trial · No card</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <TrialIntake plans={tiers} plan={plan} onPlanChange={setPlan} />

      {/* Comparison */}
      <section className="gp-section">
        <div className="gp-shell">
          <div className="mb-10 max-w-2xl">
            <p className="gp-kicker">04 / Compare</p>
            <h2 className="gp-display mt-4 text-[clamp(1.7rem,3.4vw,2.6rem)]">Everything, side by side</h2>
          </div>

          <div className="gp-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="gp-table">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="w-1/2">Feature</th>
                    {tiers.map((tier) => (
                      <th key={tier.name} className={`text-center ${tier.featured ? "text-[var(--gp-ice)]" : ""}`}>
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((category) => (
                    <React.Fragment key={category.category}>
                      <tr className="gp-table__group">
                        <td colSpan={4}>{category.category}</td>
                      </tr>
                      {category.items.map((item) => (
                        <tr key={item.name}>
                          <td>{item.name}</td>
                          <td className="text-center"><FeatureValue value={item.starter} /></td>
                          <td className="text-center bg-white/[0.02]"><FeatureValue value={item.growth} /></td>
                          <td className="text-center"><FeatureValue value={item.pro} /></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="gp-section">
        <div className="gp-shell">
          <div className="mb-10 max-w-2xl">
            <p className="gp-kicker">05 / Extras</p>
            <h2 className="gp-display mt-4 text-[clamp(1.7rem,3.4vw,2.6rem)]">Add-ons</h2>
            <p className="gp-lede mt-4 text-sm">Optional extras available on any plan.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {addons.map((addon) => (
              <div key={addon.name} className="gp-panel gp-panel--soft gp-panel--hover p-6">
                <p className="gp-kicker">{addon.price}</p>
                <h3 className="mt-3 text-base font-normal text-[var(--gp-ink)]">{addon.name}</h3>
                <p className="gp-body mt-2 text-[13px]">{addon.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="gp-section">
        <div className="gp-shell">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="gp-kicker">06 / FAQ</p>
              <h2 className="gp-display mt-4 text-[clamp(1.7rem,3.4vw,2.4rem)]">Frequently asked questions</h2>
              <p className="gp-lede mt-4 text-sm">Everything you need to know before getting started.</p>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="gp-panel gp-panel--soft border-b-0 px-6"
                >
                  <AccordionTrigger className="gp-accordion-trigger py-5 text-left text-sm font-normal text-[var(--gp-ink)] hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="gp-body pb-5 text-[13.5px]">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <GlassCTA />
    </Layout>
  );
}
