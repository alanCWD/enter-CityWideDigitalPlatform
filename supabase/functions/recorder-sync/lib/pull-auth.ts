/**
 * Pull-token parsing and hashing shared with the pull route. Kept free of
 * database and Deno access so it can be unit tested directly.
 */

/** Read `Authorization: Bearer <token>`; anything else is not a pull token. */
export function readPullBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = String(header).trim().match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/** Only the SHA-256 hash of a pull token is stored. */
export async function hashPullToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
