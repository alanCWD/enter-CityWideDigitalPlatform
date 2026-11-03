import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, X } from "lucide-react";
import { GoogleMark } from "@/components/branding/GoogleMark";
import { WorldStage } from "./WorldStage";

/**
 * Capsule hero — the full simulation.
 *
 * A pinned, scroll-driven sequence in four movements:
 *   01 the sealed hatch, 02 the hatch swinging open, 03 traversing the cabin,
 *   04 out into orbit over the self-running network.
 *
 * Clicking the hatch (or arrow keys) walks the same timeline, so the gesture
 * matches the scroll. Everything is CSS layers over the world canvas; no
 * pointer input is required once the sequence starts.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);

const STAGES = ["01 · Hatch", "02 · Cabin", "03 · Orbit"];

export function CapsuleHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const simRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [stageMounted, setStageMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const [announcement, setAnnouncement] = useState("Hatch sealed");

  const openTargetY = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return 0;
    const vh = window.innerHeight;
    return section.offsetTop + (section.offsetHeight - vh) * 0.74;
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

    /* On a reload the browser can restore a scroll position from inside the
       sequence, which looks like the capsule has vanished. Start at the hatch. */
    if (window.scrollY > 0 && window.scrollY < section.offsetHeight) {
      window.scrollTo({ top: 0 });
    }

    let frame = 0;
    let mounted = false;
    let lastStage = -1;
    let lastOpen = false;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const rect = section.getBoundingClientRect();
      const span = Math.max(1, section.offsetHeight - vh);
      const p = clamp01(-rect.top / span);

      const sim = simRef.current;
      if (sim) {
        const hatch = smooth(range(p, 0.1, 0.42));
        const dolly = smooth(range(p, 0.36, 0.7));
        const base = Math.min(window.innerWidth, vh) * (window.innerWidth < 700 ? 0.24 : 0.33);
        const radius = base * (1 + dolly * 2.6);

        sim.style.setProperty("--cap-r", `${radius}px`);
        sim.style.setProperty("--door-angle", String(hatch * 104));
        sim.style.setProperty("--door-opacity", String(1 - smooth(range(p, 0.44, 0.62))));
        sim.style.setProperty("--cabin-scale", String(1 + dolly * 2.3));
        sim.style.setProperty("--cabin-opacity", String(Math.max(0, 1 - dolly * 1.15)));
        sim.style.setProperty("--hull-scale", String(1 + dolly * 0.5));
        sim.style.setProperty("--hull-opacity", String(1 - smooth(range(p, 0.56, 0.76))));
        const reveal = smooth(range(p, 0.34, 0.7));
        sim.style.setProperty(
          "--glow",
          String((0.05 + hatch * 0.2 + dolly * 0.16) * (1 - reveal * 0.9)),
        );
      }

      const worldEl = worldRef.current;
      if (worldEl) {
        const reveal = smooth(range(p, 0.34, 0.7));
        worldEl.style.opacity = String(reveal);
        worldEl.style.transform = `scale(${0.96 + reveal * 0.04})`;
      }

      const headlineEl = headlineRef.current;
      if (headlineEl) {
        const fade = range(p, 0.04, 0.24);
        headlineEl.style.opacity = String(1 - fade);
        headlineEl.style.transform = `translateY(${-24 * fade}px)`;
        headlineEl.style.pointerEvents = fade > 0.6 ? "none" : "auto";
      }

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${p})`;
      }

      if (triggerRef.current) {
        triggerRef.current.disabled = p > 0.08;
      }

      if (!mounted && p > 0.02) {
        mounted = true;
        setStageMounted(true);
      }

      const nextStage = p < 0.1 ? 0 : p < 0.56 ? 1 : 2;
      if (nextStage !== lastStage) {
        lastStage = nextStage;
        setStage(nextStage);
        setAnnouncement(STAGES[nextStage]);
      }

      const nowOpen = p > 0.6;
      if (nowOpen !== lastOpen) {
        lastOpen = nowOpen;
        setOpen(nowOpen);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        window.scrollBy({ top: window.innerHeight * 0.18, behavior: "smooth" });
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        window.scrollBy({ top: -window.innerHeight * 0.18, behavior: "smooth" });
      } else if (e.key === "Escape" && lastOpen) {
        closeCapsule();
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [closeCapsule]);

  return (
    <section
      ref={sectionRef}
      id="capsule-hero"
      aria-labelledby="capsule-hero-title"
      className="relative h-[260vh]"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="cap-stars opacity-70" aria-hidden="true" />

        {/* ── Capsule simulation ── */}
        <div ref={simRef} className="cap-sim">
          {/* World seen through the hatch */}
          <div
            ref={worldRef}
            className="cap-sim__space opacity-0"
            style={{ willChange: "opacity, transform" }}
          >
            {stageMounted && <WorldStage active={stageMounted} />}
          </div>

          {/* Cabin ribs */}
          <div className="cap-sim__cabin" aria-hidden="true">
            <span className="cap-sim__rib" />
            <span className="cap-sim__rib" />
            <span className="cap-sim__rib" />
            <span className="cap-sim__rib" />
          </div>

          {/* Hull + hatch doors */}
          <div className="cap-sim__hull" aria-hidden="true" />
          <div className="cap-sim__aperture" aria-hidden="true">
            <div className="cap-sim__door cap-sim__door--l" />
            <div className="cap-sim__door cap-sim__door--r" />
            <div className="cap-sim__plate">CW · Entry 01</div>
          </div>
          <div className="cap-sim__rim" aria-hidden="true" />

          {/* Light spilling through the opening hatch */}
          <div className="cap-sim__glow" aria-hidden="true" />

          <button
            ref={triggerRef}
            type="button"
            onClick={openCapsule}
            className="cap-sim__trigger"
            aria-label="Open the hatch — run the capsule sequence"
          />
        </div>

        <div className="cap-noise" aria-hidden="true" />

        {/* ── HUD ── */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-6 pb-8 pt-24 md:px-10 md:pb-10 md:pt-28">
          {/* Top rail */}
          <div className="flex items-start justify-between gap-6">
            <span className="cap-kicker leading-relaxed">
              Managed local presence
              <br />
              Since 2016
            </span>
            <span className="cap-kicker flex items-center gap-2 whitespace-nowrap text-right">
              <span className="cap-live-dot" aria-hidden="true" />
              Automated presence
            </span>
          </div>

          {/* Right rail: stages + opened metrics */}
          <div className="pointer-events-none hidden md:block absolute right-10 top-1/2 -translate-y-1/2 text-right">
            {open && (
              <dl className="mb-8 w-56 text-left">
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
            )}
            <div className="space-y-1">
              {STAGES.map((label, index) => (
                <div key={label} className="cap-stage" data-active={index === stage}>
                  <span className="cap-stage__bar" aria-hidden="true" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom rail */}
          <div>
            {open && (
              <div className="mb-6 max-w-md">
                <p className="cap-kicker mb-3">03 / Over the continents</p>
                <h2 className="text-2xl font-light tracking-tight text-[var(--cap-ink)] md:text-3xl">
                  Earth, live.
                </h2>
                <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-[var(--cap-ink-72)]">
                  Your business is already out here — posted, synced, listing-accurate and
                  reviewed, while you get on with the work.
                </p>
              </div>
            )}

            <div ref={headlineRef} className="max-w-2xl">
              <p className="cap-kicker mb-4">01 / The capsule</p>
              <h1 id="capsule-hero-title" className="cap-display text-[clamp(2rem,4.4vw,3.75rem)]">
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
                <button type="button" onClick={openCapsule} className="cap-btn-ghost">
                  Run the capsule
                </button>
              </div>
            </div>

            {/* Footer rail */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
              {open ? (
                <button type="button" onClick={closeCapsule} className="cap-close">
                  <X className="h-3 w-3" aria-hidden="true" />
                  Return to capsule
                  <span className="hidden text-[var(--cap-ink-24)] sm:inline">· Esc</span>
                </button>
              ) : (
                <button type="button" onClick={openCapsule} className="cap-scroll-cue pointer-events-auto">
                  {stage === 0
                    ? "Scroll or press ↓ to open the hatch"
                    : "Hatch open — keep scrolling through the cabin"}
                  <ArrowDown className="h-3 w-3" aria-hidden="true" />
                </button>
              )}

              <div className="cap-progress hidden md:block" aria-hidden="true">
                <div ref={progressRef} className="cap-progress__fill" style={{ transform: "scaleX(0)" }} />
              </div>

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
