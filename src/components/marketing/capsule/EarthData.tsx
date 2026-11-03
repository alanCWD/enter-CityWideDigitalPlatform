import { useEffect, useRef } from "react";

/**
 * Earth data layer.
 *
 * Once the journey reaches the orbit frame, businesses are plotted on the planet
 * as data points whose size reflects the business, joined by lines that stay
 * inside the visible landmasses. Land is detected from the orbit plate itself
 * (so points follow its continents and perspective), and bright cloud tops are
 * excluded, leaving the weather untouched.
 */

const CHANNEL_COLORS = [
  "234, 179, 8",
  "168, 85, 247",
  "56, 189, 248",
  "236, 72, 153",
  "45, 212, 191",
  "129, 140, 248",
  "248, 113, 113",
];

interface Point {
  x: number;
  y: number;
  r: number;
  color: string;
  halo: number;
}

interface Edge {
  a: number;
  b: number;
  color: string;
  width: number;
}

const SAMPLE_W = 520;

export function EarthData({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const host = wrap?.closest(".cap-journey") as HTMLElement | null;
    if (!canvas || !wrap || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let points: Point[] = [];
    let edges: Edge[] = [];
    let mask: Uint8Array | null = null;
    let maskW = 0;
    let maskH = 0;
    let disposed = false;
    let frame = 0;
    let lastDrawn = -1;

    const smooth = (t: number) => {
      const x = Math.min(1, Math.max(0, t));
      return x * x * (3 - 2 * x);
    };

    const progress = () => {
      const span = Math.max(1, host.offsetHeight - window.innerHeight);
      return Math.min(1, Math.max(0, (window.scrollY - host.offsetTop) / span));
    };

    /** Land = not ocean, not cloud, not empty space. */
    const buildFromPlate = (image: HTMLImageElement) => {
      const h = Math.round((image.height / image.width) * SAMPLE_W);
      const off = document.createElement("canvas");
      off.width = SAMPLE_W;
      off.height = h;
      const offCtx = off.getContext("2d");
      if (!offCtx) return;
      offCtx.drawImage(image, 0, 0, SAMPLE_W, h);
      const data = offCtx.getImageData(0, 0, SAMPLE_W, h).data;
      maskW = SAMPLE_W;
      maskH = h;
      const m = new Uint8Array(SAMPLE_W * h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < SAMPLE_W; x++) {
          const i = (y * SAMPLE_W + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const bright = (r + g + b) / 3;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;

          const isSpace = bright < 16;
          const isCloud = bright > 158 && sat < 0.22;
          const isOcean = b > r * 1.12 && b > g * 1.06 && bright < 132;
          const isLand =
            !isSpace &&
            !isCloud &&
            !isOcean &&
            (r > b * 1.04 || g > b * 1.04 || (sat > 0.12 && bright > 28 && bright < 190));

          m[y * SAMPLE_W + x] = isLand ? 1 : 0;
        }
      }
      /* If the plate is mostly cloud/ocean, relax to "any planetary surface". */
      let landCount = 0;
      for (let i = 0; i < m.length; i++) landCount += m[i];
      if (landCount < m.length * 0.02) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < SAMPLE_W; x++) {
            const i = (y * SAMPLE_W + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const bright = (r + g + b) / 3;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const isSpace = bright < 14;
            const isCloud = bright > 168 && sat < 0.16;
            m[y * SAMPLE_W + x] = !isSpace && !isCloud && bright < 205 ? 1 : 0;
          }
        }
      }
      mask = m;

      /* Collect candidate business points on land, in clusters. */
      const candidates: { x: number; y: number }[] = [];
      for (let y = 2; y < h - 2; y += 3) {
        for (let x = 2; x < SAMPLE_W - 2; x += 3) {
          if (!m[y * SAMPLE_W + x]) continue;
          let solid = 0;
          for (let dy = -2; dy <= 2; dy += 2) {
            for (let dx = -2; dx <= 2; dx += 2) {
              solid += m[(y + dy) * SAMPLE_W + (x + dx)] ?? 0;
            }
          }
          if (solid < 5) continue;
          if (Math.random() > 0.34) continue;
          candidates.push({
            x: (x + (Math.random() - 0.5) * 2) / SAMPLE_W,
            y: (y + (Math.random() - 0.5) * 2) / h,
          });
        }
      }

      const picked = candidates.slice(0, 420);
      points = picked.map((p) => {
        const sizeRoll = Math.random();
        const r = sizeRoll > 0.94 ? 2.6 : sizeRoll > 0.74 ? 1.7 : 1.0;
        return {
          x: p.x,
          y: p.y,
          r,
          color: CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)],
          halo: r > 2 ? 7 : 4,
        };
      });

      /* Links between nearby businesses, kept over land. */
      const landAt = (x: number, y: number) => {
        const px = Math.min(SAMPLE_W - 1, Math.max(0, Math.round(x * SAMPLE_W)));
        const py = Math.min(h - 1, Math.max(0, Math.round(y * h)));
        return m[py * SAMPLE_W + px] === 1;
      };

      const next: Edge[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const maxDist = 0.14;
        const near = points
          .map((p, j) => ({ p, j, d: Math.hypot(p.x - a.x, p.y - a.y) }))
          .filter((o) => o.j !== i && o.d > 0.012 && o.d < maxDist)
          .sort((u, v) => u.d - v.d)
          .slice(0, 3);

        for (const candidate of near) {
          const j = candidate.j;
          if (next.some((e) => (e.a === j && e.b === i) || (e.a === i && e.b === j))) continue;
          const steps = 12;
          let onLand = 0;
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            if (landAt(a.x + (points[j].x - a.x) * t, a.y + (points[j].y - a.y) * t)) onLand++;
          }
          if (onLand / (steps - 1) < 0.75) continue;
          next.push({
            a: i,
            b: j,
            color: CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)],
            width: 0.5 + Math.random() * 0.4,
          });
          if (next.length > 460) break;
        }
      }
      edges = next;
      draw();
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      if (!points.length) return;

      /* Embellish only once the windows are behind us. */
      const p = progress();
      const reveal = smooth((p - 0.9) / 0.1);
      if (reveal <= 0) return;
      lastDrawn = p;

      const shown = Math.max(1, Math.floor(points.length * reveal));
      const visible = new Set<number>();

      for (let i = 0; i < shown; i++) {
        visible.add(i);
        const pt = points[i];
        const x = pt.x * w;
        const y = pt.y * h;

        ctx.fillStyle = `rgba(${pt.color}, ${0.1 * reveal})`;
        ctx.beginPath();
        ctx.arc(x, y, pt.r * pt.halo, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(224, 238, 255, ${0.75 * reveal})`;
        ctx.beginPath();
        ctx.arc(x, y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const edge of edges) {
        if (!visible.has(edge.a) || !visible.has(edge.b)) continue;
        const a = points[edge.a];
        const b = points[edge.b];
        ctx.strokeStyle = `rgba(${edge.color}, ${0.3 * reveal})`;
        ctx.lineWidth = edge.width;
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const p = progress();
        if (Math.abs(p - lastDrawn) > 0.002) draw();
      });
    };

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (disposed) return;
      buildFromPlate(image);
      resize();
    };
    image.src = src;

    resize();
    window.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    void mask;

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      image.onload = null;
    };
  }, [src]);

  return (
    <div ref={wrapRef} className="cap-data" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
