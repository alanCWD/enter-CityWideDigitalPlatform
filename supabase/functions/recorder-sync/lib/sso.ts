/**
 * Customer Content Studio SSO.
 *
 * The CWD backend signs a short-lived HS256 JWT that the studio exchanges for a
 * scoped session. The signing secret never reaches the browser; the browser only
 * receives the resulting one-time URL.
 */

export const SSO_ISSUER = "citywide-dashboard";
export const SSO_AUDIENCE = "content-studio";
export const SSO_TTL_SECONDS = 60;

export interface StudioSsoPayload {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  name: string;
  company_id: string;
  role: "owner";
  iat: number;
  exp: number;
  jti: string;
}

export interface StudioSsoInput {
  userId: string;
  email: string;
  name: string;
  companyId: string;
  /** Test seam; defaults to the current time. */
  nowSeconds?: number;
  /** Test seam; defaults to a random UUID. */
  jti?: string;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function base64url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** A public https base URL for the studio, without a trailing slash. */
export function readStudioUrl(raw: string | null | undefined): string | null {
  const value = text(raw);
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

export function buildStudioPayload(input: StudioSsoInput): StudioSsoPayload {
  const userId = text(input.userId);
  const companyId = text(input.companyId);
  if (!userId) throw new Error("A signed-in user is required.");
  if (!companyId) throw new Error("A company id is required.");

  const email = text(input.email);
  const name = text(input.name) || email.split("@")[0] || "CWD user";
  const iat = Math.floor(input.nowSeconds ?? Date.now() / 1000);
  return {
    iss: SSO_ISSUER,
    aud: SSO_AUDIENCE,
    sub: userId,
    email,
    name,
    company_id: companyId,
    role: "owner",
    iat,
    exp: iat + SSO_TTL_SECONDS,
    jti: input.jti ?? crypto.randomUUID(),
  };
}

/** Sign the exact header and payload the studio expects. */
export async function signStudioJwt(secret: string, payload: StudioSsoPayload): Promise<string> {
  const keyValue = text(secret);
  if (!keyValue) throw new Error("SSO secret is not configured.");

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

/** Fresh token + one-time URL. A new jti is created on every call. */
export async function createStudioSso(
  secret: string,
  studioUrl: string,
  input: StudioSsoInput,
): Promise<{ token: string; url: string; payload: StudioSsoPayload }> {
  const base = readStudioUrl(studioUrl);
  if (!base) throw new Error("The Content Studio URL is not configured as a public HTTPS address.");
  const payload = buildStudioPayload(input);
  const token = await signStudioJwt(secret, payload);
  return { token, url: `${base}/sso#token=${token}`, payload };
}
