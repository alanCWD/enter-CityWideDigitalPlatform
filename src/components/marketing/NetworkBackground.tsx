import { useEffect, useRef } from "react";

/**
 * Business-presence ecosystem animation.
 *
 * Visual model:
 *  - Hubs = businesses. A few are "fully optimized" (many long connections),
 *    most are sparse (a handful of short ones).
 *  - Each connection represents a service channel: Google, social, citations,
 *    reviews, directories, blog, maps, etc. Each channel type has its own colour.
 *  - Lines DRAW themselves as the user scrolls and remain visible once drawn.
 *  - All hubs are tied together by sparse "ecosystem" lines so the whole canvas
 *    feels like one connected network.
 *  - Cursor proximity gently brightens nearby lines (subtle, no movement).
 */
type ChannelKey = "google" | "social" | "reviews" | "citations" | "directory" | "maps" | "blog" | "ads";
const CHANNEL_COLORS: Record<ChannelKey, string> = {
  google: "234, 179, 8", // amber
  social: "168, 85, 247", // violet
  reviews: "34, 197, 94", // green
  citations: "14, 165, 233", // sky
  directory: "236, 72, 153", // pink
  maps: "239, 68, 68", // red
  blog: "20, 184, 166", // teal
  ads: "249, 115, 22", // orange
};
const CHANNEL_KEYS = Object.keys(CHANNEL_COLORS) as ChannelKey[];

type Hub = {
  x: number;
  y: number;
  radius: number;
  /** 0..1 — how optimized. Drives connection count + reach. */
  optimization: number;
};

type Satellite = {
  x: number;
  y: number;
  radius: number;
  hubIndex: number;
  channel: ChannelKey;
  /** Order in which this connection draws as scroll advances (0..1). */
  drawAt: number;
};

type EcosystemLink = {
  fromHub: number;
  toHub: number;
  channel: ChannelKey;
  drawAt: number;
};

const HUB_COUNT = 8;
const HUB_COLOR = "255, 255, 255";

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hubsRef = useRef<Hub[]>([]);
  const satellitesRef = useRef<Satellite[]>([]);
  const ecosystemRef = useRef<EcosystemLink[]>([]);
  const scrollProgressRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    const seed = () => {
      const hubs: Hub[] = [];
      const cols = Math.ceil(Math.sqrt(HUB_COUNT));
      const rows = Math.ceil(HUB_COUNT / cols);
      let placed = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (placed >= HUB_COUNT) break;
          const cellW = width / cols;
          const cellH = height / rows;
          const cx = cellW * (c + 0.5) + (Math.random() - 0.5) * cellW * 0.45;
          const cy = cellH * (r + 0.5) + (Math.random() - 0.5) * cellH * 0.45;
          // Mostly sparse, a few highly optimized ones
          const roll = Math.random();
          const optimization =
            roll > 0.75
              ? 0.85 + Math.random() * 0.15 // ~25% are stars
              : roll > 0.5
                ? 0.4 + Math.random() * 0.25
                : 0.1 + Math.random() * 0.2;
          hubs.push({
            x: cx,
            y: cy,
            radius: 2 + optimization * 2.5,
            optimization,
          });
          placed++;
        }
      }
      hubsRef.current = hubs;

      // Build satellites for each hub
      const sats: Satellite[] = [];
      hubs.forEach((hub, i) => {
        // Number of connections scales with optimization. Stars get up to 16.
        const count = Math.round(3 + hub.optimization * 14);
        // Reach (distance) also scales with optimization.
        const minReach = 60;
        const maxReach = 120 + hub.optimization * 220;
        for (let s = 0; s < count; s++) {
          const angle = (s / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
          const dist = minReach + Math.random() * (maxReach - minReach);
          const x = hub.x + Math.cos(angle) * dist;
          const y = hub.y + Math.sin(angle) * dist;
          const channel = CHANNEL_KEYS[Math.floor(Math.random() * CHANNEL_KEYS.length)];
          sats.push({
            x,
            y,
            radius: 0.9 + Math.random() * 0.8,
            hubIndex: i,
            channel,
            // Each hub spreads its draws across a portion of the scroll range.
            // Stars start drawing earlier so they bloom first.
            drawAt: 0.05 + Math.random() * 0.85,
          });
        }
      });
      satellitesRef.current = sats;

      // Ecosystem links: connect all hubs together via a few cross-lines.
      // Use a "ring + a couple of chords" pattern for organic feel.
      const links: EcosystemLink[] = [];
      const order = hubs.map((_, i) => i);
      // Sort hubs by angle around centre for a natural ring
      const cx = width / 2;
      const cy = height / 2;
      order.sort((a, b) => {
        const aa = Math.atan2(hubs[a].y - cy, hubs[a].x - cx);
        const bb = Math.atan2(hubs[b].y - cy, hubs[b].x - cx);
        return aa - bb;
      });
      for (let i = 0; i < order.length; i++) {
        const from = order[i];
        const to = order[(i + 1) % order.length];
        links.push({
          fromHub: from,
          toHub: to,
          channel: CHANNEL_KEYS[i % CHANNEL_KEYS.length],
          drawAt: 0.55 + (i / order.length) * 0.35,
        });
      }
      // A few long chords for richness
      const chordCount = Math.max(2, Math.floor(hubs.length / 3));
      for (let k = 0; k < chordCount; k++) {
        const a = Math.floor(Math.random() * hubs.length);
        let b = Math.floor(Math.random() * hubs.length);
        if (b === a) b = (b + 1) % hubs.length;
        links.push({
          fromHub: a,
          toHub: b,
          channel: CHANNEL_KEYS[(k + 3) % CHANNEL_KEYS.length],
          drawAt: 0.7 + Math.random() * 0.25,
        });
      }
      ecosystemRef.current = links;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const updateScrollProgress = () => {
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height + vh;
      const scrolled = vh - rect.top;
      scrollProgressRef.current = Math.max(0, Math.min(1, scrolled / total));
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouseRef.current.x = x;
        mouseRef.current.y = y;
        mouseRef.current.active = true;
      } else {
        mouseRef.current.active = false;
      }
    };
    const onMouseOut = () => {
      mouseRef.current.active = false;
    };

    /**
     * Compute a 0..1 "draw amount" for an item given the current scroll progress.
     * Each item draws over a small window starting at its drawAt value.
     */
    const drawAmount = (drawAt: number, progress: number, window = 0.18) => {
      if (progress <= drawAt) return 0;
      if (progress >= drawAt + window) return 1;
      const t = (progress - drawAt) / window;
      // Smoothstep for nicer "drawing" easing
      return t * t * (3 - 2 * t);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const hubs = hubsRef.current;
      const sats = satellitesRef.current;
      const links = ecosystemRef.current;
      const progress = scrollProgressRef.current;
      const mouse = mouseRef.current;

      // Always show a small base reveal so it doesn't start completely empty
      const effectiveProgress = Math.max(progress, 0.08);

      // ---- Ecosystem lines (under everything else) ----
      for (const l of links) {
        const amt = drawAmount(l.drawAt, effectiveProgress, 0.22);
        if (amt <= 0) continue;
        const a = hubs[l.fromHub];
        const b = hubs[l.toHub];
        if (!a || !b) continue;
        const ex = a.x + (b.x - a.x) * amt;
        const ey = a.y + (b.y - a.y) * amt;
        // Cursor brighten
        let boost = 0;
        if (mouse.active) {
          const mx = (a.x + ex) / 2;
          const my = (a.y + ey) / 2;
          const md = Math.hypot(mouse.x - mx, mouse.y - my);
          if (md < 180) boost = (1 - md / 180) * 0.25;
        }
        ctx.strokeStyle = `rgba(${CHANNEL_COLORS[l.channel]}, ${(0.18 + boost).toFixed(3)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // ---- Hub-to-satellite connections ----
      for (const s of sats) {
        const amt = drawAmount(s.drawAt, effectiveProgress, 0.16);
        if (amt <= 0) continue;
        const hub = hubs[s.hubIndex];
        if (!hub) continue;
        const ex = hub.x + (s.x - hub.x) * amt;
        const ey = hub.y + (s.y - hub.y) * amt;

        // Cursor proximity glow
        let boost = 0;
        if (mouse.active) {
          const mx = (hub.x + ex) / 2;
          const my = (hub.y + ey) / 2;
          const md = Math.hypot(mouse.x - mx, mouse.y - my);
          if (md < 140) boost = (1 - md / 140) * 0.4;
        }

        const baseAlpha = 0.55;
        ctx.strokeStyle = `rgba(${CHANNEL_COLORS[s.channel]}, ${(baseAlpha + boost).toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Once mostly drawn, render the satellite endpoint dot in its channel colour
        if (amt > 0.85) {
          const dotAlpha = (amt - 0.85) / 0.15;
          ctx.fillStyle = `rgba(${CHANNEL_COLORS[s.channel]}, ${(0.95 * dotAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();
          // Soft halo
          ctx.fillStyle = `rgba(${CHANNEL_COLORS[s.channel]}, ${(0.18 * dotAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---- Hubs on top ----
      for (const h of hubs) {
        ctx.fillStyle = `rgba(${HUB_COLOR}, 0.18)`;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${HUB_COLOR}, 0.95)`;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    updateScrollProgress();
    rafRef.current = requestAnimationFrame(draw);

    const onScroll = () => updateScrollProgress();
    const onResize = () => resize();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseout", onMouseOut);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onMouseOut);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
