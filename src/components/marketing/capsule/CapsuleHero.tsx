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
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    const journey = journeyRef.current;
    const scene = sceneRef.current;
    const video = videoRef.current;
    if (!journey || !scene || !video) return;

    /* Load the variant the demo loads, based on width. */
    const source = window.matchMedia("(max-width: 767px)").matches ? MOBILE_VIDEO : DESKTOP_VIDEO;
    video.muted = true;
    video.preload = "auto";

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    let objectUrl: string | null = null;
    let cancelled = false;

    /* Chrome refuses to seek a file that the host serves without byte ranges.
       Pull the whole film into memory first (it is ~1.8 MB): a blob URL is fully
       buffered, so every frame is locally seekable. iOS keeps the progressive
       source, where blob playback is less reliable. */
    const loadFilm = async () => {
      if (isIOS) {
        video.src = source;
        video.load();
        return;
      }
      try {
        const response = await fetch(source, { cache: "force-cache" });
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        video.load();
      } catch {
        if (cancelled) return;
        video.src = source;
        video.load();
      }
    };
    void loadFilm();

    /* iOS only decodes frames for a video that has been played once; unlock it
       on the first interaction so scrubbing shows real frames, not black. */
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      interacted = true;
      const playing = video.play();
      if (playing && typeof playing.then === "function") {
        playing
          .then(() => {
            video.pause();
            if (!seekVerified) {
              probed = false;
              probeSeek();
            }
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

    let probed = false;
    let interacted = false;
    let seekVerified = false;
    /** Chrome refuses to seek until enough of the file is buffered. */
    let canScrub = false;
    let desiredTime = 0;
    let scrubRaf = 0;

    /* One-shot capability probe, before any scrolling: if this host refuses
       range seeks, use the stills for the whole journey rather than flickering
       into them mid-scroll. Retried once after the first interaction, because
       iOS may not honour a seek until the decoder has been unlocked. */
    const probeSeek = () => {
      if (!videoOk || probed || !canScrub) return;
      probed = true;
      let landed = false;
      const onProbeSeeked = () => {
        landed = true;
        seekVerified = true;
        video.removeEventListener("seeked", onProbeSeeked);
      };
      video.addEventListener("seeked", onProbeSeeked);
      try {
        video.currentTime = Math.min(1, video.duration * 0.05);
      } catch {
        landed = false;
      }
      window.setTimeout(() => {
        video.removeEventListener("seeked", onProbeSeeked);
        if (!landed) {
          const started = window.scrollY > journey.offsetTop + 4;
          if (interacted || started) fallback = true;
          else probed = false;
        }
        render();
      }, 1600);
    };

    const onMeta = () => {
      videoOk = Number.isFinite(video.duration) && video.duration > 0;
      setReady(videoOk);
      setFailed(!videoOk);
      render();
    };

    /* Wait for real data before scrubbing — this is what Chrome needs. */
    const onBuffered = () => {
      if (!videoOk) return;
      if (video.readyState >= 2) {
        canScrub = true;
        probeSeek();
        queueScrub();
      }
    };

    /* A successful seek clears the fallback, so scrubbing works again after
       scrolling back up and forward. */
    const onSeeked = () => {
      /* Only restore the film when the host can genuinely seek this file. */
      if (fallback && videoOk && video.seekable.length > 0 && video.seekable.end(0) > 0) {
        fallback = false;
        render();
      }
    };
    /* One seek per animation frame at most; repeated seeks are what wedge
       Chrome's demuxer and leave black frames. */
    const queueScrub = () => {
      if (scrubRaf) return;
      scrubRaf = requestAnimationFrame(() => {
        scrubRaf = 0;
        if (!videoOk || autoActive || !canScrub || video.seeking) return;
        if (Math.abs(video.currentTime - desiredTime) > 0.04) {
          try {
            video.currentTime = desiredTime;
          } catch {
            /* ignore */
          }
        }
      });
    };

    const onError = () => {
      videoOk = false;
      setFailed(true);
      render();
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("loadeddata", onBuffered);
    video.addEventListener("canplay", onBuffered);
    video.addEventListener("canplaythrough", onBuffered);
    video.addEventListener("progress", onBuffered);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("seeked", queueScrub);
    video.addEventListener("error", onError);

    let frame = 0;
    /** True while the capsule is playing itself after "Run the capsule". */
    let autoActive = false;
    let autoRaf = 0;

    /* "Run the capsule": play the transit at 0.9x, carrying the page with it so
       the panels advance, then glide onto panel 03 and let the signals settle. */
    const runCapsule = () => {
      cancelAnimationFrame(autoRaf);
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      autoActive = true;
      const span = Math.max(1, journey.offsetHeight - window.innerHeight);
      const startY = journey.offsetTop;
      window.scrollTo({ top: startY });

      const settle = () => {
        const from = window.scrollY;
        const to = startY + span;
        const t0 = performance.now();
        const glide = (now: number) => {
          const k = Math.min(1, (now - t0) / 900);
          const eased = k * k * (3 - 2 * k);
          window.scrollTo({ top: from + (to - from) * eased });
          if (k < 1) autoRaf = requestAnimationFrame(glide);
          else autoActive = false;
        };
        autoRaf = requestAnimationFrame(glide);
      };

      if (!videoOk || fallback) {
        const t0 = performance.now();
        const step = (now: number) => {
          if (!autoActive) return;
          const k = Math.min(1, (now - t0) / 6000);
          window.scrollTo({ top: startY + span * (0.055 + k * 0.885) });
          if (k < 1) autoRaf = requestAnimationFrame(step);
          else settle();
        };
        autoRaf = requestAnimationFrame(step);
        return;
      }

      video.playbackRate = 0.9;
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      const playing = video.play();
      if (playing && typeof playing.catch === "function") playing.catch(() => {});

      const follow = () => {
        if (!autoActive) return;
        const d = video.duration || 14;
        const t = video.currentTime;
        const b = 0.055 + Math.min(1, t / d) * 0.885;
        window.scrollTo({ top: startY + span * b });
        if (!video.ended && t < d - 0.04) autoRaf = requestAnimationFrame(follow);
        else {
          video.pause();
          settle();
        }
      };
      autoRaf = requestAnimationFrame(follow);
    };

    runRef.current = runCapsule;

    /* Any deliberate input takes over from the automatic run. */
    const cancelAuto = () => {
      if (!autoActive) return;
      autoActive = false;
      cancelAnimationFrame(autoRaf);
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      video.pause();
    };
    window.addEventListener("wheel", cancelAuto, { passive: true });
    window.addEventListener("touchstart", cancelAuto, { passive: true });

    const render = () => {
      frame = 0;
      const span = Math.max(1, journey.offsetHeight - window.innerHeight);
      const b = clamp01((window.scrollY - journey.offsetTop) / span);
      const g = clamp01((b - 0.055) / 0.885);
      const duration = videoOk ? Math.max(0, video.duration - 1 / 60) : 0;

      /* Never switch modes mid-scroll: the probe decides once, up front. */
      if (videoOk && !autoActive) {
        desiredTime = g * duration;
        queueScrub();
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
      video.removeEventListener("seeked", queueScrub);
      video.removeEventListener("loadeddata", onBuffered);
      video.removeEventListener("canplay", onBuffered);
      video.removeEventListener("canplaythrough", onBuffered);
      video.removeEventListener("progress", onBuffered);
      cancelAnimationFrame(scrubRaf);
      video.removeEventListener("error", onError);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("wheel", cancelAuto);
      window.removeEventListener("touchstart", cancelAuto);
      cancelAnimationFrame(autoRaf);
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
              <button type="button" onClick={() => runRef.current()} className="cap-btn-ghost">
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
