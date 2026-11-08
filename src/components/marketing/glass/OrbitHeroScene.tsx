import { useEffect, useRef } from "react";

/**
 * Orbit hero scene.
 *
 * Starts on the landing page's final orbit frame — the real earth-limb still
 * (clouds and stations included) — lays the animated signal constellation over
 * its continents, then keeps the shot moving: the camera descends toward the
 * planet, revealing more earth, more cloud detail and additional satellites
 * before easing to a stop. It plays once and holds; it never loops.
 */

type Vec3 = [number, number, number];

const PHOTO = "/capsule/space-v3.webp";
const PHOTO_W = 1920;
const PHOTO_H = 1080;

/** Sphere fit of the photograph's earth, in image fractions. */
const EARTH_X = 0.5;
const EARTH_Y = 1.5;
const EARTH_R = 1.02;

const DURATION = 12000;

const COLORS = [
  "234, 179, 8",
  "168, 85, 247",
  "56, 189, 248",
  "236, 72, 153",
  "45, 212, 191",
  "129, 140, 248",
  "248, 113, 113",
];

const toRad = (d: number) => (d * Math.PI) / 180;
const toVec = (lon: number, lat: number): Vec3 => {
  const la = toRad(lat);
  const lo = toRad(lon);
  const c = Math.cos(la);
  return [c * Math.cos(lo), Math.sin(la), c * Math.sin(lo)];
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

const rng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

interface Dot {
  v: Vec3;
  r: number;
  color: string;
}

interface Link {
  a: number;
  b: number;
  color: string;
  w: number;
}

interface Satellite {
  /** Orbit centre and ellipse, as fractions of the canvas. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  phase: number;
  speed: number;
  scale: number;
  /** Progress at which it fades in. */
  enter: number;
}

const pointInRing = (lon: number, lat: number, ring: number[][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

interface GeoLike {
  type?: string;
  coordinates?: number[][][][];
  geometry?: GeoLike | null;
  features?: { geometry: GeoLike | null }[];
}

function collect(node: GeoLike | null | undefined, out: number[][][][]) {
  if (!node) return;
  if (node.type === "Polygon" && node.coordinates) out.push(node.coordinates as number[][][][]);
  else if (node.type === "MultiPolygon" && node.coordinates) out.push(...(node.coordinates as number[][][][]));
  else if (node.type === "Feature") collect(node.geometry, out);
  else if (node.type === "FeatureCollection") for (const f of node.features ?? []) collect(f.geometry, out);
}

export function OrbitHeroScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dots: Dot[] = [];
    let links: Link[] = [];
    let disposed = false;
    let raf = 0;
    let started = 0;
    let size = { w: 1, h: 1 };
    let dpr = 1;

    const satellites: Satellite[] = [
      { cx: 0.5, cy: 0.23, rx: 0.44, ry: 0.09, phase: -2.3, speed: 0.05, scale: 0.9, enter: 0 },
      { cx: 0.5, cy: 0.14, rx: 0.36, ry: 0.07, phase: 0.7, speed: 0.075, scale: 0.75, enter: 0.16 },
      { cx: 0.52, cy: 0.3, rx: 0.52, ry: 0.11, phase: 2.4, speed: 0.04, scale: 0.85, enter: 0.36 },
      { cx: 0.48, cy: 0.19, rx: 0.4, ry: 0.08, phase: -0.9, speed: 0.09, scale: 0.65, enter: 0.56 },
      { cx: 0.5, cy: 0.35, rx: 0.58, ry: 0.13, phase: 1.7, speed: 0.035, scale: 0.8, enter: 0.74 },
    ];

    const photo = new Image();
    photo.src = PHOTO;
    let photoReady = false;
    photo.onload = () => {
      photoReady = true;
      render(performance.now());
    };

    /* ── Framing ────────────────────────────────────────────────────────── */

    /** The photo at object-fit: cover, before the descent begins. */
    const basePlate = () => {
      const cover = Math.max(size.w / PHOTO_W, size.h / PHOTO_H);
      return {
        scale: cover,
        offsetY: (size.h - PHOTO_H * cover) / 2,
      };
    };

    /**
     * Camera descent. The globe grows about its own horizon and the horizon
     * rises, so more earth and cloud fills the frame — while the still keeps
     * covering the hero. Its edges are clamped inside the plate on every frame,
     * which is what prevents the photograph's bottom edge from showing.
     */
    const cameraAt = (p: number) => {
      const e = smooth(p);
      const plate = basePlate();
      const heightAtRest = PHOTO_H * plate.scale;

      const zoom = 1.004 + 0.4 * e;
      const drawHeight = heightAtRest * zoom;
      const radius = EARTH_R * drawHeight;

      /* Horizon of the earth within the still (top of the globe). */
      const restHorizon = plate.offsetY + (1.5 - EARTH_R) * heightAtRest;
      let horizon = restHorizon - size.h * 0.13 * e;
      horizon = Math.min(0.48 * drawHeight, Math.max(size.h - 0.52 * drawHeight, horizon));

      return {
        scale: plate.scale * zoom,
        centreX: size.w / 2,
        centreY: horizon + radius,
        radius,
      };
    };

    const project = (v: Vec3, cam: ReturnType<typeof cameraAt>) => {
      /* Fixed tilt for the photograph's point of view. */
      const yaw = -0.6;
      const pitch = 0.32;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const x1 = v[0] * cy + v[2] * sy;
      const z1 = -v[0] * sy + v[2] * cy;
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const y2 = v[1] * cp - z1 * sp;
      const z2 = v[1] * sp + z1 * cp;
      /* Pulled a hair inside the limb so the network never floats in the sky. */
      const r = cam.radius * 0.985;
      return { x: cam.centreX + x1 * r, y: cam.centreY - y2 * r, z: z2 };
    };

    /* ── Data ───────────────────────────────────────────────────────────── */

    const seed = (polygons: number[][][][]) => {
      const outers = polygons.map((poly) => {
        const ring = poly[0];
        let minLon = 180;
        let maxLon = -180;
        let minLat = 90;
        let maxLat = -90;
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        return { ring, minLon, maxLon, minLat, maxLat };
      });

      const samples: { lon: number; lat: number }[] = [];
      for (let lat = -72; lat <= 80; lat += 2.9) {
        for (let lon = -180; lon <= 180; lon += 2.9) {
          for (const poly of outers) {
            if (lat < poly.minLat || lat > poly.maxLat || lon < poly.minLon || lon > poly.maxLon) continue;
            if (pointInRing(lon, lat, poly.ring)) {
              samples.push({ lon, lat });
              break;
            }
          }
        }
      }

      const rand = rng(424242);
      dots = samples.map((s) => {
        const roll = rand();
        return {
          v: toVec(s.lon, s.lat),
          r: roll > 0.94 ? 2.1 : roll > 0.72 ? 1.35 : 0.85,
          color: COLORS[Math.floor(rand() * COLORS.length)],
        };
      });

      const next: Link[] = [];
      for (let i = 0; i < dots.length; i++) {
        let best = -1;
        let bestDot = -1;
        for (let c = 0; c < 6; c++) {
          const j = Math.floor(rand() * dots.length);
          if (j === i) continue;
          const d = dots[i].v[0] * dots[j].v[0] + dots[i].v[1] * dots[j].v[1] + dots[i].v[2] * dots[j].v[2];
          if (d > bestDot) {
            bestDot = d;
            best = j;
          }
        }
        if (best === -1 || bestDot < 0.984) continue;
        if (next.some((l) => (l.a === best && l.b === i) || (l.a === i && l.b === best))) continue;
        next.push({ a: i, b: best, color: COLORS[Math.floor(rand() * COLORS.length)], w: 0.5 + rand() * 0.35 });
      }
      links = next;
      render(performance.now());
    };

    /* ── Drawing ────────────────────────────────────────────────────────── */

    const drawSatellite = (x: number, y: number, scale: number, angle: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha;

      ctx.fillStyle = "rgba(232, 242, 255, 0.92)";
      ctx.beginPath();
      ctx.rect(-2.2 * scale, -1.8 * scale, 4.4 * scale, 3.6 * scale);
      ctx.fill();

      ctx.fillStyle = "rgba(120, 172, 255, 0.52)";
      ctx.strokeStyle = "rgba(190, 220, 255, 0.75)";
      ctx.lineWidth = 0.6;
      [-1, 1].forEach((dir) => {
        ctx.beginPath();
        ctx.rect(dir * 2.9 * scale, -3.1 * scale, dir * 5.8 * scale, 6.2 * scale);
        ctx.fill();
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.moveTo(0, 1.8 * scale);
      ctx.lineTo(0, 3.9 * scale);
      ctx.strokeStyle = "rgba(200, 224, 255, 0.6)";
      ctx.stroke();

      ctx.restore();
    };

    const render = (now: number) => {
      const { w, h } = size;
      if (!w || !h) return;

      const t = reduced ? 1 : clamp01((now - (started || now)) / DURATION);
      const cam = cameraAt(t);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05070a";
      ctx.fillRect(0, 0, w, h);

      if (photoReady) {
        const drawW = PHOTO_W * cam.scale;
        const drawH = PHOTO_H * cam.scale;
        ctx.drawImage(
          photo,
          cam.centreX - EARTH_X * drawW,
          cam.centreY - EARTH_Y * drawH,
          drawW,
          drawH,
        );
      }

      /* Signal network across the continents. */
      if (dots.length) {
        const reveal = 0.55 + 0.45 * smooth(t / 0.9);
        const shown = Math.max(1, Math.floor(dots.length * Math.min(1, reveal)));
        const pos = dots.slice(0, shown).map((d) => project(d.v, cam));

        for (const link of links) {
          if (link.a >= shown || link.b >= shown) continue;
          const a = pos[link.a];
          const b = pos[link.b];
          if (!a || !b || a.z <= 0.02 || b.z <= 0.02) continue;
          ctx.strokeStyle = `rgba(${link.color}, 0.36)`;
          ctx.lineWidth = link.w;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        for (let i = 0; i < shown; i++) {
          const d = dots[i];
          const p = pos[i];
          if (!p || p.z <= 0.02) continue;
          ctx.fillStyle = `rgba(${d.color}, 0.12)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, d.r * (d.r > 2 ? 5.2 : 3.8), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(232, 242, 255, 0.82)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* Craft drifting across the sky; anything the globe would hide is skipped. */
      for (const sat of satellites) {
        const enter = smooth((t - sat.enter) / 0.16);
        if (enter <= 0) continue;
        const a = sat.phase + t * Math.PI * 2 * sat.speed;
        const x = (sat.cx + Math.cos(a) * sat.rx) * w;
        const y = (sat.cy + Math.sin(a) * sat.ry) * h;
        if (y > cam.centreY - cam.radius && Math.hypot(x - cam.centreX, y - cam.centreY) < cam.radius) continue;

        const scale = sat.scale * Math.max(0.55, Math.min(1.4, h / 640));
        drawSatellite(x, y, scale, a * 0.5, enter * 0.92);
      }
    };

    const loop = (now: number) => {
      if (disposed) return;
      render(now);
      const p = reduced ? 1 : clamp01((now - started) / DURATION);
      if (p < 1) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
      canvas.width = Math.floor(size.w * dpr);
      canvas.height = Math.floor(size.h * dpr);
      render(performance.now());
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    started = performance.now();
    raf = requestAnimationFrame(loop);

    (async () => {
      try {
        const [topojson, landModule] = await Promise.all([
          import("topojson-client"),
          import("world-atlas/land-110m.json"),
        ]);
        if (disposed) return;
        const land = landModule.default ?? landModule;
        const geo = topojson.feature(
          land as never,
          (land as { objects: { land: unknown } }).objects.land as never,
        ) as unknown as GeoLike;
        const polygons: number[][][][] = [];
        collect(geo, polygons);
        seed(polygons);
      } catch {
        /* Without the land file the frame still reads as the orbit shot. */
      }
    })();

    const onVisibility = () => {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!document.hidden && !raf && clamp01((performance.now() - started) / DURATION) < 1) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div ref={wrapRef} className="gp-scene" aria-hidden="true">
      <canvas ref={canvasRef} className="gp-scene__canvas" />
      <div className="gp-scene__scrim" />
    </div>
  );
}
