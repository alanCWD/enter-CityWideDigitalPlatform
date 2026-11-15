/**
 * Read-only pull route for the Customer Content Studio recorder.
 *
 * GET /companies (also tolerates /api/recorder/companies and /api/companies).
 * Auth: Authorization: Bearer <RECORDER_PULL_TOKEN>. The pull token is separate
 * from the intake key, stored only as a SHA-256 hash, read-only and rotatable.
 * Missing, wrong or revoked tokens return 401 JSON.
 *
 * The response uses the same mapper and stable ids as the push contract: one
 * company object per active company-location pair, in one compact response.
 * No pagination until the recorder team agrees to it.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRecorderCompany, validateRecorderCompany } from "./lib/payload.ts";
import { loadAllBundles } from "./lib/store.ts";

const PULL_SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PULL_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const pullDb = createClient(PULL_SUPABASE_URL, PULL_SERVICE_KEY, { auth: { persistSession: false } });

const SERVICE = "cwd-recorder-pull";
const VERSION = "1.0";
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

export const pullCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const pullJson = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...pullCorsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });

const pullFail = (status: number, message: string, extra: Record<string, string> = {}) =>
  pullJson({ error: message }, status, extra);

async function pullSha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerToken(req: Request): string | null {
  const auth = (req.headers.get("Authorization") ?? "").trim();
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function authenticate(req: Request): Promise<{ id: string } | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const hash = await pullSha256Hex(token);
  const { data, error } = await pullDb
    .from("recorder_pull_tokens")
    .select("id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) return null;
  return { id: String(data.id) };
}

async function rateLimited(tokenId: string): Promise<number | null> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data, error } = await pullDb
    .from("recorder_pull_log")
    .select("created_at")
    .eq("token_id", tokenId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(RATE_LIMIT);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length < RATE_LIMIT) return null;
  const oldest = Date.parse(String(rows[0]?.created_at ?? ""));
  const elapsed = Number.isNaN(oldest) ? WINDOW_MS : Date.now() - oldest;
  return Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000));
}

function routeOf(pathname: string): string {
  let rest = pathname;
  for (const marker of ["/recorder-sync", "/recorder-pull"]) {
    const idx = rest.indexOf(marker);
    if (idx >= 0) rest = rest.slice(idx + marker.length);
  }
  rest = rest.replace(/^\/api\/recorder/, "").replace(/^\/api/, "");
  return rest.replace(/^\/+|\/+$/g, "");
}

async function logRequest(tokenId: string | null, route: string, status: number, duration: number, companies: number) {
  try {
    await pullDb.from("recorder_pull_log").insert({
      token_id: tokenId,
      route,
      method: "GET",
      status,
      duration_ms: Math.round(duration),
      company_count: companies,
    });
  } catch { /* request logging never breaks the response */ }
}

export async function handlePull(req: Request): Promise<Response> {
  const started = Date.now();
  const method = req.method.toUpperCase();
  if (method === "OPTIONS") return new Response("ok", { headers: pullCorsHeaders });
  if (method !== "GET" && method !== "HEAD") {
    return pullFail(405, "Only GET is supported.", { Allow: "GET, HEAD, OPTIONS" });
  }

  const route = routeOf(new URL(req.url).pathname);

  // Public liveness probe: service identity only, never company data.
  if (route === "health") {
    return pullJson({ ok: true, service: SERVICE, version: VERSION });
  }
  if (route !== "companies" && route !== "") {
    return pullFail(404, "Unknown route. Use /companies.");
  }

  let tokenId: string | null = null;
  try {
    const token = await authenticate(req);
    if (!token) {
      await logRequest(null, "companies", 401, Date.now() - started, 0);
      return pullFail(401, "Missing or invalid pull token.");
    }
    tokenId = token.id;

    const retryAfter = await rateLimited(token.id);
    if (retryAfter !== null) {
      await logRequest(token.id, "companies", 429, Date.now() - started, 0);
      return pullFail(429, `Rate limit exceeded: ${RATE_LIMIT} requests per minute.`, {
        "Retry-After": String(retryAfter),
      });
    }

    const bundles = await loadAllBundles(db);
    const companies = [];
    for (const bundle of bundles) {
      if (!bundle) continue;
      const payload = buildRecorderCompany(bundle);
      const issues = validateRecorderCompany(payload);
      if (issues.length > 0) {
        console.warn("recorder-pull skipped an invalid company payload", {
          company: payload.id,
          location: payload.location?.id,
          fields: issues.map((i) => i.field),
        });
        continue;
      }
      companies.push(payload);
    }

    await logRequest(token.id, "companies", 200, Date.now() - started, companies.length);
    try {
      await pullDb.from("recorder_pull_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);
    } catch { /* best effort */ }

    return pullJson({ companies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("recorder-pull error:", message);
    await logRequest(tokenId, "companies", 500, Date.now() - started, 0);
    return pullFail(500, "Could not build the company list.");
  }
}
