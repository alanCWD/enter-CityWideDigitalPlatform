import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildStudioPayload,
  createStudioSso,
  readStudioUrl,
  signStudioJwt,
} from "../../supabase/functions/recorder-sync/lib/sso.ts";

function decode(part: string): Record<string, unknown> {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

describe("Content Studio SSO", () => {
  it("accepts only a public HTTPS studio base URL", () => {
    assert.equal(readStudioUrl("https://studio.example.com/"), "https://studio.example.com");
    assert.equal(readStudioUrl("https://studio.example.com/app/"), "https://studio.example.com/app");
    assert.equal(readStudioUrl("http://studio.example.com"), null);
    assert.equal(readStudioUrl("not a url"), null);
    assert.equal(readStudioUrl("https://user:pass@studio.example.com"), null);
    assert.equal(readStudioUrl(""), null);
  });

  it("builds the exact 60-second payload", () => {
    const payload = buildStudioPayload({
      userId: "user-1",
      email: "alan@citywidedigital.ca",
      name: "Alan Bowles",
      companyId: "cwd-client-1",
      nowSeconds: 1_700_000_000,
      jti: "11111111-2222-4333-8444-555555555555",
    });

    assert.deepEqual(payload, {
      iss: "citywide-dashboard",
      aud: "content-studio",
      sub: "user-1",
      email: "alan@citywidedigital.ca",
      name: "Alan Bowles",
      company_id: "cwd-client-1",
      role: "owner",
      iat: 1_700_000_000,
      exp: 1_700_000_060,
      jti: "11111111-2222-4333-8444-555555555555",
    });
    assert.equal(payload.exp - payload.iat, 60);
  });

  it("falls back to the email name for the display name", () => {
    const payload = buildStudioPayload({
      userId: "user-2",
      email: "jordan@example.com",
      name: "",
      companyId: "cwd-client-2",
    });
    assert.equal(payload.name, "jordan");
    assert.equal(payload.email, "jordan@example.com");
  });

  it("generates a new UUID jti on every call", () => {
    const first = buildStudioPayload({ userId: "u", email: "a@b.ca", name: "A", companyId: "c" });
    const second = buildStudioPayload({ userId: "u", email: "a@b.ca", name: "A", companyId: "c" });
    assert.notEqual(first.jti, second.jti);
    assert.match(first.jti, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("signs HS256 with the exact header and verifiable signature", async () => {
    const secret = "test-secret-value";
    const payload = buildStudioPayload({
      userId: "user-1",
      email: "alan@citywidedigital.ca",
      name: "Alan",
      companyId: "cwd-client-1",
      nowSeconds: 1_700_000_000,
      jti: "11111111-2222-4333-8444-555555555555",
    });
    const token = await signStudioJwt(secret, payload);
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    assert.ok(headerPart && payloadPart && signaturePart);

    assert.deepEqual(decode(headerPart), { alg: "HS256", typ: "JWT" });
    assert.deepEqual(decode(payloadPart), payload);

    const expected = createHmac("sha256", secret).update(`${headerPart}.${payloadPart}`).digest("base64url");
    assert.equal(signaturePart, expected);
    assert.equal(token.includes(secret), false);
  });

  it("creates a one-time URL under /sso with a fresh token", async () => {
    const first = await createStudioSso("test-secret", "https://studio.example.com/", {
      userId: "user-1",
      email: "a@b.ca",
      name: "A",
      companyId: "company-1",
    });
    const second = await createStudioSso("test-secret", "https://studio.example.com/", {
      userId: "user-1",
      email: "a@b.ca",
      name: "A",
      companyId: "company-1",
    });

    assert.equal(first.url, `https://studio.example.com/sso#token=${first.token}`);
    assert.notEqual(first.token, second.token);
    assert.notEqual(first.payload.jti, second.payload.jti);
    assert.equal(first.payload.company_id, "company-1");
  });

  it("refuses to sign without a secret or a company id", async () => {
    const payload = buildStudioPayload({ userId: "u", email: "a@b.ca", name: "A", companyId: "c" });
    await assert.rejects(() => signStudioJwt("", payload), /SSO secret/);
    assert.throws(() => buildStudioPayload({ userId: "u", email: "a@b.ca", name: "A", companyId: "" }), /company id/);
  });
});
