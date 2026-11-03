import { useEffect, useRef } from "react";

/**
 * Data-point constellation that floats over the orbit view.
 *
 * Screen-space (not tied to the photo), so it reads as live activity above the
 * planet: clusters of nodes whose connections extend, hold, retract and re-route
 * on their own. No scroll or pointer input is needed.
 */

const CHANNEL_COLORS = [
  "234, 179, 8",
  "168, 85, 247",
  "34, 197, 94",
  "56, 189, 248",
  "236, 72, 153",
  "248, 113, 113",
  "45, 212, 191",
  "249, 115, 22",
  "129, 140, 248",
];

type Phase = "extending" | "stable" | "retracting" | "paused";

interface Node {
  x: number;
  y: number;
  r: number;
  drift: number;
  speed: number;
  offset: number;
  tier: 0 | 1 | 2;
}

interface Edge {
  a: number;
  b: number;
  color: string;
  t: number;
  phase: Phase;
  hold: number;
  speed: number;
  width: number;
}

export function SkyNetwork({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let raf = 0;
    let disposed = false;
    let last = performance.now();
    let inView = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isMobile = () => width < 700;

    const seed = () => {
      const count = isMobile() ? 28 : 62;
      const clusterCount = isMobile() ? 3 : 5;
      const clusters = Array.from({ length: clusterCount }, () => ({
        x: width * (0.08 + Math.random() * 0.58),
        y: height * (0.24 + Math.random() * 0.52),
        spread: Math.min(width, height) * (0.09 + Math.random() * 0.14),
      }));

      nodes = Array.from({ length: count }, () => {
        const c = clusters[Math.floor(Math.random() * clusters.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.pow(Math.random(), 0.7) * c.spread;
        const roll = Math.random();
        return {
          x: c.x + Math.cos(angle) * dist,
          y: c.y + Math.sin(angle) * dist * 0.8,
          r: roll > 0.9 ? 2.1 : roll > 0.65 ? 1.4 : 0.9,
          drift: 6 + Math.random() * 12,
          speed: 0.0002 + Math.random() * 0.0004,
          offset: Math.random() * Math.PI * 2,
          tier: roll > 0.9 ? 0 : roll > 0.65 ? 1 : 2,
        };
      });

      edges = [];
      for (let i = 0; i < nodes.length; i++) {
        let best = -1;
        let bestDist = Infinity;
        for (let c = 0; c < 5; c++) {
          const j = Math.floor(Math.random() * nodes.length);
          if (j === i) continue;
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < bestDist) {
            bestDist = d;
            best = j;
          }
        }
        if (best === -1 || bestDist > Math.min(width, height) * 0.34) continue;
        const stable = Math.random() < 0.55;
        edges.push({
          a: i,
          b: best,
          color: CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)],
          t: stable ? 1 : Math.random() * 0.5,
          phase: stable ? "stable" : "extending",
          hold: stable ? 200 + Math.random() * 900 : 0,
          speed: 0.0025 + Math.random() * 0.004,
          width: 0.5 + Math.random() * 0.45,
        });
      }
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const nodePos = (n: Node, time: number) => {
      if (reduce) return { x: n.x, y: n.y };
      return {
        x: n.x + Math.sin(time * n.speed + n.offset) * n.drift,
        y: n.y + Math.cos(time * n.speed * 0.8 + n.offset) * n.drift * 0.6,
      };
    };

    const draw = (time: number, dt: number) => {
      ctx.clearRect(0, 0, width, height);

      for (const edge of edges) {
        if (!reduce) {
          if (edge.phase === "extending") {
            edge.t += edge.speed * (dt / 16.7);
            if (edge.t >= 1) {
              edge.t = 1;
              edge.phase = "stable";
              edge.hold = 150 + Math.random() * 700;
            }
          } else if (edge.phase === "stable") {
            edge.hold -= dt / 16.7;
            if (edge.hold <= 0) edge.phase = "retracting";
          } else if (edge.phase === "retracting") {
            edge.t -= edge.speed * 1.2 * (dt / 16.7);
            if (edge.t <= 0) {
              edge.t = 0;
              edge.phase = "paused";
              edge.hold = 30 + Math.random() * 120;
            }
          } else {
            edge.hold -= dt / 16.7;
            if (edge.hold <= 0) {
              let j = Math.floor(Math.random() * nodes.length);
              if (j === edge.a) j = (j + 1) % nodes.length;
              edge.b = j;
              edge.color = CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)];
              edge.phase = "extending";
            }
          }
        }

        if (edge.t <= 0.02) continue;
        const a = nodePos(nodes[edge.a], time);
        const b = nodePos(nodes[edge.b], time);
        const ex = a.x + (b.x - a.x) * edge.t;
        const ey = a.y + (b.y - a.y) * edge.t;

        ctx.strokeStyle = `rgba(${edge.color}, ${0.16 + edge.t * 0.28})`;
        ctx.lineWidth = edge.width;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        if (edge.t > 0.9) {
          const fade = (edge.t - 0.9) / 0.1;
          ctx.fillStyle = `rgba(${edge.color}, ${(0.7 * fade).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(ex, ey, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const n of nodes) {
        const p = nodePos(n, time);
        const twinkle = reduce ? 1 : 0.75 + Math.sin(time * 0.0013 + n.offset) * 0.25;
        if (n.tier < 2) {
          ctx.fillStyle = `rgba(158, 193, 255, ${0.07 * twinkle})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, n.r * 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(226, 238, 255, ${(0.5 + n.tier * 0.12) * twinkle})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      if (disposed) return;
      const dt = Math.min(64, now - last);
      last = now;
      if (inView) draw(now, dt);
      raf = requestAnimationFrame(loop);
    };

    resize();
    if (reduce) {
      draw(performance.now(), 0);
    } else {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(performance.now(), 0);
    });
    ro.observe(wrap);

    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
    });
    io.observe(wrap);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
