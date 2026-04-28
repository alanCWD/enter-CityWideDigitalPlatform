import { useEffect, useRef } from "react";

/**
 * Business-presence network animation.
 *
 * Metaphor:
 *  - "Hub" nodes = businesses. Some are dense (managed by CityWide), some sparse.
 *  - Smaller satellite nodes = Google, social, citations, reviews orbiting each hub.
 *  - Pulses constantly travel along connections to suggest live data sync.
 *  - Cursor attracts nearby nodes and strengthens any line passing under it.
 *  - Scroll progressively activates more service connections per hub.
 */
type Node = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  isHub: boolean;
  /** For hubs: how many satellites it WILL eventually connect to (density). */
  capacity: number;
  /** For satellites: which hub they belong to. */
  hubIndex: number;
  /** Phase offset for organic orbit motion. */
  phase: number;
  visibility: number;
  appearAt: number;
};

type Pulse = {
  fromIndex: number;
  toIndex: number;
  /** 0..1 progress along the edge. */
  t: number;
  speed: number;
};

const HUB_COUNT = 7;
const SATELLITES_PER_HUB_MAX = 9; // capacity ceiling
const NODE_COLOR = "91, 184, 255"; // light blue rgb
const HUB_COLOR = "255, 255, 255";
const PULSE_COLOR = "180, 220, 255";

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const scrollProgressRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    const seedNodes = () => {
      const nodes: Node[] = [];
      // Place hubs spread across the canvas (with some randomness so it feels organic)
      const cols = Math.ceil(Math.sqrt(HUB_COUNT));
      const rows = Math.ceil(HUB_COUNT / cols);
      let placed = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (placed >= HUB_COUNT) break;
          const cellW = width / cols;
          const cellH = height / rows;
          const cx = cellW * (c + 0.5) + (Math.random() - 0.5) * cellW * 0.4;
          const cy = cellH * (r + 0.5) + (Math.random() - 0.5) * cellH * 0.4;
          // Some hubs are "rich" (many connections), others sparse.
          const richness = Math.random();
          const capacity =
            richness > 0.55
              ? Math.floor(SATELLITES_PER_HUB_MAX * (0.7 + Math.random() * 0.3))
              : Math.floor(SATELLITES_PER_HUB_MAX * (0.15 + Math.random() * 0.25));
          nodes.push({
            x: cx,
            y: cy,
            baseX: cx,
            baseY: cy,
            vx: 0,
            vy: 0,
            radius: 2.2 + Math.random() * 1.2,
            isHub: true,
            capacity,
            hubIndex: -1,
            phase: Math.random() * Math.PI * 2,
            visibility: 1,
            appearAt: 0,
          });
          placed++;
        }
      }

      // Add satellites for each hub, distributed in a ring around it
      const hubCount = nodes.length;
      for (let h = 0; h < hubCount; h++) {
        const hub = nodes[h];
        const sats = SATELLITES_PER_HUB_MAX; // we always allocate max; capacity gates how many activate
        for (let s = 0; s < sats; s++) {
          const angle = (s / sats) * Math.PI * 2 + Math.random() * 0.3;
          const radius = 70 + Math.random() * 110;
          const x = hub.x + Math.cos(angle) * radius;
          const y = hub.y + Math.sin(angle) * radius;
          nodes.push({
            x,
            y,
            baseX: x,
            baseY: y,
            vx: 0,
            vy: 0,
            radius: 1.1 + Math.random() * 0.9,
            isHub: false,
            capacity: 0,
            hubIndex: h,
            phase: Math.random() * Math.PI * 2,
            visibility: 0,
            // Satellites within a hub's capacity reveal earlier than overflow ones.
            appearAt: s < hub.capacity ? s / hub.capacity : 1.2,
          });
        }
      }
      nodesRef.current = nodes;
      pulsesRef.current = [];
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
      seedNodes();
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
      // Only consider cursor "active" when it's actually over the hero area
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouseRef.current.x = x;
        mouseRef.current.y = y;
        mouseRef.current.active = true;
      } else {
        mouseRef.current.active = false;
      }
    };
    const onMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    /** Spawn occasional pulses on active hub-satellite edges. */
    const maybeSpawnPulse = () => {
      const nodes = nodesRef.current;
      // Spawn rate scales with how many connections are active
      if (Math.random() > 0.18) return;
      // Pick a random satellite that is visible and within its hub's capacity
      const candidates: number[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n.isHub && n.visibility > 0.6) candidates.push(i);
      }
      if (candidates.length === 0) return;
      const satIdx = candidates[Math.floor(Math.random() * candidates.length)];
      const sat = nodes[satIdx];
      // Pulse direction alternates randomly (sync upstream / downstream)
      const goingIn = Math.random() > 0.5;
      pulsesRef.current.push({
        fromIndex: goingIn ? satIdx : sat.hubIndex,
        toIndex: goingIn ? sat.hubIndex : satIdx,
        t: 0,
        speed: 0.006 + Math.random() * 0.008,
      });
    };

    const draw = () => {
      tickRef.current += 1;
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const progress = scrollProgressRef.current;
      const mouse = mouseRef.current;
      // Reveal threshold: a base + scroll progress
      const revealThreshold = 0.2 + progress * 1.0;

      // Update node positions (gentle orbit + cursor magnetism)
      for (const n of nodes) {
        // Organic sway around base position
        const sway = n.isHub ? 6 : 10;
        const speed = n.isHub ? 0.0015 : 0.003;
        n.phase += speed;
        let targetX = n.baseX + Math.cos(n.phase) * sway;
        let targetY = n.baseY + Math.sin(n.phase * 1.3) * sway;

        // Cursor magnetism: nodes within range get gently pulled toward cursor
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radius = 180;
          if (dist < radius && dist > 0) {
            const pull = (1 - dist / radius) * (n.isHub ? 18 : 28);
            targetX += (dx / dist) * pull;
            targetY += (dy / dist) * pull;
          }
        }

        // Ease toward target
        n.x += (targetX - n.x) * 0.06;
        n.y += (targetY - n.y) * 0.06;

        // Visibility easing
        const target = n.appearAt <= revealThreshold ? 1 : 0;
        n.visibility += (target - n.visibility) * 0.05;
      }

      // Spawn pulses occasionally
      maybeSpawnPulse();

      // ---- Draw connections (hub -> satellite within capacity) ----
      for (let i = 0; i < nodes.length; i++) {
        const sat = nodes[i];
        if (sat.isHub) continue;
        const hub = nodes[sat.hubIndex];
        if (!hub) continue;
        const visMul = sat.visibility * hub.visibility;
        if (visMul < 0.05) continue;

        // Cursor proximity boosts a line if it passes near the cursor
        let cursorBoost = 0;
        if (mouse.active) {
          const midX = (sat.x + hub.x) / 2;
          const midY = (sat.y + hub.y) / 2;
          const ddx = mouse.x - midX;
          const ddy = mouse.y - midY;
          const md = Math.sqrt(ddx * ddx + ddy * ddy);
          if (md < 140) cursorBoost = (1 - md / 140) * 0.4;
        }

        const alpha = (0.18 + cursorBoost) * visMul;
        ctx.strokeStyle = `rgba(${NODE_COLOR}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(sat.x, sat.y);
        ctx.stroke();
      }

      // ---- Draw inter-hub connections (sparser, longer lines) ----
      const hubs: number[] = [];
      for (let i = 0; i < nodes.length; i++) if (nodes[i].isHub) hubs.push(i);
      for (let i = 0; i < hubs.length; i++) {
        const a = nodes[hubs[i]];
        for (let j = i + 1; j < hubs.length; j++) {
          const b = nodes[hubs[j]];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 320;
          if (dist > maxDist) continue;
          const strength = 1 - dist / maxDist;
          const alpha = strength * 0.12 * (0.4 + progress * 0.6);
          ctx.strokeStyle = `rgba(${NODE_COLOR}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // ---- Update + draw pulses ----
      const remainingPulses: Pulse[] = [];
      for (const p of pulsesRef.current) {
        p.t += p.speed;
        if (p.t >= 1) continue;
        const from = nodes[p.fromIndex];
        const to = nodes[p.toIndex];
        if (!from || !to) continue;
        const x = from.x + (to.x - from.x) * p.t;
        const y = from.y + (to.y - from.y) * p.t;
        const fade = Math.sin(p.t * Math.PI); // fade in/out
        ctx.fillStyle = `rgba(${PULSE_COLOR}, ${(0.9 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        // soft halo
        ctx.fillStyle = `rgba(${PULSE_COLOR}, ${(0.25 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        remainingPulses.push(p);
      }
      pulsesRef.current = remainingPulses;

      // ---- Draw nodes on top ----
      for (const n of nodes) {
        if (n.visibility < 0.02) continue;
        const baseColor = n.isHub ? HUB_COLOR : NODE_COLOR;
        // Glow halo
        ctx.fillStyle = `rgba(${baseColor}, ${(0.2 * n.visibility).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * (n.isHub ? 4 : 3), 0, Math.PI * 2);
        ctx.fill();
        // Core
        ctx.fillStyle = `rgba(${baseColor}, ${(0.95 * n.visibility).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();

        // Hubs get a subtle slow ring pulse
        if (n.isHub) {
          const ring = (Math.sin(tickRef.current * 0.02 + n.phase) + 1) / 2;
          ctx.strokeStyle = `rgba(${baseColor}, ${(0.15 * n.visibility * ring).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * (5 + ring * 4), 0, Math.PI * 2);
          ctx.stroke();
        }
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
    window.addEventListener("mouseout", onMouseLeave);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onMouseLeave);
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
