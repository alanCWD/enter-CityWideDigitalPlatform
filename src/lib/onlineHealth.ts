/**
 * Business Online Health — the single place the module address and the
 * client → slug mapping live.
 *
 * The module is a separate deployment. It resolves the slug itself, so a
 * rename in the dashboard must never change a link: entries are keyed by the
 * client's stable portal connection id (gbp_connections.id), never by name.
 *
 * An unknown connection id resolves to null and the dashboard shows a written
 * notice instead of guessing a slug — the module never opens another client.
 */

/** Business Online Health module address. Replace with the production
 *  subdomain when it is assigned. */
export const ONLINE_HEALTH_BASE_URL =
  "https://777130930abb4c4c82ce61c341013bb0.live-preview.enter.pro";

export interface OnlineHealthClient {
  /** Stable, non-personal client reference used by the module. */
  slug: string;
  /** Optional internal location reference (for example "NW-01"). */
  location?: string;
}

/** Portal connection id → module client reference. */
export const ONLINE_HEALTH_CLIENTS: Record<string, OnlineHealthClient> = {
  // CityWide Digital
  "27cd88f7-6eef-454f-a881-1df5ddb89824": { slug: "citywide-digital" },
  // Go Rest
  "54a6d841-caf6-4c60-9a1f-b10091934c05": { slug: "go-rest" },
  // HyperDrii
  "9987ccd3-4839-4f3f-82a4-1809c2dcc890": { slug: "hyperdrii" },
  // The Finer Details
  "b2a4cb56-14cb-43c9-b1cd-9ae50b2c972a": { slug: "the-finer-details" },
  // The Foam Zone
  "a7f66da2-2a40-4f42-acf8-bbfc0c5e3374": { slug: "the-foam-zone" },
};

export function onlineHealthClient(
  connectionId: string | null | undefined,
): OnlineHealthClient | null {
  if (!connectionId) return null;
  return ONLINE_HEALTH_CLIENTS[connectionId] ?? null;
}

interface BuildOptions {
  /** Render the module without its own sidebar, top bar and footer. */
  embed?: boolean;
  /** Module route, e.g. "/app/findings". Defaults to the report. */
  path?: string;
}

/**
 * Build a module address for one client. Only the slug, the optional location
 * reference and the flags go in the query string — never a token, email or
 * personal data. Returns null when the client has no mapping.
 */
export function buildOnlineHealthUrl(
  connectionId: string | null | undefined,
  { embed = false, path = "/app" }: BuildOptions = {},
): string | null {
  const client = onlineHealthClient(connectionId);
  if (!client) return null;

  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/app";
  const params = new URLSearchParams({ client: client.slug, from: "citywide" });
  if (client.location) params.set("location", client.location);
  if (embed) params.set("embed", "1");

  return `${ONLINE_HEALTH_BASE_URL}${safePath}?${params.toString()}`;
}
