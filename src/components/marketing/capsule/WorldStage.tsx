import { useEffect, useRef } from "react";

/**
 * World view canvas for the capsule landing page.
 *
 * Renders a slowly rotating Earth (real coastlines + dotted landmass) with the
 * CityWide network animation playing over the continents. Everything runs on
 * its own — no scroll or pointer input is needed.
 *
 * The world dataset (Natural Earth land outlines, public domain) is fetched with
 * a dynamic import so visitors who never open the capsule do not pay for it.
 */

type Vec3 = [number, number, number];

type LinkPhase = "extending" | "stable" | "retracting" | "paused";

interface Hub {
  v: Vec3;
  tier: 0 | 1 | 2;
}

interface Link {
  a: number;
  b: number;
  color: string;
  t: number;
  phase: LinkPhase;
  hold: number;
  speed: number;
  width: number;
}

/** Channel palette shared with the dashboard network animation. */
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
  "244, 114, 182",
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const toRad = (deg: number) => (deg * Math.PI) / 180;

const toVec = (lon: number, lat: number): Vec3 => {
  const la = toRad(lat);
  const lo = toRad(lon);
  const c = Math.cos(la);
  return [c * Math.cos(lo), Math.sin(la), c * Math.sin(lo)];
};

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Point inside a lon/lat ring (ray casting). */
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

interface LandData {
  dots: Vec3[];
  coasts: Vec3[][];
}

function collectPolygons(node: GeoJSONLike | null, out: number[][][][]) {
  if (!node) return;
  if (node.type === "Polygon" && node.coordinates) {
    out.push(node.coordinates as number[][][][]);
  } else if (node.type === "MultiPolygon" && node.coordinates) {
    out.push(...(node.coordinates as number[][][][]));
  } else if (node.type === "Feature") {
    collectPolygons(node.geometry ?? null, out);
  } else if (node.type === "FeatureCollection") {
    for (const f of node.features ?? []) collectPolygons(f.geometry ?? null, out);
  }
}

function buildLandData(geojson: GeoJSONLike | null, step: number, decimate: number): LandData {
  const polygons: number[][][][] = [];
  collectPolygons(geojson, polygons);

  // Coast rings (outer + inner), decimated for drawing cost.
  const coasts: Vec3[][] = [];
  for (const poly of polygons) {
    for (const ring of poly) {
      const dec: Vec3[] = [];
      for (let i = 0; i < ring.length; i += decimate) dec.push(toVec(ring[i][0], ring[i][1]));
      if (dec.length > 2) coasts.push(dec);
    }
  }

  // Dotted landmass: sample a modest lon/lat grid, keep land points.
  const dots: Vec3[] = [];
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

  for (let lat = -84; lat <= 84; lat += step) {
    for (let lon = -180; lon <= 180; lon += step) {
      for (const poly of outers) {
        if (lat < poly.minLat || lat > poly.maxLat || lon < poly.minLon || lon > poly.maxLon) continue;
        if (pointInRing(lon, lat, poly.ring)) {
          dots.push(toVec(lon, lat));
          break;
        }
      }
    }
  }

  return { dots, coasts };
}

interface GeoJSONLike {
  type: string;
  features?: { geometry: GeoJSONLike | null }[];
  geometry?: GeoJSONLike | null;
  coordinates?: number[][][][];
}

interface WorldStageProps {
  /** True once the capsule has begun opening (canvas fades in). */
  active: boolean;
}

export function WorldStage({ active }: WorldStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let yaw = 0.7;
    const pitch = -0.3;
    /** Precomputed trig for the current camera angle (rebuilt each frame). */
    let cam = { cy: 1, sy: 0, cp: 1, sp: 0 };
    let inView = true;
    let land: LandData = { dots: [], coasts: [] };
    let hubs: Hub[] = [];
    let links: Link[] = [];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isMobile = () => width < 700;

    /** Choose network hubs on land, with links between them. */
    const seedNetwork = () => {
      if (land.dots.length === 0) return;
      const count = isMobile() ? 46 : 82;
      const picked: Hub[] = [];
      for (let i = 0; i < count; i++) {
        const dot = land.dots[Math.floor(Math.random() * land.dots.length)];
        const roll = Math.random();
        picked.push({ v: dot, tier: roll > 0.9 ? 0 : roll > 0.62 ? 1 : 2 });
      }
      hubs = picked;

      const next: Link[] = [];
      const linksPerHub = isMobile() ? 1 : 2;
      for (let i = 0; i < hubs.length; i++) {
        for (let k = 0; k < linksPerHub; k++) {
          // Prefer a nearby hub so connections read as local network activity.
          let best = -1;
          let bestDot = -1;
          for (let c = 0; c < 7; c++) {
            const j = Math.floor(Math.random() * hubs.length);
            if (j === i) continue;
            const d = dot3(hubs[i].v, hubs[j].v);
            if (d > bestDot) {
              bestDot = d;
              best = j;
            }
          }
          if (best === -1) continue;
          // Only keep genuinely local connections so arcs stay readable.
          if (bestDot < 0.55) continue;
          const startStable = Math.random() < 0.6;
          next.push({
            a: i,
            b: best,
            color: CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)],
            t: startStable ? 1 : Math.random() * 0.6,
            phase: startStable ? "stable" : "extending",
            hold: startStable ? 160 + Math.floor(Math.random() * 900) : 0,
            speed: 0.002 + Math.random() * 0.0035,
            width: 0.35 + Math.random() * 0.4,
          });
        }
      }
      links = next;
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
      if (hubs.length === 0) seedNetwork();
    };

    const geometry = () => {
      const cx = width / 2;
      const cy = height * (isMobile() ? 0.4 : 0.54);
      const radius = isMobile()
        ? Math.min(width * 0.47, height * 0.3)
        : Math.min(width * 0.3, height * 0.38);
      return { cx, cy, radius };
    };

    const project = (v: Vec3, cx: number, cy: number, radius: number) => {
      const x1 = v[0] * cam.cy + v[2] * cam.sy;
      const z1 = -v[0] * cam.sy + v[2] * cam.cy;
      const y2 = v[1] * cam.cp - z1 * cam.sp;
      const z2 = v[1] * cam.sp + z1 * cam.cp;
      return { x: cx + x1 * radius, y: cy - y2 * radius, z: z2 };
    };

    const drawGlobeBase = (cx: number, cy: number, radius: number) => {
      ctx.save();
      // Atmosphere
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.35);
      glow.addColorStop(0, "rgba(96, 150, 230, 0.16)");
      glow.addColorStop(1, "rgba(96, 150, 230, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Ocean
      const ocean = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.35,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      ocean.addColorStop(0, "#081120");
      ocean.addColorStop(0.55, "#050a12");
      ocean.addColorStop(1, "#020407");
      ctx.fillStyle = ocean;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Limb
      ctx.strokeStyle = "rgba(140, 185, 255, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawGraticule = (cx: number, cy: number, radius: number) => {
      ctx.strokeStyle = "rgba(150, 195, 255, 0.075)";
      ctx.lineWidth = 0.5;
      const stepDeg = 30;
      for (let lat = -60; lat <= 60; lat += stepDeg) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const p = project(toVec(lon, lat), cx, cy, radius);
          if (p.z <= 0) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += stepDeg) {
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = project(toVec(lon, lat), cx, cy, radius);
          if (p.z <= 0) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    };

    const drawLandDots = (cx: number, cy: number, radius: number) => {
      ctx.fillStyle = "rgba(150, 195, 255, 0.95)";
      for (const v of land.dots) {
        const x1 = v[0] * cam.cy + v[2] * cam.sy;
        const z1 = -v[0] * cam.sy + v[2] * cam.cy;
        const y2 = v[1] * cam.cp - z1 * cam.sp;
        const z2 = v[1] * cam.sp + z1 * cam.cp;
        if (z2 <= 0.02) continue;
        ctx.globalAlpha = Math.min(0.55, 0.12 + z2 * 0.42);
        ctx.fillRect(cx + x1 * radius, cy - y2 * radius, 1.25, 1.25);
      }
      ctx.globalAlpha = 1;
    };

    const drawCoasts = (cx: number, cy: number, radius: number) => {
      ctx.strokeStyle = "rgba(186, 216, 255, 0.55)";
      ctx.lineWidth = 0.8;
      for (const ring of land.coasts) {
        ctx.beginPath();
        let started = false;
        for (const v of ring) {
          const p = project(v, cx, cy, radius);
          if (p.z <= 0.01) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    };

    const drawLinks = (cx: number, cy: number, radius: number, dt: number) => {
      for (const link of links) {
        if (!reduceMotion) {
          if (link.phase === "extending") {
            link.t += link.speed * (dt / 16.7);
            if (link.t >= 1) {
              link.t = 1;
              link.phase = "stable";
              link.hold = 120 + Math.floor(Math.random() * 700);
            }
          } else if (link.phase === "stable") {
            link.hold -= dt / 16.7;
            if (link.hold <= 0) link.phase = "retracting";
          } else if (link.phase === "retracting") {
            link.t -= link.speed * 1.15 * (dt / 16.7);
            if (link.t <= 0) {
              link.t = 0;
              link.phase = "paused";
              link.hold = 20 + Math.floor(Math.random() * 90);
            }
          } else {
            link.hold -= dt / 16.7;
            if (link.hold <= 0) {
              let j = Math.floor(Math.random() * hubs.length);
              if (j === link.a) j = (j + 1) % hubs.length;
              link.b = j;
              link.color = CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)];
              link.phase = "extending";
            }
          }
        }

        if (link.t <= 0.01) continue;
        const a = hubs[link.a]?.v;
        const b = hubs[link.b]?.v;
        if (!a || !b) continue;

        const omega = Math.acos(clamp(dot3(a, b), -1, 1));
        // Skip near-identical hubs
        if (omega < 0.02) continue;
        const sinO = Math.sin(omega);
        const steps = 18;
        const arcR = radius * 1.012;
        const points: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * link.t;
          const w1 = Math.sin((1 - t) * omega) / sinO;
          const w2 = Math.sin(t * omega) / sinO;
          const v: Vec3 = [
            a[0] * w1 + b[0] * w2,
            a[1] * w1 + b[1] * w2,
            a[2] * w1 + b[2] * w2,
          ];
          const len = Math.hypot(v[0], v[1], v[2]) || 1;
          points.push(project([v[0] / len, v[1] / len, v[2] / len], cx, cy, arcR));
        }

        ctx.strokeStyle = `rgba(${link.color}, ${0.2 + link.t * 0.26})`;
        ctx.lineWidth = link.width;
        ctx.beginPath();
        let started = false;
        for (const p of points) {
          if (p.z <= 0.02) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Endpoint spark
        const tip = points[points.length - 1];
        if (tip && tip.z > 0.02) {
          ctx.fillStyle = `rgba(${link.color}, 0.9)`;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 1.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawHubs = (cx: number, cy: number, radius: number, time: number) => {
      for (const hub of hubs) {
        const p = project(hub.v, cx, cy, radius);
        if (p.z <= 0.03) continue;
        const base = hub.tier === 0 ? 2.4 : hub.tier === 1 ? 1.6 : 0.9;
        const pulse = reduceMotion ? 1 : 1 + Math.sin(time / 900 + hub.v[0] * 12) * 0.18;

        if (hub.tier < 2) {
          ctx.fillStyle = `rgba(158, 193, 255, ${0.08 + p.z * 0.08})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, base * 5 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(226, 238, 255, ${0.35 + p.z * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, base * (0.7 + p.z * 0.4)), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawFrame = (dt: number, time: number) => {
      ctx.clearRect(0, 0, width, height);
      const { cx, cy, radius } = geometry();
      if (!reduceMotion) yaw += (dt / 1000) * 0.045;
      cam = { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) };

      ctx.fillStyle = "rgba(150, 195, 255, 0.9)";
      drawGlobeBase(cx, cy, radius);
      drawGraticule(cx, cy, radius);
      drawLandDots(cx, cy, radius);
      drawCoasts(cx, cy, radius);
      drawLinks(cx, cy, radius, reduceMotion ? 0 : dt);
      drawHubs(cx, cy, radius, time);
    };

    let last = performance.now();
    const loop = (now: number) => {
      if (disposed) return;
      const dt = Math.min(64, now - last);
      last = now;
      if (inView) drawFrame(dt, now);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduceMotion) {
        drawFrame(0, performance.now());
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };

    // Load world data lazily.
    (async () => {
      try {
        const [{ feature }, landModule] = await Promise.all([
          import("topojson-client"),
          import("world-atlas/land-110m.json"),
        ]);
        if (disposed) return;
        const topology = ((landModule as unknown as { default?: unknown }).default ??
          landModule) as {
          objects: { land: unknown };
        };
        const geo = feature(topology as never, topology.objects.land as never) as unknown as GeoJSONLike;
        land = buildLandData(geo, isMobile() ? 3 : 2, isMobile() ? 3 : 2);
      } catch {
        // Offline or blocked dataset: keep the clean graticule globe.
        land = { dots: [], coasts: [] };
      }
      if (disposed) return;
      seedNetwork();
      start();
    })();

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) drawFrame(0, performance.now());
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduceMotion) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();

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
