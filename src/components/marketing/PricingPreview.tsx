import { Link } from "react-router-dom";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const tiers = [
  {
    name: "Starter",
    price: "$97",
    period: "/mo",
    tagline: "Perfect for getting found online",
    featured: false,
    features: [
      "GMB-integrated website",
      "Niche-specific template",
      "Auto-updating content",
      "SEO optimization",
      "Basic analytics",
    ],
  },
  {
    name: "Growth",
    price: "$197",
    period: "/mo",
    tagline: "Most popular — everything you need",
    featured: true,
    badge: "Most Popular",
    features: [
      "Everything in Starter",
      "Social Sync Pro (4 platforms)",
      "Listing Manager (40+ directories)",
      "Monthly performance report",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    price: "$297",
    period: "/mo",
    tagline: "Maximum presence, zero effort",
    featured: false,
    features: [
      "Everything in Growth",
      "Video Review Engine",
      "Site Concierge credits (3/mo)",
      "Dedicated account manager",
      "White-label option available",
    ],
  },
];

export default function PricingPreview() {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Simple Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
            Transparent plans. No surprises.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start with a 30-day free trial. Cancel anytime. No setup fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={
                tier.featured
                  ? "relative rounded-2xl p-8 bg-[#1B2A4A] border-2 border-primary shadow-[0_8px_40px_rgba(0,120,215,0.25)] flex flex-col"
                  : "relative rounded-2xl p-8 bg-card border border-border card-shadow flex flex-col"
              }
            >
              {tier.featured && tier.badge && (
                <Badge variant="featured" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
                  {tier.badge}
                </Badge>
              )}

              <div className="mb-6">
                <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${tier.featured ? "text-primary" : "text-muted-foreground"}`}>
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-extrabold ${tier.featured ? "text-[#EEF1FA]" : "text-foreground"}`}>
                    {tier.price}
                  </span>
                  <span className={`text-sm ${tier.featured ? "text-[rgba(238,241,250,0.6)]" : "text-muted-foreground"}`}>
                    {tier.period}
                  </span>
                </div>
                <p className={`text-sm mt-2 ${tier.featured ? "text-[rgba(238,241,250,0.7)]" : "text-muted-foreground"}`}>
                  {tier.tagline}
                </p>
              </div>

              <ul className="space-y-3 flex-1 mb-7">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tier.featured ? "text-[#22C55E]" : "text-primary"}`} />
                    <span className={`text-sm ${tier.featured ? "text-[rgba(238,241,250,0.8)]" : "text-foreground"}`}>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.featured ? "on-dark" : "outline"}
                size="default"
                className="w-full"
                asChild
              >
                <Link to="/pricing">
                  Start Free Trial
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-[#00447A] transition-colors"
          >
            See full feature comparison <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
