import { Link } from "react-router-dom";

const tiers = [
  {
    name: "Starter",
    planKey: "starter",
    price: "$197",
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
    planKey: "growth",
    price: "$397",
    period: "/mo",
    tagline: "Most popular — everything you need",
    featured: true,
    features: [
      "Everything in Starter",
      "Social Sync Pro (4 platforms)",
      "Listing Sync Pro (40+ directories)",
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
    features: [
      "Everything in Growth",
      "Review Engine",
      "Site Concierge credits (3/mo)",
      "Dedicated account manager",
      "White-label option available",
    ],
  },
];

export function CapsulePricing() {
  return (
    <section className="cap-section" aria-labelledby="capsule-pricing-title">
      <div className="cap-shell">
        <div className="grid gap-6 md:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)] md:gap-12">
          <p className="cap-kicker">06 / Plans</p>
          <div>
            <h2 id="capsule-pricing-title" className="cap-display text-[clamp(1.8rem,3.4vw,2.9rem)]">
              Transparent plans. No surprises.
            </h2>
            <p className="cap-lede mt-5 max-w-xl">
              Start with a 30-day free trial. Cancel anytime. No setup fees.
            </p>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex flex-col ${tier.featured ? "cap-column cap-column--featured" : "cap-column"}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`cap-kicker ${tier.featured ? "cap-kicker--bright" : ""}`}>
                      {tier.name}
                    </p>
                    {tier.featured && (
                      <span className="cap-mono text-[0.5rem] text-[var(--cap-accent)]">Most popular</span>
                    )}
                  </div>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-[2.6rem] font-light leading-none tracking-tight text-[var(--cap-ink)]">
                      {tier.price}
                    </span>
                    <span className="cap-mono text-[0.625rem] text-[var(--cap-ink-40)]">
                      {tier.period}
                    </span>
                  </div>
                  <p className="cap-mono mt-2 text-[0.5625rem] text-[var(--cap-ink-40)]">CAD · plus GST</p>
                  <p className="mt-3 text-sm font-light text-[var(--cap-ink-55)]">{tier.tagline}</p>

                  <ul className="mt-8 flex-1 space-y-3 border-t border-white/10 pt-6">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-3 text-[0.8125rem] font-light leading-relaxed text-[var(--cap-ink-72)]"
                      >
                        <span className="mt-[0.5rem] h-px w-3 shrink-0 bg-white/25" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={`/pricing?plan=${tier.planKey}#start-trial`}
                    className={`mt-8 ${tier.featured ? "cap-btn w-full" : "cap-btn-ghost w-full"}`}
                  >
                    Start free trial
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link to="/pricing" className="cap-link cap-mono text-[0.625rem]">
                See full feature comparison →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
