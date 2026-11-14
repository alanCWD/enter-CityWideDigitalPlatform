const steps = [
  {
    title: "Connect your Google Business Profile",
    description:
      "We securely link your GMB account. All your business info, posts, menus and products flow into your CityWide Digital website automatically.",
  },
  {
    title: "Choose a template or a copy of your present site",
    description:
      "Pick from restaurant, contractor, retail or other industry templates. Each is pre-configured with the exact GMB fields your customers care about.",
  },
  {
    title: "We launch and let it run",
    description:
      "Your website goes live, your social channels stay active with your posts and updates, and your directory listings stay accurate — all without touching a single thing.",
  },
];

export function CapsuleSteps() {
  return (
    <section className="cap-section" aria-labelledby="capsule-steps-title">
      <div className="cap-shell">
        <div className="grid gap-6 md:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)] md:gap-12">
          <p className="cap-kicker">05 / Simple setup</p>
          <div>
            <h2 id="capsule-steps-title" className="cap-display text-[clamp(1.8rem,3.4vw,2.9rem)]">
              Live in three steps.
            </h2>
            <p className="cap-lede mt-5 max-w-xl">
              No designers. Just your Google account and a few minutes each day.
            </p>

            <ol className="mt-12 grid border-t border-white/10 md:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="border-b border-white/10 py-8 md:border-b-0 md:border-r md:pr-8 md:last:border-r-0 md:last:pr-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="cap-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-base font-normal tracking-tight text-[var(--cap-ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm font-light leading-relaxed text-[var(--cap-ink-55)]">
                    {step.description}
                  </p>
                  {index < steps.length - 1 && (
                    <span className="mt-6 hidden h-px w-6 bg-[var(--cap-accent-dim)] md:block" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
