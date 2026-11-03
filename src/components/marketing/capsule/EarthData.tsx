import { useEffect, useRef } from "react";

/**
 * Earth data layer (continent-accurate).
 *
 * Real Natural Earth land outlines are projected orthographically onto the
 * orbit frame, fitted to the planet's visible limb. Business points are then
 * sampled from those landmasses — three sizes — and joined by links that only
 * run between nearby land points, so the network stays over the continents.
 * The photograph (clouds included) remains underneath, untouched.
 */

type Vec3 = [number, number, number];

/** Sphere fit for the orbit plate, in fractions of the media box. */
const CENTRE_X = 0.5;
const CENTRE_Y = 1.5;
const RADIUS = 1.02;
const YAW = -0.6;
const PITCH = 0.32;

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

const pointInRing = (lon: number, lat: number, ring: number[][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
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

export function EarthData() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const host = wrap?.closest(".cap-journey") as HTMLElement | null;
    if (!canvas || !wrap || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dots: Dot[] = [];
    let links: Link[] = [];
    let disposed = false;
    let raf = 0;
    let lastProgress = -1;

    const smooth = (t: number) => {
      const x = Math.min(1, Math.max(0, t));
      return x * x * (3 - 2 * x);
    };

    const journeyProgress = () => {
      const span = Math.max(1, host.offsetHeight - window.innerHeight);
      return Math.min(1, Math.max(0, (window.scrollY - host.offsetTop) / span));
    };

    const project = (v: Vec3, w: number, h: number) => {
      const cy = Math.cos(YAW);
      const sy = Math.sin(YAW);
      const x1 = v[0] * cy + v[2] * sy;
      const z1 = -v[0] * sy + v[2] * cy;
      const cp = Math.cos(PITCH);
      const sp = Math.sin(PITCH);
      const y2 = v[1] * cp - z1 * sp;
      const z2 = v[1] * sp + z1 * cp;
      const r = RADIUS * h;
      return {
        x: CENTRE_X * w + x1 * r,
        y: CENTRE_Y * h - y2 * r,
        z: z2,
      };
    };

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

      /* Business points: sample land on a coarse grid, weighted to clusters. */
      const samples: { lon: number; lat: number }[] = [];
      for (let lat = -76; lat <= 78; lat += 2.6) {
        for (let lon = -180; lon <= 180; lon += 2.6) {
          for (const poly of outers) {
            if (lat < poly.minLat || lat > poly.maxLat || lon < poly.minLon || lon > poly.maxLon) continue;
            if (pointInRing(lon, lat, poly.ring)) {
              samples.push({ lon, lat });
              break;
            }
          }
        }
      }

      dots = samples.map((s) => {
        const roll = Math.random();
        return {
          v: toVec(s.lon, s.lat),
          r: roll > 0.94 ? 2.4 : roll > 0.72 ? 1.55 : 0.95,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
      });

      /* Links: nearest neighbours only, so segments stay over land. */
      const next: Link[] = [];
      for (let i = 0; i < dots.length; i++) {
        let best = -1;
        let bestDot = -1;
        for (let c = 0; c < 6; c++) {
          const j = Math.floor(Math.random() * dots.length);
          if (j === i) continue;
          const d =
            dots[i].v[0] * dots[j].v[0] + dots[i].v[1] * dots[j].v[1] + dots[i].v[2] * dots[j].v[2];
          if (d > bestDot) {
            bestDot = d;
            best = j;
          }
        }
        if (best === -1 || bestDot < 0.985) continue; // ~10 degrees
        if (next.some((l) => (l.a === best && l.b === i) || (l.a === i && l.b === best))) continue;
        next.push({
          a: i,
          b: best,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          w: 0.5 + Math.random() * 0.4,
        });
      }
      links = next;
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
      if (!dots.length) return;

      const p = journeyProgress();
      lastProgress = p;
      const reveal = smooth((p - 0.88) / 0.12);
      if (reveal <= 0) return;

      const shown = Math.max(1, Math.floor(dots.length * reveal));
      const pos = dots.slice(0, shown).map((d) => project(d.v, w, h));

      /* Links first so points sit on top. */
      for (const link of links) {
        if (link.a >= shown || link.b >= shown) continue;
        const a = pos[link.a];
        const b = pos[link.b];
        if (!a || !b || a.z <= 0.02 || b.z <= 0.02) continue;
        ctx.strokeStyle = `rgba(${link.color}, ${0.28 * reveal})`;
        ctx.lineWidth = link.w;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (let i = 0; i < shown; i++) {
        const d = dots[i];
        const posI = pos[i];
        if (!posI || posI.z <= 0.02) continue;
        ctx.fillStyle = `rgba(${d.color}, ${0.07 * reveal})`;
        ctx.beginPath();
        ctx.arc(posI.x, posI.y, d.r * (d.r > 2 ? 5.5 : 4), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(226, 238, 255, ${0.72 * reveal})`;
        ctx.beginPath();
        ctx.arc(posI.x, posI.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = journeyProgress();
        if (Math.abs(p - lastProgress) > 0.002) draw();
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("scroll", onScroll, { passive: true });

    (async () => {
      try {
        if (disposed) return;
        const [topojson, landModule] = await Promise.all([
          import("topojson-client"),
          import("world-atlas/land-110m.json"),
        ]);
        const topology = ((landModule as unknown as { default?: unknown }).default ??
          landModule) as { objects: { land: unknown } };
        const geo = topojson.feature(
          topology as never,
          topology.objects.land as never,
        ) as unknown as GeoLike;
        const polygons: number[][][][] = [];
        collect(geo, polygons);
        seed(polygons);
      } catch {
        /* Leave the planet clean if the outlines cannot load. */
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="cap-data" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
