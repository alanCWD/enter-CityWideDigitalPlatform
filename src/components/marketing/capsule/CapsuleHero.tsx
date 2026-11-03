import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, X } from "lucide-react";
import { GoogleMark } from "@/components/branding/GoogleMark";
import { SkyNetwork } from "./SkyNetwork";

/**
 * Capsule hero — the full photographic sequence.
 *
 * Scroll (or click / ↓ / "Run the capsule") drives it:
 *   01 the sealed capsule cabin,  02 the hatch iris opening as the cabin zooms
 *   through it,  03 out over Earth from orbit, where the network runs itself.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);

const STAGES = ["01 · Hatch", "02 · Cabin", "03 · Window", "04 · Orbit"];

export function CapsuleHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [networkMounted, setNetworkMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const [announcement, setAnnouncement] = useState("Capsule sealed");

  const openTargetY = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return 0;
    const vh = window.innerHeight;
    return section.offsetTop + (section.offsetHeight - vh) * 0.94;
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

    /* A restored scroll position can land inside the sequence; start at the hatch. */
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
      const vw = window.innerWidth || 1;
      const rect = section.getBoundingClientRect();
      const span = Math.max(1, section.offsetHeight - vh);
      const p = clamp01(-rect.top / span);

      const scene = sceneRef.current;
      if (scene) {
        const zoom = 1 + smooth(range(p, 0.03, 0.62)) * 0.42;
        const fade = smooth(range(p, 0.7, 0.88));

        scene.style.setProperty("--hatch-scale", String(zoom));
        scene.style.setProperty("--hatch-opacity", String(1 - fade));
        scene.style.setProperty("--space-scale", String(1.12 - smooth(range(p, 0.2, 0.95)) * 0.12));
        scene.style.setProperty("--gap", `${smooth(range(p, 0.08, 0.5)) * Math.min(vw, vh) * 0.16}px`);
        scene.style.setProperty("--flare", String(0.35 * Math.sin(Math.PI * clamp01(range(p, 0.24, 0.62)))));
        scene.style.setProperty("--chamber-scale", String(1 + smooth(range(p, 0.62, 0.9)) * 2.4));
        scene.style.setProperty("--chamber-opacity", String(1 - smooth(range(p, 0.8, 0.95))));
      }

      const networkEl = networkRef.current;
      if (networkEl) {
        const reveal = smooth(range(p, 0.87, 0.99));
        networkEl.style.opacity = String(reveal * 0.82);
      }

      const headlineEl = headlineRef.current;
      if (headlineEl) {
        const fade = range(p, 0.03, 0.2);
        headlineEl.style.opacity = String(1 - fade);
        headlineEl.style.transform = `translateY(${-24 * fade}px)`;
        headlineEl.style.pointerEvents = fade > 0.6 ? "none" : "auto";
      }

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${p})`;
      }
      if (triggerRef.current) {
        triggerRef.current.disabled = p > 0.1;
      }

      if (!mounted && p > 0.55) {
        mounted = true;
        setNetworkMounted(true);
      }

      const nextStage = p < 0.15 ? 0 : p < 0.6 ? 1 : p < 0.84 ? 2 : 3;
      if (nextStage !== lastStage) {
        lastStage = nextStage;
        setStage(nextStage);
        setAnnouncement(STAGES[nextStage]);
      }

      const nowOpen = p > 0.86;
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
      className="relative h-[280vh]"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* ── Scene ── */}
        <div ref={sceneRef} className="cap-scene">
          <img
            src="/capsule/space-v3.webp"
            alt=""
            aria-hidden="true"
            className="cap-scene__space"
            draggable={false}
          />
          <div className="cap-scene__chamber" aria-hidden="true">
            <div className="cap-scene__window" />
          </div>

          <img
            src="/capsule/hatch-v3.webp"
            alt=""
            aria-hidden="true"
            className="cap-scene__hatch"
            draggable={false}
          />
          <div className="cap-scene__gap" aria-hidden="true" />

          <div className="cap-scene__flare" aria-hidden="true" />

          <div ref={networkRef} className="cap-scene__network" aria-hidden="true">
            {networkMounted && <SkyNetwork active={networkMounted} />}
          </div>

          <div className="cap-scene__scrim cap-scene__scrim--top" aria-hidden="true" />
          <div className="cap-scene__scrim cap-scene__scrim--bottom" aria-hidden="true" />

          <button
            ref={triggerRef}
            type="button"
            onClick={openCapsule}
            className="cap-scene__trigger"
            aria-label="Open the capsule hatch and run the sequence"
          />
        </div>

        <div className="cap-noise" aria-hidden="true" />

        {/* ── HUD ── */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-6 pb-8 pt-24 md:px-10 md:pb-10 md:pt-28">
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

          {/* Right rail: stages + orbit metrics */}
          <div className="pointer-events-none absolute right-10 top-1/2 hidden -translate-y-1/2 text-right md:block">
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

          <div className="relative">
            {open && (
              <div className="absolute inset-x-0 bottom-[3.75rem] max-w-md">
                <p className="cap-kicker mb-3">04 / Over the continents</p>
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
              <h1 id="capsule-hero-title" className="cap-display text-[clamp(1.9rem,4.2vw,3.6rem)]">
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

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
              {open ? (
                <button type="button" onClick={closeCapsule} className="cap-close">
                  <X className="h-3 w-3" aria-hidden="true" />
                  Return to capsule
                  <span className="hidden text-[var(--cap-ink-24)] sm:inline">· Esc</span>
                </button>
              ) : (
                <button type="button" onClick={openCapsule} className="cap-scroll-cue pointer-events-auto">
                  {stage === 0 ? "Scroll or press ↓ to open the hatch" : "Keep scrolling through the hatch"}
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
