import { useEffect, useRef } from "react";

/**
 * Scroll-driven network animation.
 * - Nodes drift very slowly across the canvas (organic motion).
 * - As the user scrolls, more nodes "activate" (fade in) and form
 *   thin connecting lines with their nearest neighbors.
 * - Renders inside its parent (which must be `position: relative`).
 */
interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Order in which this node appears as the user scrolls (0..1). */
  appearAt: number;
  /** Smoothed visibility 0..1, eased toward target. */
  visibility: number;
}

const NODE_COUNT = 70;
const CONNECT_DISTANCE = 160; // px - max distance for a line to be drawn
const DRIFT_SPEED = 0.08; // very slow drift
const NODE_COLOR = "rgba(91, 184, 255, 0.9)"; // light blue accent
const LINE_COLOR = "120, 180, 255"; // rgb base for line stroke (alpha set per-line)

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const scrollProgressRef = useRef(0); // 0..1
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
      // Re-seed nodes if they don't exist yet, otherwise just clamp.
      if (nodesRef.current.length === 0) {
        nodesRef.current = Array.from({ length: NODE_COUNT }, (_, i) => ({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * DRIFT_SPEED,
          vy: (Math.random() - 0.5) * DRIFT_SPEED,
          radius: 1 + Math.random() * 1.6,
          // Spread appear thresholds 0..1 so they reveal across the scroll.
          appearAt: i / NODE_COUNT,
          visibility: 0,
        }));
      }
    };

    const updateScrollProgress = () => {
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when container top is at viewport top; 1 when scrolled one viewport past it.
      // Using -rect.top / (rect.height + vh) gives a smooth 0..1 over the entire visible range.
      const total = rect.height + vh;
      const scrolled = vh - rect.top;
      const raw = scrolled / total;
      scrollProgressRef.current = Math.max(0, Math.min(1, raw));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const progress = scrollProgressRef.current;
      // Map progress to a "reveal threshold" - nodes whose appearAt <= threshold become visible.
      // Add a small base so a few nodes are visible even before scrolling.
      const revealThreshold = 0.15 + progress * 0.95;

      // Update positions + visibility
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        // Wrap softly around edges
        if (n.x < -10) n.x = width + 10;
        else if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        else if (n.y > height + 10) n.y = -10;

        const target = n.appearAt <= revealThreshold ? 1 : 0;
        n.visibility += (target - n.visibility) * 0.04; // ease toward target
      }

      // Draw connecting lines first (under nodes)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.visibility < 0.05) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (b.visibility < 0.05) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > CONNECT_DISTANCE) continue;
          // Closer = stronger line, modulated by both nodes' visibility
          const strength = 1 - dist / CONNECT_DISTANCE;
          const alpha = strength * 0.35 * a.visibility * b.visibility;
          if (alpha < 0.005) continue;
          ctx.strokeStyle = `rgba(${LINE_COLOR}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Draw nodes on top
      for (const n of nodes) {
        if (n.visibility < 0.02) continue;
        // soft glow
        ctx.fillStyle = `rgba(91, 184, 255, ${(0.18 * n.visibility).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 3, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.fillStyle = NODE_COLOR.replace("0.9", (0.9 * n.visibility).toFixed(3));
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
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

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
