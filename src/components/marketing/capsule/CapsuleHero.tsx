import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { GoogleMark } from "@/components/branding/GoogleMark";
import { EarthData } from "./EarthData";

/**
 * Capsule journey — a replica of the reference demo's scroll-scrubbed transit.
 *
 * The cabin/hatch movement is a rendered video whose currentTime is scrubbed by
 * scroll progress (exactly like the demo), with stills for the sealed hatch and
 * the final orbit frame. Copy layers fade in at the demo's own timecodes:
 * intro out over the first ~0.8–2.2s of video, cabin copy 3–8s, orbit copy from
 * 12.8s, and the end still from 94% of the journey.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

const DESKTOP_VIDEO = "/capsule/transit-v3.mp4";
const MOBILE_VIDEO = "/capsule/transit-mobile-v3.mp4";
const HATCH_STILL = "/capsule/hatch-v3.webp";
const END_STILL = "/capsule/space-v3.webp";

export function CapsuleHero() {
  const journeyRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLElement>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const scrollToProgress = useCallback((target: number) => {
    const journey = journeyRef.current;
    if (!journey) return;
    const span = Math.max(1, journey.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: journey.offsetTop + span * clamp01(target),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const journey = journeyRef.current;
    const scene = sceneRef.current;
    const video = videoRef.current;
    if (!journey || !scene || !video) return;

    /* Load the variant the demo loads, based on width. */
    const source = window.matchMedia("(max-width: 767px)").matches ? MOBILE_VIDEO : DESKTOP_VIDEO;
    video.src = source;
    video.muted = true;
    video.load();

    /* iOS only decodes frames for a video that has been played once; unlock it
       on the first interaction so scrubbing shows real frames, not black. */
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      const playing = video.play();
      if (playing && typeof playing.then === "function") {
        playing
          .then(() => {
            video.pause();
            render();
          })
          .catch(() => {
            /* Autoplay refused: leave it; the user's scroll still seeks. */
          });
      }
    };
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    window.addEventListener("pointerdown", unlock, { once: true });

    let videoOk = false;
    let fallback = false;
    let seekFailures = 0;

    const onMeta = () => {
      videoOk = Number.isFinite(video.duration) && video.duration > 0;
      setReady(videoOk);
      setFailed(!videoOk);
      render();
    };

    /* A successful seek clears the fallback, so scrubbing works again after
       scrolling back up and forward. */
    const onSeeked = () => {
      seekFailures = 0;
      if (fallback && videoOk) {
        fallback = false;
        render();
      }
    };
    const onError = () => {
      videoOk = false;
      setFailed(true);
      render();
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("canplay", onSeeked);
    video.addEventListener("error", onError);

    let frame = 0;
    const render = () => {
      frame = 0;
      const span = Math.max(1, journey.offsetHeight - window.innerHeight);
      const b = clamp01((window.scrollY - journey.offsetTop) / span);
      const g = clamp01((b - 0.055) / 0.885);
      const duration = videoOk ? Math.max(0, video.duration - 1 / 60) : 0;

      /* Keep asking for the right frame even while in fallback, so a host that
         becomes seekable again restores the filmed sequence. */
      if (videoOk) {
        const target = g * duration;
        if (!video.seeking && Math.abs(video.currentTime - target) > 1 / 60) {
          video.currentTime = target;
          window.setTimeout(() => {
            if (Math.abs(video.currentTime - target) > 0.6) {
              seekFailures += 1;
              if (seekFailures >= 3 && !fallback) {
                fallback = true;
                render();
              }
            }
          }, 1400);
        }
      }

      const live = videoOk && !fallback;
      const time = live ? video.currentTime : b * 14;
      /* Still-driven fallback (also used when the host cannot seek the video). */
      const hatch = live ? 1 - smooth(b / 0.055) : 1 - smooth(b / 0.45);
      const end = live ? smooth((Math.min(b, 1) - 0.94) / 0.06) : smooth((b - 0.32) / 0.3);
      const intro = live ? 1 - smooth((time - 0.8) / 1.4) : 1 - smooth(b / 0.18);
      const cabin = live
        ? smooth((time - 3) / 0.8) * (1 - smooth((time - 8) / 0.8))
        : smooth((b - 0.14) / 0.14) * (1 - smooth((b - 0.4) / 0.16));
      const space = live ? smooth((time - 12.8) / 0.8) : smooth((b - 0.48) / 0.22);

      scene.style.setProperty("--hatch-opacity", String(hatch));
      scene.style.setProperty("--end-opacity", String(end));
      scene.style.setProperty("--intro-opacity", String(intro));
      scene.style.setProperty("--cabin-copy-opacity", String(cabin));
      scene.style.setProperty("--space-copy-opacity", String(space));
      scene.style.setProperty("--journey-progress", String(b));
      scene.dataset.position = b <= 0.001 ? "start" : b >= 0.999 ? "end" : "transit";

      if (trackRef.current) {
        trackRef.current.style.transform = `scaleX(${b})`;
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(render);
    };

    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("canplay", onSeeked);
      video.removeEventListener("error", onError);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  return (
    <section
      ref={journeyRef}
      className="cap-journey"
      aria-label="CityWide capsule — scroll to open the hatch and travel to orbit"
    >
      <div ref={sceneRef} className="cap-scene" data-position="start">
        <div className="cap-media" aria-hidden="true">
          <video
            ref={videoRef}
            className="cap-video"
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            tabIndex={-1}
          />
          <img
            className="cap-still cap-hatch"
            src={HATCH_STILL}
            alt=""
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
          />
          <img className="cap-still cap-end" src={END_STILL} alt="" width={1920} height={1080} />
          <EarthData />
        </div>

        <div className="cap-scrim" aria-hidden="true" />

        {/* Header */}
        <header className="cap-header">
          <span className="cap-eyebrow">Managed local presence · Since 2016</span>
          <span className="cap-eyebrow">
            <span className="cap-live-dot" aria-hidden="true" /> Automated presence
          </span>
        </header>

        {/* Copy layers */}
        <div className="cap-copy">
          <div className="cap-intro" style={{ opacity: "var(--intro-opacity)" }}>
            <span className="cap-eyebrow">01 / The capsule</span>
            <h1>
              Your Business Website
              <br />
              Runs <span>Itself Online.</span>
            </h1>
            <div className="cap-powered">
              <span className="cap-eyebrow cap-powered__label">Powered by</span>
              <GoogleMark className="h-4 w-4" />
              <span className="sr-only">Google</span>
            </div>
            <p>
              CityWide Digital connects your Google Business Profile to a live website, your social
              channels and every major directory — automatically.
            </p>
            <div className="cap-actions">
              <Link to="/pricing#start-trial" className="cap-btn">
                Start the trial
              </Link>
              <button type="button" onClick={() => scrollToProgress(0.62)} className="cap-btn-ghost">
                Run the capsule
              </button>
            </div>
          </div>

          <div className="cap-cabin" style={{ opacity: "var(--cabin-copy-opacity)" }}>
            <span className="cap-eyebrow">02 / Inside the capsule</span>
            <h2>
              Designed to run itself.
              <br />
              <span>Built for discovery.</span>
            </h2>
            <p>Your listings, posts, reviews and website stay in sync while you get on with the work.</p>
          </div>

          <div className="cap-space" style={{ opacity: "var(--space-copy-opacity)" }}>
            <span className="cap-eyebrow">03 / Beyond the window</span>
            <h2>
              A Live Website.
              <br />
              <span>A World of Signals.</span>
            </h2>
            <p>
              Posted, synced, listing-accurate and reviewed — 4 social channels, 40+ directories,
              reviews on autopilot, 24/7.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="cap-footer">
          <div className="cap-scroll-cue">
            <span className="cap-cue-forward">
              Scroll to open the hatch <ArrowDown className="h-3 w-3" aria-hidden="true" />
            </span>
            <span className="cap-cue-back">
              Scroll up to return <ArrowUp className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>

          <div className="cap-track" aria-hidden="true">
            <span>
              <i ref={trackRef as React.RefObject<HTMLElement>} />
            </span>

          </div>
        </footer>

        <p className="sr-only" aria-live="polite">
          {failed
            ? "The video could not load; the capsule is shown as still frames."
            : ready
              ? "Experience ready."
              : "Loading the capsule experience."}
        </p>
      </div>
    </section>
  );
}
