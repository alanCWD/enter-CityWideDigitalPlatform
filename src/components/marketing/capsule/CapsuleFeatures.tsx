const capabilities = [
  {
    title: "Auto-updating websites",
    description:
      "Your website syncs with Google Business Profile — menu, hours, posts and products update automatically.",
  },
  {
    title: "One-click social sync",
    description:
      "Post once on Google. It instantly publishes to the social profiles where your customers are.",
  },
  {
    title: "Listing accuracy",
    description:
      "Your name, address and phone number are corrected and kept consistent across all major directories.",
  },
  {
    title: "Review engine",
    description:
      "Solicit testimonials via SMS or email. Approved reviews auto-embed on your testimonials page.",
  },
  {
    title: "Niche-specific templates",
    description:
      "Restaurant, contractor, retail and more — each template shows only what your customers need.",
  },
  {
    title: "White-glove support",
    description:
      "Dedicated onboarding, monthly check-ins and a real human to call when you need help.",
  },
];

export function CapsuleFeatures() {
  return (
    <section className="cap-section" aria-labelledby="capsule-features-title">
      <div className="cap-shell">
        <div className="grid gap-6 md:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)] md:gap-12">
          <p className="cap-kicker">04 / Everything included</p>
          <div>
            <h2 id="capsule-features-title" className="cap-display text-[clamp(1.8rem,3.4vw,2.9rem)]">
              One platform. Every channel that matters.
            </h2>
            <p className="cap-lede mt-5 max-w-xl">
              Stop juggling separate tools. CityWide Digital runs your entire online presence from a
              single dashboard — on your behalf.
            </p>

            <div className="mt-12 grid gap-x-12 gap-y-0 md:grid-cols-2">
              {capabilities.map((item, index) => (
                <article key={item.title} className="cap-row group">
                  <span className="cap-index pt-1">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-base font-normal tracking-tight text-[var(--cap-ink)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm font-light leading-relaxed text-[var(--cap-ink-55)]">
                      {item.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
