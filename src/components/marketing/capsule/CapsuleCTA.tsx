import { Link } from "react-router-dom";

export function CapsuleCTA() {
  return (
    <section className="cap-section overflow-hidden" aria-labelledby="capsule-cta-title">
      <div className="cap-shell">
        <div className="relative border-t border-white/10 pt-16 md:pt-24">
          {/* Capsule motif */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10 opacity-60"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/10 opacity-60"
          />

          <p className="cap-kicker mb-6">07 / Next</p>
          <h2
            id="capsule-cta-title"
            className="cap-display max-w-3xl text-[clamp(2rem,4.6vw,3.8rem)]"
          >
            Ready to run your business online — on autopilot?
          </h2>
          <p className="cap-lede mt-6 max-w-xl">
            Start your free 30-day trial today. No credit card required.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/pricing#start-trial" className="cap-btn">
              Start free trial
            </Link>
            <a
              href="https://calendly.com/alan-citywidedigital/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="cap-btn-ghost"
            >
              Book a demo call
            </a>
          </div>

          <p className="cap-kicker mt-8">30-day free trial · No credit card · Cancel anytime</p>
        </div>
      </div>
    </section>
  );
}
