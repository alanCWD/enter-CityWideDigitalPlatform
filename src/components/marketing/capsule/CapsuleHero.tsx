import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, X } from "lucide-react";
import { GoogleMark } from "@/components/branding/GoogleMark";
import { WorldStage } from "./WorldStage";

/**
 * Capsule hero.
 *
 * The section is taller than the viewport and pins a full-screen stage. Scroll
 * progress drives the hatch expansion: at rest you see the capsule, and as you
 * keep scrolling the capsule opens onto the world view. Clicking the capsule
 * glides the page to that open state, so both gestures do the same thing.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);

export function CapsuleHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);

  const [stageMounted, setStageMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("Capsule closed");

  /** Scroll distance that represents a fully opened capsule. */
  const openTargetY = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return 0;
    const vh = window.innerHeight;
    const top = section.offsetTop;
    return top + (section.offsetHeight - vh) * 0.66;
  }, []);

  const openCapsule = useCallback(() => {
    window.scrollTo({ top: openTargetY(), behavior: "smooth" });
  }, [openTargetY]);

  const closeCapsule = useCallback(() => {
    const section = sectionRef.current;
    window.scrollTo({ top: section ? section.offsetTop : 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;
    let lastOpen = false;
    let mounted = false;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const rect = section.getBoundingClientRect();
      const span = Math.max(1, section.offsetHeight - vh);
      const p = clamp01(-rect.top / span);

      const capsuleEl = capsuleRef.current;
      if (capsuleEl) {
        const grow = smooth(range(p, 0.16, 0.6));
        capsuleEl.style.transform = `translate(-50%, -50%) scale(${1 + grow * 11})`;
        capsuleEl.style.opacity = String(1 - range(p, 0.34, 0.56));
        capsuleEl.style.pointerEvents = p > 0.3 ? "none" : "auto";
      }

      const worldEl = worldRef.current;
      if (worldEl) {
        const reveal = smooth(range(p, 0.2, 0.58));
        worldEl.style.opacity = String(reveal);
        worldEl.style.transform = `scale(${0.94 + reveal * 0.06})`;
      }

      const headlineEl = headlineRef.current;
      if (headlineEl) {
        const fade = range(p, 0.04, 0.26);
        headlineEl.style.opacity = String(1 - fade);
        headlineEl.style.transform = `translateY(${-24 * fade}px)`;
        headlineEl.style.pointerEvents = fade > 0.6 ? "none" : "auto";
      }

      if (!mounted && p > 0.08) {
        mounted = true;
        setStageMounted(true);
      }

      const nowOpen = p > 0.5;
      if (nowOpen !== lastOpen) {
        lastOpen = nowOpen;
        setOpen(nowOpen);
        setAnnouncement(nowOpen ? "World view open" : "Capsule closed");
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCapsule();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCapsule]);

  return (
    <section
      ref={sectionRef}
      id="capsule-hero"
      aria-labelledby="capsule-hero-title"
      className="relative h-[240vh]"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Ambient layers */}
        <div className="cap-stars opacity-70" aria-hidden="true" />
        <div
          className="cap-vignette"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 42%, rgba(10,16,26,0.2) 0%, rgba(3,5,8,0.86) 72%)",
          }}
          aria-hidden="true"
        />

        {/* World stage (mounted lazily once opening begins) */}
        <div
          ref={worldRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{ willChange: "opacity, transform" }}
        >
          {stageMounted && <WorldStage active={stageMounted} />}
        </div>

        <div className="cap-noise" aria-hidden="true" />

        {/* Capsule */}
        <div
          ref={capsuleRef}
          className="absolute left-1/2 top-[38%] z-10 w-[clamp(190px,26vw,320px)] -translate-x-1/2 -translate-y-1/2 md:top-[46%]"
          style={{ willChange: "transform, opacity" }}
        >
          <button
            type="button"
            onClick={openCapsule}
            className="cap-capsule aspect-square w-full"
            aria-label="Open the capsule — view the world"
          >
            <span className="cap-capsule__ticks" aria-hidden="true" />
            <span className="cap-capsule__ring cap-capsule__ring--outer" aria-hidden="true" />
            <span className="cap-capsule__ring" aria-hidden="true" />
            <span className="cap-capsule__ring cap-capsule__ring--mid" aria-hidden="true" />
            <span className="cap-capsule__pulse" aria-hidden="true" />
            <span className="cap-capsule__pulse cap-capsule__pulse--delay" aria-hidden="true" />
            <span className="cap-capsule__hatch" aria-hidden="true">
              <span className="cap-capsule__dots" />
              <span className="cap-capsule__glow" />
            </span>
          </button>
        </div>

        {/* HUD chrome */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-6 pb-8 pt-24 md:px-10 md:pb-10 md:pt-28">
          {/* Top rail */}
          <div className="flex items-start justify-between gap-6">
            <span className="cap-kicker leading-relaxed">
              Managed local presence
              <br />
              Since 2016
            </span>
            <span className="cap-kicker flex items-center gap-2 text-right">
              <span className="cap-live-dot" aria-hidden="true" />
              Automated presence
            </span>
          </div>

          {/* Bottom rail */}
          <div className="relative">
            {/* World-view annotations — overlay the (faded) headline when open */}
            {open && (
              <div className="absolute inset-x-0 bottom-[3.75rem] grid gap-6 pb-2 transition-opacity duration-700 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="max-w-md">
                  <p className="cap-kicker mb-3">02 / Over the continents</p>
                  <h2 className="text-2xl font-light tracking-tight text-[var(--cap-ink)] md:text-3xl">
                    Earth, live.
                  </h2>
                  <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-[var(--cap-ink-72)]">
                    Your business is already out here — posted, synced, listing-accurate and
                    reviewed, while you get on with the work.
                  </p>
                </div>
                <dl className="hidden w-56 md:block">
                  {[
                    ["Social channels", "4 · synced"],
                    ["Directories", "40+ · accurate"],
                    ["Reviews", "auto-collected"],
                    ["Availability", "24 / 7"],
                  ].map(([label, value]) => (
                    <div className="cap-metric" key={label}>
                      <dt>{label}</dt>
                      <dd>
                        <strong>{value}</strong>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Closed-state message */}
            <div ref={headlineRef} className="max-w-2xl">
              <p className="cap-kicker mb-4">01 / The capsule</p>
              <h1
                id="capsule-hero-title"
                className="cap-display text-[clamp(2rem,4.6vw,3.9rem)]"
              >
                Your Business
                <br />
                Website Runs
                <br />
                Itself Online.
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="cap-kicker cap-kicker--bright">Powered by</span>
                <GoogleMark className="h-4 w-4" />
                <span className="sr-only">Google</span>
                <span className="h-3 w-px bg-white/15" aria-hidden="true" />
                <span className="cap-kicker hidden sm:inline">Google Business Profile</span>
              </div>

              <p className="cap-lede mt-4 max-w-lg">
                CityWide Digital connects your Google Business Profile to a live website, your
                social channels and every major directory — automatically.
              </p>

              <div className="pointer-events-auto mt-7 flex flex-wrap items-center gap-3">
                <Link to="/pricing" className="cap-btn">
                  Start free trial
                </Link>
                <a
                  href="https://calendly.com/alan-citywidedigital/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cap-btn-ghost"
                >
                  Book a demo
                </a>
              </div>
            </div>

            {/* Footer rail: cue / close */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
              {open ? (
                <button type="button" onClick={closeCapsule} className="cap-close">
                  <X className="h-3 w-3" aria-hidden="true" />
                  Close capsule
                  <span className="hidden text-[var(--cap-ink-24)] sm:inline">· Esc</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCapsule}
                  className="cap-scroll-cue pointer-events-auto"
                >
                  Scroll or click to open
                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              <p className="cap-kicker hidden md:block">
                {open ? "No scroll needed — it runs itself" : "Human curiosity. No manual updates."}
              </p>
            </div>
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </section>
  );
}
