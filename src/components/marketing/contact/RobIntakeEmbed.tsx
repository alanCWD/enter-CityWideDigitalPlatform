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

/** Floor height, so the frame is usable before it reports a height. */
const MIN_HEIGHT = 720;

type IntakeMessage = {
  type?: string;
  height?: unknown;
  reference?: unknown;
  industry?: unknown;
};

export function RobIntakeEmbed() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);

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

      <iframe
        ref={frameRef}
        src={INTAKE_URL}
        title="Rob@ — CityWide Digital intake"
        loading="lazy"
        allow="clipboard-write"
        style={{ height }}
        className="block w-full border-0 bg-transparent"
      />

      <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-[var(--gp-ink-55)]">
        Trouble loading the intake?{" "}
        <a
          href={INTAKE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--gp-ice)] underline underline-offset-2 transition-colors hover:text-white"
        >
          Open it in a new tab
        </a>
        , email{" "}
        <a
          href="mailto:alan@citywidedigital.ca"
          className="text-[var(--gp-ice)] underline underline-offset-2 transition-colors hover:text-white"
        >
          alan@citywidedigital.ca
        </a>
        , or call{" "}
        <a
          href="tel:+12508827378"
          className="text-[var(--gp-ice)] underline underline-offset-2 transition-colors hover:text-white"
        >
          250-882-7378
        </a>
        .
      </p>
    </div>
  );
}
