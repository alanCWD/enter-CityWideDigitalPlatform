import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import { hashPullToken, readPullBearer } from "../../supabase/functions/recorder-sync/lib/pull-auth.ts";

describe("pull token authentication", () => {
  it("rejects a missing or malformed Authorization header", () => {
    assert.equal(readPullBearer(null), null);
    assert.equal(readPullBearer(""), null);
    assert.equal(readPullBearer("   "), null);
    assert.equal(readPullBearer("Basic abc"), null);
    assert.equal(readPullBearer("Bearer"), null);
    assert.equal(readPullBearer("Bearer    "), null);
    assert.equal(readPullBearer("cwd_pull_abc"), null);
  });

  it("reads a Bearer token regardless of case and extra spaces", () => {
    assert.equal(readPullBearer("Bearer cwd_pull_abc"), "cwd_pull_abc");
    assert.equal(readPullBearer("bearer   cwd_pull_abc  "), "cwd_pull_abc");
    assert.equal(readPullBearer("  BEARER cwd_pull_abc "), "cwd_pull_abc");
  });

  it("stores only the SHA-256 hash of the token", async () => {
    const token = "cwd_pull_test_value";
    const expected = createHash("sha256").update(token).digest("hex");
    assert.equal(await hashPullToken(token), expected);
    assert.equal((await hashPullToken(token)).length, 64);
    assert.notEqual(await hashPullToken(token), await hashPullToken(`${token}x`));
  });
});
