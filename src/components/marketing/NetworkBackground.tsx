import { useEffect, useRef } from "react";

/**
 * Business-presence "nebula" animation.
 *
 * - Many thin lines of varied colours form a soft, layered cloud.
 * - At any moment: ~70% of connections are already fully drawn (stable),
 *   the remaining ~30% are slowly extending toward their endpoint.
 * - When a line completes, after a brief pause it picks a NEW endpoint
 *   and starts retracting / re-extending, so the nebula is always alive.
 * - Scroll progress accelerates the formation rate (more lines bloom faster
 *   the further you scroll into the section).
 * - Cursor proximity gently brightens lines passing near it.
 */
type ChannelKey =
  | "google"
  | "social"
  | "reviews"
  | "citations"
  | "directory"
  | "maps"
  | "blog"
  | "ads"
  | "email"
  | "video";

const CHANNEL_COLORS: Record<ChannelKey, string> = {
  google: "234, 179, 8", // amber
  social: "168, 85, 247", // violet
  reviews: "34, 197, 94", // green
  citations: "14, 165, 233", // sky
  directory: "236, 72, 153", // pink
  maps: "239, 68, 68", // red
  blog: "20, 184, 166", // teal
  ads: "249, 115, 22", // orange
  email: "129, 140, 248", // indigo
  video: "244, 114, 182", // rose
};
const CHANNEL_KEYS = Object.keys(CHANNEL_COLORS) as ChannelKey[];

type Hub = {
  x: number;
  y: number;
  /** Original (un-magnetized) position, used to ease back when cursor leaves. */
  baseX: number;
  baseY: number;
  radius: number;
  optimization: number; // 0..1
  /** prospect = barely any presence, client = active customer, star = fully optimized. */
  tier: "prospect" | "client" | "star";
};

type Phase = "extending" | "stable" | "retracting" | "paused";

type Connection = {
  hubIndex: number;
  /** Endpoint as OFFSET from the hub centre (so it moves with the hub). */
  ox: number;
  oy: number;
  channel: ChannelKey;
  /** Line thickness. */
  width: number;
  /** Base alpha. */
  alpha: number;
  /** 0..1 progress along the line. */
  t: number;
  phase: Phase;
  /** Speed of extension/retraction in units/frame. Very slow. */
  speed: number;
  /** Frames until the next phase change (used in stable/paused). */
  hold: number;
};

type EcoLink = {
  fromHub: number;
  toHub: number;
  channel: ChannelKey;
  t: number;
  phase: Phase;
  width: number;
  speed: number;
  hold: number;
  alpha: number;
};

const HUB_COUNT = 270;
const HUB_COLOR = "255, 255, 255";

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hubsRef = useRef<Hub[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const ecoLinksRef = useRef<EcoLink[]>([]);
  const scrollProgressRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
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

    const randChannel = (): ChannelKey =>
      CHANNEL_KEYS[Math.floor(Math.random() * CHANNEL_KEYS.length)];

    /** Pick a fresh endpoint OFFSET around a hub. */
    const pickEndpoint = (hub: Hub) => {
      const minReach = 60;
      const maxReach = 140 + hub.optimization * 260;
      const angle = Math.random() * Math.PI * 2;
      const dist = minReach + Math.random() * (maxReach - minReach);
      return {
        ox: Math.cos(angle) * dist,
        oy: Math.sin(angle) * dist,
      };
    };

    const seed = () => {
      // ---- Hubs ----
      // Distribution:
      //   90% prospects (tiny, very faint, "far away" — barely visible specks)
      //   ~7% clients (medium hubs with several lines)
      //   ~3% stars (fully optimized — many long bright connections)
      // We scatter prospects randomly across the canvas (no grid, since there are many).
      // Clients and stars use a coarser grid so they remain spatially well-separated.
      const hubs: Hub[] = [];

      const starCount = Math.max(3, Math.round(HUB_COUNT * 0.03));
      const clientCount = Math.max(6, Math.round(HUB_COUNT * 0.07));
      const prospectCount = HUB_COUNT - starCount - clientCount;

      // Clients + stars on a grid for nice spread
      const featuredCount = starCount + clientCount;
      const cols = Math.ceil(Math.sqrt(featuredCount));
      const rows = Math.ceil(featuredCount / cols);
      const featured: { x: number; y: number; tier: "star" | "client" }[] = [];
      let placed = 0;
      // Decide which grid cells hold stars vs clients (interleaved randomly)
      const tiers: ("star" | "client")[] = [
        ...Array(starCount).fill("star"),
        ...Array(clientCount).fill("client"),
      ];
      // Fisher-Yates shuffle
      for (let i = tiers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiers[i], tiers[j]] = [tiers[j], tiers[i]];
      }
      for (let r = 0; r < rows; r++) {
        for (let cidx = 0; cidx < cols; cidx++) {
          if (placed >= featuredCount) break;
          const cellW = width / cols;
          const cellH = height / rows;
          const cx = cellW * (cidx + 0.5) + (Math.random() - 0.5) * cellW * 0.5;
          const cy = cellH * (r + 0.5) + (Math.random() - 0.5) * cellH * 0.5;
          featured.push({ x: cx, y: cy, tier: tiers[placed] });
          placed++;
        }
      }

      // Push featured hubs first
      for (const f of featured) {
        let optimization: number;
        let radius: number;
        if (f.tier === "star") {
          optimization = 0.85 + Math.random() * 0.15;
          radius = 3.2 + Math.random() * 1.5;
        } else {
          optimization = 0.4 + Math.random() * 0.3;
          radius = 1.8 + Math.random() * 1.0;
        }
        hubs.push({
          x: f.x,
          y: f.y,
          baseX: f.x,
          baseY: f.y,
          radius,
          optimization,
          tier: f.tier,
        });
      }

      // Prospects: scattered randomly, very tiny, very faint
      for (let p = 0; p < prospectCount; p++) {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        hubs.push({
          x: cx,
          y: cy,
          baseX: cx,
          baseY: cy,
          // Tiny — feels distant. 60% are sub-pixel-ish points.
          radius: 0.25 + Math.random() * 0.55,
          optimization: Math.random() * 0.08,
          tier: "prospect",
        });
      }
      hubsRef.current = hubs;

      // ---- Per-hub connections ----
      const conns: Connection[] = [];
      hubs.forEach((hub, i) => {
        let count: number;
        if (hub.tier === "prospect") {
          // Most prospects have NO lines at all (truly dormant)
          // ~12% have 1 faint short line
          const r = Math.random();
          count = r < 0.88 ? 0 : 1;
        } else if (hub.tier === "client") {
          count = Math.round(5 + hub.optimization * 12);
        } else {
          count = Math.round(18 + hub.optimization * 28);
        }
        for (let s = 0; s < count; s++) {
          const ep = pickEndpoint(hub);
          const startStable = Math.random() < 0.7;
          const thicknessRoll = Math.random();
          const lineWidth =
            thicknessRoll > 0.92
              ? 0.9
              : thicknessRoll > 0.7
                ? 0.55
                : 0.35;
          // Prospects' rare lines are extra faint
          const baseAlpha =
            hub.tier === "prospect"
              ? 0.08 + Math.random() * 0.07
              : 0.35 + Math.random() * 0.3;
          conns.push({
            hubIndex: i,
            ox: ep.ox,
            oy: ep.oy,
            channel: randChannel(),
            width: hub.tier === "prospect" ? 0.3 : lineWidth,
            alpha: baseAlpha,
            t: startStable ? 1 : Math.random() * 0.7,
            phase: startStable ? "stable" : "extending",
            speed: 0.0015 + Math.random() * 0.0025,
            hold: startStable ? 60 + Math.floor(Math.random() * 600) : 0,
          });
        }
      });
      connectionsRef.current = conns;

      // ---- Ecosystem links between hubs (only between non-prospects) ----
      const eco: EcoLink[] = [];
      const order = hubs
        .map((_, i) => i)
        .filter((i) => hubs[i].tier !== "prospect");
      const cx0 = width / 2;
      const cy0 = height / 2;
      order.sort((a, b) => {
        const aa = Math.atan2(hubs[a].y - cy0, hubs[a].x - cx0);
        const bb = Math.atan2(hubs[b].y - cy0, hubs[b].x - cx0);
        return aa - bb;
      });
      for (let i = 0; i < order.length; i++) {
        const startStable = Math.random() < 0.7;
        eco.push({
          fromHub: order[i],
          toHub: order[(i + 1) % order.length],
          channel: CHANNEL_KEYS[i % CHANNEL_KEYS.length],
          width: 0.5,
          alpha: 0.25,
          t: startStable ? 1 : Math.random() * 0.6,
          phase: startStable ? "stable" : "extending",
          speed: 0.001 + Math.random() * 0.0015,
          hold: startStable ? 100 + Math.floor(Math.random() * 600) : 0,
        });
      }
      // Some long chord crossings (between non-prospects)
      const candidates = hubs
        .map((_, i) => i)
        .filter((i) => hubs[i].tier !== "prospect");
      const chordCount = Math.max(3, Math.floor(candidates.length / 2));
      for (let k = 0; k < chordCount; k++) {
        if (candidates.length < 2) break;
        const a = candidates[Math.floor(Math.random() * candidates.length)];
        let b = candidates[Math.floor(Math.random() * candidates.length)];
        if (b === a) b = candidates[(candidates.indexOf(a) + 1) % candidates.length];
        const startStable = Math.random() < 0.6;
        eco.push({
          fromHub: a,
          toHub: b,
          channel: CHANNEL_KEYS[(k + 4) % CHANNEL_KEYS.length],
          width: 0.4,
          alpha: 0.2,
          t: startStable ? 1 : Math.random() * 0.5,
          phase: startStable ? "stable" : "extending",
          speed: 0.0008 + Math.random() * 0.0012,
          hold: startStable ? 100 + Math.floor(Math.random() * 600) : 0,
        });
      }
      ecoLinksRef.current = eco;
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

    /** Smooth easing for line drawing. */
    const ease = (t: number) => t * t * (3 - 2 * t);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const hubs = hubsRef.current;
      const conns = connectionsRef.current;
      const eco = ecoLinksRef.current;
      const progress = scrollProgressRef.current;
      const mouse = mouseRef.current;

      // Scroll multiplier on speed (faster animation as user scrolls deeper)
      const speedMul = 0.6 + progress * 1.8;

      // ---- Cursor magnetism: pull hubs toward cursor, ease back when away ----
      const MAG_RADIUS = 220;
      for (const h of hubs) {
        let tx = h.baseX;
        let ty = h.baseY;
        if (mouse.active) {
          const dx = mouse.x - h.baseX;
          const dy = mouse.y - h.baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAG_RADIUS && dist > 0.001) {
            // Smaller hubs (prospects) react more (lighter mass), stars are heavier
            const mass = h.tier === "prospect" ? 0.4 : h.tier === "client" ? 0.7 : 1.1;
            const pull = ((1 - dist / MAG_RADIUS) * 50) / mass;
            tx = h.baseX + (dx / dist) * pull;
            ty = h.baseY + (dy / dist) * pull;
          }
        }
        h.x += (tx - h.x) * 0.08;
        h.y += (ty - h.y) * 0.08;
      }

      // ---- Eco links (under) ----
      for (const l of eco) {
        // Phase machine
        if (l.phase === "extending") {
          l.t += l.speed * speedMul;
          if (l.t >= 1) {
            l.t = 1;
            l.phase = "stable";
            l.hold = 240 + Math.floor(Math.random() * 600);
          }
        } else if (l.phase === "stable") {
          l.hold -= 1;
          if (l.hold <= 0) {
            l.phase = "retracting";
          }
        } else if (l.phase === "retracting") {
          l.t -= l.speed * speedMul * 1.2;
          if (l.t <= 0) {
            l.t = 0;
            l.phase = "paused";
            l.hold = 30 + Math.floor(Math.random() * 120);
          }
        } else {
          // paused
          l.hold -= 1;
          if (l.hold <= 0) {
            // Maybe re-route to a different hub for organic re-wiring
            if (Math.random() < 0.4) {
              let nb = Math.floor(Math.random() * hubs.length);
              if (nb === l.fromHub) nb = (nb + 1) % hubs.length;
              l.toHub = nb;
              l.channel = randChannel();
            }
            l.phase = "extending";
          }
        }

        if (l.t <= 0) continue;
        const a = hubs[l.fromHub];
        const b = hubs[l.toHub];
        if (!a || !b) continue;
        const drawT = ease(l.t);
        const ex = a.x + (b.x - a.x) * drawT;
        const ey = a.y + (b.y - a.y) * drawT;

        let boost = 0;
        if (mouse.active) {
          const md = Math.hypot(mouse.x - (a.x + ex) / 2, mouse.y - (a.y + ey) / 2);
          if (md < 180) boost = (1 - md / 180) * 0.25;
        }
        ctx.strokeStyle = `rgba(${CHANNEL_COLORS[l.channel]}, ${(l.alpha + boost).toFixed(3)})`;
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // ---- Hub-to-satellite connections (the bulk of the nebula) ----
      for (const c of conns) {
        const hub = hubs[c.hubIndex];
        if (!hub) continue;

        // Phase machine
        if (c.phase === "extending") {
          c.t += c.speed * speedMul;
          if (c.t >= 1) {
            c.t = 1;
            c.phase = "stable";
            c.hold = 180 + Math.floor(Math.random() * 800);
          }
        } else if (c.phase === "stable") {
          c.hold -= 1;
          if (c.hold <= 0) {
            c.phase = "retracting";
          }
        } else if (c.phase === "retracting") {
          c.t -= c.speed * speedMul * 1.2;
          if (c.t <= 0) {
            c.t = 0;
            c.phase = "paused";
            c.hold = 20 + Math.floor(Math.random() * 100);
          }
        } else {
          c.hold -= 1;
          if (c.hold <= 0) {
            // Re-aim: new endpoint, sometimes new channel
            const ep = pickEndpoint(hub);
            c.ox = ep.ox;
            c.oy = ep.oy;
            if (Math.random() < 0.3) c.channel = randChannel();
            c.phase = "extending";
          }
        }

        if (c.t <= 0) continue;
        const drawT = ease(c.t);
        // Endpoint travels with the hub (offset stays fixed relative to hub)
        const endX = hub.x + c.ox;
        const endY = hub.y + c.oy;
        const ex = hub.x + (endX - hub.x) * drawT;
        const ey = hub.y + (endY - hub.y) * drawT;

        let boost = 0;
        if (mouse.active) {
          const md = Math.hypot(mouse.x - (hub.x + ex) / 2, mouse.y - (hub.y + ey) / 2);
          if (md < 130) boost = (1 - md / 130) * 0.4;
        }

        ctx.strokeStyle = `rgba(${CHANNEL_COLORS[c.channel]}, ${(c.alpha + boost).toFixed(3)})`;
        ctx.lineWidth = c.width;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Endpoint dot once line is at full reach
        if (c.t > 0.95 && c.phase !== "retracting") {
          const dotAlpha = (c.t - 0.95) / 0.05;
          ctx.fillStyle = `rgba(${CHANNEL_COLORS[c.channel]}, ${(0.85 * dotAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(endX, endY, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---- Hubs on top ----
      for (const h of hubs) {
        if (h.tier === "prospect") {
          // Very faint, distant — no halo, just a tiny dim speck
          ctx.fillStyle = `rgba(${HUB_COLOR}, 0.22)`;
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const haloMul = h.tier === "star" ? 5 : 4;
        const haloAlpha = h.tier === "star" ? 0.22 : 0.18;
        ctx.fillStyle = `rgba(${HUB_COLOR}, ${haloAlpha})`;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * haloMul, 0, Math.PI * 2);
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
