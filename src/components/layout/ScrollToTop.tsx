import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Stop the browser from restoring the previous scroll position on reload or
// back/forward; each page should open at its own top.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

function scrollToSection(hash: string) {
  let id = "";
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return false;
  }
  if (!id) return false;
  const target = document.getElementById(id);
  if (!target) return false;
  // scroll-margin-top on the section keeps the fixed navbar from covering it.
  target.scrollIntoView({ block: "start" });
  return true;
}

/**
 * Every route change opens the destination page at its top. Links that point at
 * a section (e.g. /services#social-sync) scroll to that section instead, also
 * when only the hash changes while already on the page.
 */
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const timerRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    window.clearTimeout(timerRef.current);

    const scrollToTop = () => window.scrollTo({ top: 0, left: 0 });

    if (!hash) {
      scrollToTop();
      return;
    }

    if (scrollToSection(hash)) return;

    // A section can mount a frame after the route changed.
    const frame = window.requestAnimationFrame(() => {
      if (scrollToSection(hash)) return;
      timerRef.current = window.setTimeout(() => {
        if (!scrollToSection(hash)) scrollToTop();
      }, 80);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timerRef.current);
    };
  }, [pathname, hash, key]);

  return null;
}

export default ScrollToTop;
