import { useEffect, useRef } from "react";

/**
 * Business-presence "nebula" animation.
 *
 * Now rendered in pseudo-3D:
 *  - Every hub has a fixed (x, y, z) position in space — they NEVER move
 *    (businesses are like stars).
 *  - The camera (viewing angle) rotates around the nebula based on:
 *      * scroll progress  -> tilts up/down (X-axis rotation)
 *      * cursor X         -> spins left/right (Y-axis rotation)
 *      * cursor Y         -> additional tilt (X-axis nudge)
 *  - This lets the user see the same nebula from different angles.
 *  - Lines still extend / retract / re-route over time (the "alive" feel).
 *  - Cursor proximity gently brightens lines passing near the cursor in
 *    screen space.
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
  google: "234, 179, 8",
  social: "168, 85, 247",
  reviews: "34, 197, 94",
  citations: "14, 165, 233",
  directory: "236, 72, 153",
  maps: "239, 68, 68",
  blog: "20, 184, 166",
  ads: "249, 115, 22",
  email: "129, 140, 248",
  video: "244, 114, 182",
};
const CHANNEL_KEYS = Object.keys(CHANNEL_COLORS) as ChannelKey[];

type Hub = {
  /** Fixed world-space position (centred around origin). */
  x: number;
  y: number;
  z: number;
  radius: number;
  optimization: number;
  tier: "prospect" | "client" | "star";
};

type Phase = "extending" | "stable" | "retracting" | "paused";

type Connection = {
  hubIndex: number;
  /** Endpoint offset in 3D from the hub centre. */
  ox: number;
  oy: number;
  oz: number;
  channel: ChannelKey;
  width: number;
  alpha: number;
  t: number;
  phase: Phase;
  speed: number;
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

const HUB_COUNT = 2700;
const HUB_COLOR = "255, 255, 255";

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hubsRef = useRef<Hub[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const ecoLinksRef = useRef<EcoLink[]>([]);
  const scrollProgressRef = useRef(0);
  /** Normalised cursor position (-1..1) relative to viewport centre. */
  const cursorRef = useRef({ nx: 0, ny: 0, sx: -9999, sy: -9999, active: false });
  /** Smoothed camera angles. */
  const camRef = useRef({ rotX: 0, rotY: 0 });
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
    /** Z distance from camera to nebula centre — affects perspective strength. */
    const CAMERA_DIST = 900;
    /** Half-extents of world space (cube the hubs live in). */
    let worldW = 0;
    let worldH = 0;
    const worldD = 320; // depth half-extent

    const randChannel = (): ChannelKey =>
      CHANNEL_KEYS[Math.floor(Math.random() * CHANNEL_KEYS.length)];

    /** Pick a fresh endpoint OFFSET around a hub, in 3D. */
    const pickEndpoint = (hub: Hub) => {
      const minReach = 60;
      const maxReach = 140 + hub.optimization * 260;
      // Random direction on a sphere
      const u = Math.random() * 2 - 1; // cos(theta)
      const phi = Math.random() * Math.PI * 2;
      const r = minReach + Math.random() * (maxReach - minReach);
      const sinTheta = Math.sqrt(1 - u * u);
      return {
        ox: r * sinTheta * Math.cos(phi),
        oy: r * sinTheta * Math.sin(phi),
        oz: r * u * 0.6, // slightly flattened so the nebula reads as a disc
      };
    };

    const seed = () => {
      worldW = width / 2;
      worldH = height / 2;
      const hubs: Hub[] = [];

      const starCount = Math.max(3, Math.round(HUB_COUNT * 0.03));
      const clientCount = Math.max(6, Math.round(HUB_COUNT * 0.07));
      const prospectCount = HUB_COUNT - starCount - clientCount;

      // Featured hubs: spread on a coarse 3D-ish grid (random z)
      const featuredCount = starCount + clientCount;
      const cols = Math.ceil(Math.sqrt(featuredCount));
      const rows = Math.ceil(featuredCount / cols);
      const tiers: ("star" | "client")[] = [
        ...Array(starCount).fill("star"),
        ...Array(clientCount).fill("client"),
      ];
      for (let i = tiers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiers[i], tiers[j]] = [tiers[j], tiers[i]];
      }
      let placed = 0;
      for (let r = 0; r < rows; r++) {
        for (let cidx = 0; cidx < cols; cidx++) {
          if (placed >= featuredCount) break;
          const cellW = width / cols;
          const cellH = height / rows;
          const cx = cellW * (cidx + 0.5) - worldW + (Math.random() - 0.5) * cellW * 0.5;
          const cy = cellH * (r + 0.5) - worldH + (Math.random() - 0.5) * cellH * 0.5;
          const cz = (Math.random() * 2 - 1) * worldD * 0.6;
          const tier = tiers[placed];
          let optimization: number;
          let radius: number;
          if (tier === "star") {
            optimization = 0.85 + Math.random() * 0.15;
            radius = 3.2 + Math.random() * 1.5;
          } else {
            optimization = 0.4 + Math.random() * 0.3;
            radius = 1.8 + Math.random() * 1.0;
          }
          hubs.push({ x: cx, y: cy, z: cz, radius, optimization, tier });
          placed++;
        }
      }

      // Prospects: scattered randomly through the whole 3D volume
      for (let p = 0; p < prospectCount; p++) {
        const cx = (Math.random() - 0.5) * width * 1.4;
        const cy = (Math.random() - 0.5) * height * 1.4;
        const cz = (Math.random() * 2 - 1) * worldD * 1.4;
        hubs.push({
          x: cx,
          y: cy,
          z: cz,
          // Very tiny — true nebula dust
          radius: 0.18 + Math.random() * 0.45,
          optimization: Math.random() * 0.05,
          tier: "prospect",
        });
      }
      hubsRef.current = hubs;

      // ---- Per-hub connections ----
      const conns: Connection[] = [];
      hubs.forEach((hub, i) => {
        let count: number;
        if (hub.tier === "prospect") {
          // Vast majority truly dormant — only ~2% have a single faint line
          count = Math.random() < 0.98 ? 0 : 1;
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
            thicknessRoll > 0.92 ? 0.9 : thicknessRoll > 0.7 ? 0.55 : 0.35;
          const baseAlpha =
            hub.tier === "prospect"
              ? 0.08 + Math.random() * 0.07
              : 0.35 + Math.random() * 0.3;
          conns.push({
            hubIndex: i,
            ox: ep.ox,
            oy: ep.oy,
            oz: ep.oz,
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

      // ---- Ecosystem links (only between non-prospects) ----
      const eco: EcoLink[] = [];
      const order = hubs.map((_, i) => i).filter((i) => hubs[i].tier !== "prospect");
      order.sort((a, b) => Math.atan2(hubs[a].y, hubs[a].x) - Math.atan2(hubs[b].y, hubs[b].x));
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
      const candidates = order.slice();
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
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // Track even when off the hero, but mark inactive for proximity boost
      cursorRef.current.sx = sx;
      cursorRef.current.sy = sy;
      // Normalised based on viewport so it works anywhere on the page
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      cursorRef.current.nx = (e.clientX / vw) * 2 - 1; // -1..1
      cursorRef.current.ny = (e.clientY / vh) * 2 - 1;
      cursorRef.current.active = sx >= 0 && sx <= rect.width && sy >= 0 && sy <= rect.height;
    };
    const onMouseOut = () => {
      cursorRef.current.active = false;
    };

    const ease = (t: number) => t * t * (3 - 2 * t);

    /**
     * Project a 3D point to screen space using the current camera angles.
     * Returns null if behind the camera.
     */
    const project = (
      x: number,
      y: number,
      z: number,
      sinX: number,
      cosX: number,
      sinY: number,
      cosY: number,
    ): { sx: number; sy: number; scale: number } | null => {
      // Rotate around Y axis (left/right pan)
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      // Rotate around X axis (up/down tilt)
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      // Perspective project
      const camZ = CAMERA_DIST + z2;
      if (camZ <= 1) return null;
      const scale = CAMERA_DIST / camZ;
      return {
        sx: x1 * scale + width / 2,
        sy: y2 * scale + height / 2,
        scale,
      };
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const hubs = hubsRef.current;
      const conns = connectionsRef.current;
      const eco = ecoLinksRef.current;
      const progress = scrollProgressRef.current;
      const cursor = cursorRef.current;

      // ---- Update camera angles (smoothed) ----
      // Target rotation:
      //   rotY (yaw)   <- cursor X (-0.6..0.6 rad) + slow autorotate via scroll
      //   rotX (pitch) <- scroll progress (-0.4..0.4) + cursor Y nudge
      const targetRotY = cursor.nx * 0.55 + (progress - 0.5) * 0.4;
      const targetRotX = (progress - 0.5) * 0.7 + cursor.ny * 0.25;
      camRef.current.rotX += (targetRotX - camRef.current.rotX) * 0.05;
      camRef.current.rotY += (targetRotY - camRef.current.rotY) * 0.05;
      const rotX = camRef.current.rotX;
      const rotY = camRef.current.rotY;
      const sinX = Math.sin(rotX);
      const cosX = Math.cos(rotX);
      const sinY = Math.sin(rotY);
      const cosY = Math.cos(rotY);

      // Scroll multiplier on line-formation speed
      const speedMul = 0.7 + progress * 1.5;

      // Pre-project hubs once for this frame
      const hubProj: (ReturnType<typeof project> | null)[] = hubs.map((h) =>
        project(h.x, h.y, h.z, sinX, cosX, sinY, cosY),
      );

      // ---- Eco links ----
      for (const l of eco) {
        if (l.phase === "extending") {
          l.t += l.speed * speedMul;
          if (l.t >= 1) {
            l.t = 1;
            l.phase = "stable";
            l.hold = 240 + Math.floor(Math.random() * 600);
          }
        } else if (l.phase === "stable") {
          l.hold -= 1;
          if (l.hold <= 0) l.phase = "retracting";
        } else if (l.phase === "retracting") {
          l.t -= l.speed * speedMul * 1.2;
          if (l.t <= 0) {
            l.t = 0;
            l.phase = "paused";
            l.hold = 30 + Math.floor(Math.random() * 120);
          }
        } else {
          l.hold -= 1;
          if (l.hold <= 0) {
            if (Math.random() < 0.4) {
              const nonProspects = hubs
                .map((_, i) => i)
                .filter((i) => hubs[i].tier !== "prospect" && i !== l.fromHub);
              if (nonProspects.length > 0) {
                l.toHub = nonProspects[Math.floor(Math.random() * nonProspects.length)];
                l.channel = randChannel();
              }
            }
            l.phase = "extending";
          }
        }

        if (l.t <= 0) continue;
        const a = hubProj[l.fromHub];
        const b = hubProj[l.toHub];
        if (!a || !b) continue;
        const drawT = ease(l.t);
        const ex = a.sx + (b.sx - a.sx) * drawT;
        const ey = a.sy + (b.sy - a.sy) * drawT;

        let boost = 0;
        if (cursor.active) {
          const md = Math.hypot(cursor.sx - (a.sx + ex) / 2, cursor.sy - (a.sy + ey) / 2);
          if (md < 180) boost = (1 - md / 180) * 0.25;
        }
        ctx.strokeStyle = `rgba(${CHANNEL_COLORS[l.channel]}, ${(l.alpha + boost).toFixed(3)})`;
        ctx.lineWidth = l.width;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // ---- Hub-to-satellite connections ----
      for (const c of conns) {
        const hub = hubs[c.hubIndex];
        if (!hub) continue;

        if (c.phase === "extending") {
          c.t += c.speed * speedMul;
          if (c.t >= 1) {
            c.t = 1;
            c.phase = "stable";
            c.hold = 180 + Math.floor(Math.random() * 800);
          }
        } else if (c.phase === "stable") {
          c.hold -= 1;
          if (c.hold <= 0) c.phase = "retracting";
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
            const ep = pickEndpoint(hub);
            c.ox = ep.ox;
            c.oy = ep.oy;
            c.oz = ep.oz;
            if (Math.random() < 0.3) c.channel = randChannel();
            c.phase = "extending";
          }
        }

        if (c.t <= 0) continue;
        const hp = hubProj[c.hubIndex];
        if (!hp) continue;
        const ep = project(
          hub.x + c.ox,
          hub.y + c.oy,
          hub.z + c.oz,
          sinX,
          cosX,
          sinY,
          cosY,
        );
        if (!ep) continue;
        const drawT = ease(c.t);
        const ex = hp.sx + (ep.sx - hp.sx) * drawT;
        const ey = hp.sy + (ep.sy - hp.sy) * drawT;

        let boost = 0;
        if (cursor.active) {
          const md = Math.hypot(cursor.sx - (hp.sx + ex) / 2, cursor.sy - (hp.sy + ey) / 2);
          if (md < 130) boost = (1 - md / 130) * 0.4;
        }

        ctx.strokeStyle = `rgba(${CHANNEL_COLORS[c.channel]}, ${(c.alpha + boost).toFixed(3)})`;
        ctx.lineWidth = c.width;
        ctx.beginPath();
        ctx.moveTo(hp.sx, hp.sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        if (c.t > 0.95 && c.phase !== "retracting") {
          const dotAlpha = (c.t - 0.95) / 0.05;
          ctx.fillStyle = `rgba(${CHANNEL_COLORS[c.channel]}, ${(0.85 * dotAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(ep.sx, ep.sy, 1.1 * Math.max(0.5, ep.scale), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---- Hubs on top ----
      for (let i = 0; i < hubs.length; i++) {
        const h = hubs[i];
        const hp = hubProj[i];
        if (!hp) continue;
        const r = h.radius * hp.scale;
        if (h.tier === "prospect") {
          // Depth-shaded faint dust. Closer particles brighter, distant ones near-invisible.
          const depthFade = Math.min(1, Math.max(0.15, hp.scale));
          const a = 0.09 * depthFade + Math.random() * 0.02;
          ctx.fillStyle = `rgba(${HUB_COLOR}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(hp.sx, hp.sy, Math.max(0.25, r), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const haloMul = h.tier === "star" ? 5 : 4;
        const haloAlpha = h.tier === "star" ? 0.22 : 0.18;
        ctx.fillStyle = `rgba(${HUB_COLOR}, ${haloAlpha})`;
        ctx.beginPath();
        ctx.arc(hp.sx, hp.sy, r * haloMul, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${HUB_COLOR}, 0.95)`;
        ctx.beginPath();
        ctx.arc(hp.sx, hp.sy, r, 0, Math.PI * 2);
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
