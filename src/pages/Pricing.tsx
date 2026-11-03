import React, { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle, Minus, Check } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CTABanner from "@/components/marketing/CTABanner";
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
      "Social Sync — GBP + 1 platform (choose from 15)",
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
      "Social Sync — GBP + 3 platforms (4 total)",
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
      "Social Sync — GBP + 4+ platforms (extras charged)",
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
      { name: "SEO optimization", starter: "Basic", growth: "Advanced", pro: "Full" },
    ],
  },
  {
    category: "Social Sync Pro",
    items: [
      { name: "Auto-publish to social", starter: true, growth: true, pro: true },
      { name: "Platforms supported", starter: "2 (GBP + 1)", growth: "4 (GBP + 3)", pro: "Up to 15" },
      { name: "Choose from 15 platforms", starter: true, growth: true, pro: true },
      { name: "Post scheduling", starter: false, growth: true, pro: true },
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
    a: "Correct. You start with your customer and billing details — no card. Your trial runs 30 days, then you pay by credit card through Stripe or by Direct Deposit. Nothing is charged until your payment method is confirmed with our team.",
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

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === false) return <Minus className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  if (value === true) return <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />;
  return <span className="text-xs font-semibold text-primary">{value}</span>;
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
    <Layout>
      {/* Hero — extends behind the fixed navbar like the home hero */}
      <section className="bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_100%)] -mt-[88px] pt-[128px] pb-20 md:pt-[152px] md:pb-28">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Simple Pricing</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#EEF1FA] mb-5 leading-tight">
            Transparent plans. No surprises.
          </h1>
          <p className="text-lg text-[rgba(238,241,250,0.7)] max-w-xl mx-auto">
            Start with a 30-day free trial. Cancel anytime. No setup fees.
          </p>
        </div>
      </section>

      {/* Tier Cards */}
      <section className="py-16 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={
                  tier.featured
                    ? "relative rounded-2xl p-8 bg-[#1B2A4A] border-2 border-primary shadow-[0_8px_40px_rgba(0,120,215,0.25)]"
                    : "relative rounded-2xl p-8 bg-card border border-border card-shadow"
                }
              >
                {tier.featured && tier.badge && (
                  <Badge variant="featured" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
                    {tier.badge}
                  </Badge>
                )}
                <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${tier.featured ? "text-primary" : "text-muted-foreground"}`}>
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-extrabold ${tier.featured ? "text-[#EEF1FA]" : "text-foreground"}`}>{tier.price}</span>
                  <span className={`text-sm ${tier.featured ? "text-[rgba(238,241,250,0.6)]" : "text-muted-foreground"}`}>{tier.period}</span>
                </div>
                <p className={`text-sm mb-5 ${tier.featured ? "text-[rgba(238,241,250,0.7)]" : "text-muted-foreground"}`}>{tier.tagline}</p>

                {/* Feature list */}
                <ul className="space-y-2 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${tier.featured ? "text-primary" : "text-emerald-500"}`} />
                      <span className={`text-sm ${tier.featured ? "text-[rgba(238,241,250,0.8)]" : "text-foreground/80"}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={tier.featured ? "on-dark" : "outline"}
                  className="w-full"
                  onClick={() => startTrial(tier.planKey)}
                >
                  {tier.cta}
                </Button>
                <p className={`text-center text-xs mt-3 ${tier.featured ? "text-[rgba(238,241,250,0.4)]" : "text-muted-foreground/60"}`}>
                  30-day free trial · No credit card required
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Trial intake */}
      <TrialIntake plans={tiers} plan={plan} onPlanChange={setPlan} />

      {/* Feature Comparison Table */}
      <section className="pb-20 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0A1120]">
                  <th className="text-left p-5 text-[rgba(238,241,250,0.6)] font-medium w-1/2">Feature</th>
                  {tiers.map((tier) => (
                    <th key={tier.name} className={`text-center p-5 font-bold ${tier.featured ? "text-primary" : "text-[#EEF1FA]"}`}>
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-muted/50">
                      <td colSpan={4} className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary">
                        {category.category}
                      </td>
                    </tr>
                    {category.items.map((item) => (
                      <tr key={item.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="p-4 pl-5 text-foreground">{item.name}</td>
                        <td className="p-4 text-center"><FeatureValue value={item.starter} /></td>
                        <td className="p-4 text-center bg-accent/20"><FeatureValue value={item.growth} /></td>
                        <td className="p-4 text-center"><FeatureValue value={item.pro} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 section-alt">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Add-ons</h2>
          <p className="text-muted-foreground mb-8">Optional extras available on any plan.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: "Extra Social Connections", price: "$5 / connection", desc: "Add extra social platform connections beyond your plan's included count. Choose from any of the 15 supported platforms." },
              { name: "Site Concierge Credits", price: "$15 / credit", desc: "Request any website change on demand. Standard requests completed in 3 business days." },
              { name: "Extra Directories Pack", price: "$29 / mo", desc: "Expand your listing coverage to niche-specific and regional directories beyond the standard 40+." },
              { name: "White-Label License", price: "Contact us", desc: "Resell CityWide Digital under your own brand. Includes sub-account management and commission program." },
            ].map((addon) => (
              <div key={addon.name} className="bg-card rounded-2xl p-6 border border-border card-shadow">
                <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">{addon.price}</div>
                <h3 className="text-lg font-bold text-foreground mb-2">{addon.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{addon.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-background">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know before getting started.</p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-6">
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <CTABanner />
    </Layout>
  );
}
