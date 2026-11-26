import { useEffect, useRef, useState } from "react";

/**
 * Rob@ intake for /contact.
 *
 * Rebuilt from the supplied `cwd-contact-embed.html` as a React component, so
 * the frame survives route changes and its message listener is cleaned up.
 * Behaviour is the same as the supplied block:
 *  - the frame reports its own height, keeping the page at one scrollbar
 *  - `allow="clipboard-write"` is required by the "Copy brief" button
 *  - a completed brief dispatches `cwd:intake-submitted` on the page
 *
 * LAUNCH: replace INTAKE_URL with the published intake address once the Rob@
 * app is published. The staging preview address below is for testing only.
 */
const INTAKE_URL =
  "https://92356209427d420bb526a379ff7caf67.live-preview.enter.pro/embed/intake?w=cwd-citywide&source=https%3A%2F%2Fwww.citywidedigital.ca%2Fcontact";

const INTAKE_ORIGIN = new URL(INTAKE_URL).origin;

/**
 * Starting height before the frame reports its own, so the section does not
 * jump on load. Once a height arrives the frame is allowed to shrink: holding a
 * larger floor leaves a dark band under the intake.
 */
const INITIAL_HEIGHT = 720;

/** Never collapse below a usable conversation panel. */
const MIN_HEIGHT = 420;

type IntakeMessage = {
  type?: string;
  height?: unknown;
  reference?: unknown;
  industry?: unknown;
};

export function RobIntakeEmbed() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  /**
   * The intake page ships plain-text HTML (title plus the "Rob@ is an AI
   * assistant" notice) that its script replaces with the conversation. Showing
   * the frame only once that script reports a height keeps the text-only shell
   * from flashing on load. The timer is the fallback for a frame that never
   * reports, so a broken intake is still visible rather than invisible.
   */
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== INTAKE_ORIGIN) return;

      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;

      const data = (event.data ?? {}) as IntakeMessage;

      if (
        data.type === "cw-intake:height" &&
        typeof data.height === "number" &&
        Number.isFinite(data.height)
      ) {
        setHeight(Math.max(MIN_HEIGHT, Math.ceil(data.height)));
        setRevealed(true);
      }

      if (data.type === "cw-intake:submitted") {
        // The site has no analytics layer of its own yet, so the conversion is
        // dispatched for a future listener rather than pushed to a dataLayer.
        window.dispatchEvent(
          new CustomEvent("cwd:intake-submitted", {
            detail: { reference: data.reference, industry: data.industry },
          }),
        );
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="mt-6 w-full">
      <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--gp-ink-38)]">
        Rob@ is an AI assistant. A human reviews every brief.
      </p>

      {/* The frame is loaded eagerly so its app boots alongside the page instead
          of waiting for a scroll into view, which is what made mobile slow. */}
      <div className="relative" style={{ minHeight: height }} aria-busy={!revealed}>
        <iframe
          ref={frameRef}
          src={INTAKE_URL}
          title="Rob@ — CityWide Digital intake"
          allow="clipboard-write"
          style={{ height, opacity: revealed ? 1 : 0 }}
          className="block w-full border-0 bg-transparent transition-opacity duration-200"
        />
        {!revealed && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--gp-line-soft)] bg-[#080d16]/80">
            <span className="relative flex h-10 w-10 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ffb547]/10" />
              <span className="relative flex h-3 w-3 rounded-full bg-[#ffb547]" />
            </span>
            <span
              role="status"
              className="px-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gp-ink-55)]"
            >
              Loading Rob@… what&rsquo;s the hurry?
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
