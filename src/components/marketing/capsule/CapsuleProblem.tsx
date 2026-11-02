const problems = [
  "Your website hasn't been updated in months",
  "Posting to social media takes hours every week",
  "Your business info is wrong on half the directories",
  "You have no time to respond to or collect reviews",
  "Customers can't find you online or find outdated info",
];

const solutions = [
  "Your website auto-updates from your Google Business Profile",
  "One GMB post instantly publishes to all social platforms",
  "All 40+ directories stay accurate and synced automatically",
  "Reviews are collected and displayed on your site",
  "Customers always find fresh, accurate information",
];

export function CapsuleProblem() {
  return (
    <section className="cap-section" aria-labelledby="capsule-problem-title">
      <div className="cap-shell">
        <div className="grid gap-6 md:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)] md:gap-12">
          <p className="cap-kicker">03 / The problem</p>
          <div>
            <h2 id="capsule-problem-title" className="cap-display text-[clamp(1.8rem,3.4vw,2.9rem)]">
              Most small businesses are invisible online — and don't even know it.
            </h2>

            <div className="mt-12 grid gap-0 border-t border-white/10 md:grid-cols-2">
              {/* The old way */}
              <div className="border-b border-white/10 py-8 md:border-b-0 md:border-r md:pr-12">
                <p className="cap-kicker mb-6 flex items-center gap-2">
                  <span className="inline-block h-px w-6 bg-white/20" aria-hidden="true" />
                  The old way
                </p>
                <ul className="space-y-4">
                  {problems.map((problem) => (
                    <li key={problem} className="flex gap-3 text-sm font-light leading-relaxed text-[var(--cap-ink-55)]">
                      <span className="mt-[0.45rem] h-px w-3 shrink-0 bg-[#f08a8a]/70" aria-hidden="true" />
                      {problem}
                    </li>
                  ))}
                </ul>
              </div>

              {/* The CityWide way */}
              <div className="py-8 md:pl-12">
                <p className="cap-kicker cap-kicker--bright mb-6 flex items-center gap-2">
                  <span className="inline-block h-px w-6 bg-[var(--cap-accent)]" aria-hidden="true" />
                  The CityWide way
                </p>
                <ul className="space-y-4">
                  {solutions.map((solution) => (
                    <li key={solution} className="flex gap-3 text-sm leading-relaxed text-[var(--cap-ink)]">
                      <span className="mt-[0.45rem] h-px w-3 shrink-0 bg-[var(--cap-accent)]" aria-hidden="true" />
                      {solution}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
