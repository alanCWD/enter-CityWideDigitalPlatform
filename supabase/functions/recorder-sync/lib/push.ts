/**
 * Server-side push service for the Customer Content Studio recorder.
 *
 * One HTTPS POST per company-location pair. The intake key is read from server
 * secrets by the caller and is never logged, echoed or included in error text.
 * Temporary failures (network, timeout, 429, 5xx) retry with backoff; contract
 * errors (4xx, invalid payload) fail permanently so the job is not retried
 * forever.
 */

import { validateRecorderCompany } from "./payload.ts";
import type { RecorderCompanyPayload, RecorderPushResponse, RecorderPushResult } from "./types.ts";
import { MAX_PUSH_BYTES } from "./types.ts";

export interface PushConfig {
  intakeUrl: string;
  intakeKey: string;
}

export interface PushOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function parseBody(raw: string): RecorderPushResponse | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as RecorderPushResponse) : null;
  } catch {
    return null;
  }
}

/**
 * Push one company-location payload. Never throws: callers record the result.
 */
export async function pushRecorderCompany(
  payload: RecorderCompanyPayload,
  config: PushConfig,
  options: PushOptions = {},
): Promise<RecorderPushResult> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_ATTEMPTS);
  const sleep = options.sleep ?? defaultSleep;
  const doFetch = options.fetchImpl ?? fetch;

  const fail = (error: string, permanent: boolean, attempts = 1, status: number | null = null, body: RecorderPushResponse | null = null, raw = ""): RecorderPushResult => ({
    ok: false,
    status,
    body,
    raw,
    error,
    attempts,
    durationMs: Date.now() - started,
    permanent,
  });

  const url = safeUrl(config.intakeUrl);
  if (!url) return fail("Recorder intake URL is not configured or is not a valid HTTPS address.", true);
  if (!String(config.intakeKey ?? "").trim()) return fail("Recorder intake key is not configured.", true);

  const issues = validateRecorderCompany(payload);
  if (issues.length > 0) {
    return fail(`CWD data is incomplete: ${issues.map((i) => `${i.field} — ${i.message}`).join(" ")}`, true);
  }

  const body = { company: payload };
  const serialized = JSON.stringify(body);
  const size = byteLength(serialized);
  if (size > MAX_PUSH_BYTES) {
    return fail(`Payload is ${Math.round(size / 1024)} KB; the recorder limits a request to 400 KB.`, true);
  }

  let attempts = 0;
  let last: RecorderPushResult | null = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    let response: Response | null = null;
    let raw = "";
    try {
      response = await doFetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cwd-key": config.intakeKey,
        },
        body: serialized,
        signal: AbortSignal.timeout(timeoutMs),
      });
      raw = await response.text().catch(() => "");
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
      const message = isTimeout
        ? `Recorder did not answer within ${Math.round(timeoutMs / 1000)}s.`
        : "Could not reach the recorder intake URL.";
      last = fail(message, false, attempts);
      if (attempts < maxAttempts) {
        await sleep(Math.min(1000 * 2 ** (attempts - 1), 8000));
        continue;
      }
      return last;
    }

    const parsed = parseBody(raw);
    const status = response.status;

    if (response.ok && parsed?.ok === true) {
      return {
        ok: true,
        status,
        body: parsed,
        raw,
        error: null,
        attempts,
        durationMs: Date.now() - started,
        permanent: false,
      };
    }

    const recorderMessage = typeof parsed?.error === "string" && parsed.error.trim()
      ? parsed.error.trim()
      : response.ok
        ? "The recorder answered without a success confirmation."
        : `The recorder answered with status ${status}.`;

    const retryable = RETRYABLE_STATUS.has(status);
    last = {
      ok: false,
      status,
      body: parsed,
      raw: raw.slice(0, 4000),
      error: recorderMessage,
      attempts,
      durationMs: Date.now() - started,
      permanent: !retryable,
    };

    if (!retryable || attempts >= maxAttempts) return last;

    const retryAfter = Number(response.headers.get("retry-after") ?? "");
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 30_000)
      : Math.min(1000 * 2 ** (attempts - 1), 8000);
    await sleep(wait);
  }

  return last ?? fail("Push failed without a response.", false, attempts);
}
