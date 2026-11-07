import { Link } from "react-router-dom";

interface GlassCTAProps {
  kicker?: string;
  title?: string;
  lede?: string;
  note?: string;
}

export function GlassCTA({
  kicker = "Next",
  title = "Ready to run your business online — on autopilot?",
  lede = "Start your free 30-day trial today. No credit card required.",
  note = "30-day free trial · No credit card · Cancel anytime",
}: GlassCTAProps) {
  return (
    <section className="gp-section">
      <div className="gp-shell">
        <div className="gp-panel overflow-hidden px-6 py-12 md:px-12 md:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full border border-white/10"
          />

          <div className="relative max-w-2xl">
            <p className="gp-kicker">{kicker}</p>
            <h2 className="gp-display mt-5 text-[clamp(1.9rem,4.4vw,3.4rem)]">{title}</h2>
            <p className="gp-lede mt-5 max-w-xl">{lede}</p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/pricing#start-trial" className="gp-btn">
                Start free trial
              </Link>
              <a
                href="https://calendly.com/alan-citywidedigital/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="gp-btn-ghost"
              >
                Book a demo call
              </a>
            </div>

            <p className="gp-kicker mt-8">{note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
