/**
 * Context.dev wrapper — the ONLY module in this app that talks to Context.dev.
 *
 * - Reads CONTEXT_DEV_API_KEY from the server environment (never hardcode it,
 *   never expose it via NEXT_PUBLIC_*). `server-only` makes any client-side
 *   import a build error, so the key can't reach a browser bundle.
 * - Retries: delegated to the official SDK, which retries 408/409/429/5xx with
 *   bounded exponential backoff (0.5s → 8s) and honors `Retry-After` /
 *   `retry-after-ms` on 429. 400/401/402/403/404/422 are never retried.
 * - Concurrency: a per-instance semaphore (default 2 — the Free plan's
 *   concurrent-request limit) so fan-out doesn't trigger 429s.
 * - Tests must mock this module (`vi.mock("@/lib/context-dev")`): every real
 *   call costs credits.
 *
 * Endpoints used (docs are the source of truth):
 *   POST /web/answers  https://docs.context.dev/api-reference/web-extraction/answers
 *   POST /web/search   https://docs.context.dev/api-reference/web-scraping/search
 *   POST /web/scrape   https://docs.context.dev/api-reference/web-scraping/scrape
 *                      (screenshots = formats.screenshot; NOT the legacy
 *                       GET /web/screenshot / client.web.screenshot())
 */
import "server-only";

import ContextDev, { APIConnectionTimeoutError, APIError } from "context.dev";
import type { WebScrapeParams } from "context.dev/resources/web";

const REQUEST_TAGS = ["renewal-negotiator"];
/** Extra time the HTTP client waits beyond the API-side deadline (network + response reserve). */
const CLIENT_TIMEOUT_HEADROOM_MS = 15_000;
/** Pricing pages change rarely, but negotiation data should be recent: accept ≤ 24h-old captures by default. */
export const DEFAULT_SCRAPE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Client + errors
// ---------------------------------------------------------------------------

export class ContextDevError extends Error {
  readonly status?: number;
  readonly errorCode?: string;
  readonly requestId?: string;
  /** True only for transient failures that are worth retrying later. */
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { status?: number; errorCode?: string; requestId?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "ContextDevError";
    this.status = opts.status;
    this.errorCode = opts.errorCode;
    this.requestId = opts.requestId;
    this.retryable = opts.retryable ?? false;
  }
}

let cachedClient: ContextDev | undefined;

function getClient(): ContextDev {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.CONTEXT_DEV_API_KEY;
  if (!apiKey) {
    throw new ContextDevError(
      "CONTEXT_DEV_API_KEY is not set. Add it to .env.local (dev) or the Vercel project env (prod).",
      { errorCode: "MISSING_API_KEY" },
    );
  }
  cachedClient = new ContextDev({ apiKey, maxRetries: 2, timeout: 120_000 });
  return cachedClient;
}

function toContextDevError(err: unknown, operation: string): ContextDevError {
  if (err instanceof ContextDevError) return err;
  if (err instanceof APIConnectionTimeoutError) {
    return new ContextDevError(`${operation}: client timed out waiting for Context.dev`, {
      errorCode: "CLIENT_TIMEOUT",
      retryable: true,
      cause: err,
    });
  }
  if (err instanceof APIError) {
    const body = (err.error ?? {}) as { message?: string; error_code?: string; request_id?: string };
    const status = typeof err.status === "number" ? err.status : undefined;
    const requestId = body.request_id ?? err.headers?.get("x-request-id") ?? undefined;
    return new ContextDevError(`${operation}: ${body.message ?? err.message}`, {
      status,
      errorCode: body.error_code,
      requestId,
      retryable: status === undefined || status === 408 || status === 429 || status >= 500,
      cause: err,
    });
  }
  return new ContextDevError(`${operation}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
}

// Per-instance concurrency gate (Free plan: 2 concurrent requests per org).
const maxConcurrency = Math.max(1, Number(process.env.CONTEXT_DEV_MAX_CONCURRENCY) || 2);
let inFlight = 0;
const waiters: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= maxConcurrency) await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    waiters.shift()?.();
  }
}

async function call<T extends { request_id?: string; key_metadata?: { credits_consumed?: number } }>(
  operation: string,
  fn: (client: ContextDev) => Promise<T>,
): Promise<T> {
  const client = getClient();
  const started = Date.now();
  try {
    const res = await withSlot(() => fn(client));
    console.info(
      `[context.dev] ${operation} ok request_id=${res.request_id ?? "?"} credits=${res.key_metadata?.credits_consumed ?? "?"} ${Date.now() - started}ms`,
    );
    return res;
  } catch (err) {
    const e = toContextDevError(err, operation);
    console.error(
      `[context.dev] ${operation} failed status=${e.status ?? "-"} code=${e.errorCode ?? "-"} request_id=${e.requestId ?? "-"}`,
    );
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Answers — POST /web/answers (10 credits fast / 100 ultra, charged on success)
// ---------------------------------------------------------------------------

export interface AnswerResult<T> {
  data: T;
  /** Pages/records read + URLs cited in `data`. Not a field-by-field citation map. */
  sources: string[];
  /** True when the deadline cut research short; treat null fields as unresolved. */
  partial: boolean;
  requestId: string;
  creditsConsumed?: number;
}

export async function answer<T>(opts: {
  task: string;
  /** Example answer object (NOT JSON Schema). */
  jsonFormat: Record<string, unknown>;
  mode?: "fast" | "ultra";
  /** API-side deadline; can shorten but not extend the mode budget (fast 30s, ultra 50s). */
  timeoutMs?: number;
}): Promise<AnswerResult<T>> {
  const mode = opts.mode ?? "fast";
  const timeoutMs = opts.timeoutMs ?? (mode === "fast" ? 30_000 : 50_000);
  const res = await call("answers", (client) =>
    client.web.answers(
      {
        task: opts.task,
        json_format: opts.jsonFormat,
        mode,
        timeoutOpts: { milliseconds: timeoutMs, behavior: "return-partial" },
        tags: REQUEST_TAGS,
      },
      // Research is slow: at most one retry so a 5xx can't blow the route's maxDuration.
      { timeout: timeoutMs + CLIENT_TIMEOUT_HEADROOM_MS, maxRetries: 1 },
    ),
  );
  return {
    data: res.json_content as T,
    sources: res.sources ?? [],
    partial: res.partial ?? false,
    requestId: res.request_id,
    creditsConsumed: res.key_metadata?.credits_consumed,
  };
}

// ---------------------------------------------------------------------------
// Search — POST /web/search (1 credit per 10 results)
// ---------------------------------------------------------------------------

export interface SearchHit {
  url: string;
  title: string;
  description: string;
  relevance: "high" | "medium" | "low";
}

export async function searchWeb(opts: {
  query: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}): Promise<{ results: SearchHit[]; requestId: string; creditsConsumed?: number }> {
  const res = await call("search", (client) =>
    client.web.search(
      {
        query: opts.query,
        numResults: opts.numResults ?? 5,
        ...(opts.includeDomains?.length ? { includeDomains: opts.includeDomains } : {}),
        ...(opts.excludeDomains?.length ? { excludeDomains: opts.excludeDomains } : {}),
        timeoutOpts: { milliseconds: 20_000, behavior: "return-partial" },
        tags: REQUEST_TAGS,
      },
      { timeout: 20_000 + CLIENT_TIMEOUT_HEADROOM_MS },
    ),
  );
  return {
    results: res.results.map((r) => ({ url: r.url, title: r.title, description: r.description, relevance: r.relevance })),
    requestId: res.request_id,
    creditsConsumed: res.key_metadata?.credits_consumed,
  };
}

// ---------------------------------------------------------------------------
// Scrape — POST /web/scrape: screenshot (+ highlights) as price evidence
// 1 credit base, +1 when highlights return ≥1 passage.
// ---------------------------------------------------------------------------

export interface PageEvidence {
  requestedUrl: string;
  /** Final URL after redirects — cite this one. */
  finalUrl: string;
  title?: string;
  /** `data:image/<fmt>;base64,...` — there is no hosted URL. */
  screenshot: string | null;
  screenshotError?: string;
  /** Passages relevant to `query`, in page order (null when not requested or failed). */
  highlights: string[] | null;
  highlightsError?: string;
  isPartial: boolean;
  cache: { status: string; ageMs: number };
  /** Approximate capture time: now minus cache age. */
  capturedAt: string;
  requestId: string;
  creditsConsumed?: number;
}

export async function capturePageEvidence(opts: {
  url: string;
  /** Question used to pull matching passages (Highlights). Omit for screenshot only. */
  query?: string;
  /** 0 = force a fresh capture. Default 24h. */
  maxAgeMs?: number;
  area?: "viewport" | "fullPage" | { selector: string };
  format?: "png" | "jpeg" | "webp";
  timeoutMs?: number;
}): Promise<PageEvidence> {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const body: WebScrapeParams = {
    url: opts.url,
    formats: { screenshot: true, ...(opts.query ? { highlights: true } : {}) },
    // JPEG viewport keeps payloads small (Vercel caps function responses at 4.5 MB).
    screenshotParams: { area: opts.area ?? "viewport", format: opts.format ?? "jpeg" },
    ...(opts.query ? { highlightsParams: { query: opts.query, maxCharacters: 1500 } } : {}),
    sharedParams: { dismissCookies: true, dismissPopups: true },
    maxAgeMs: opts.maxAgeMs ?? DEFAULT_SCRAPE_MAX_AGE_MS,
    timeoutOpts: { milliseconds: timeoutMs, behavior: "return-partial" },
    tags: REQUEST_TAGS,
  };
  const res = await call("scrape", (client) =>
    client.web.scrape(body, { timeout: timeoutMs + CLIENT_TIMEOUT_HEADROOM_MS }),
  );

  // A 200 can still contain failed outputs: always check `success` before `data`.
  const shot = res.screenshot;
  const hl = res.highlights;
  const ageMs = res.cache_metadata?.age_ms ?? 0;
  return {
    requestedUrl: opts.url,
    finalUrl: res.url || opts.url,
    title: res.metadata?.title,
    screenshot: shot.success ? shot.data : null,
    screenshotError: shot.success === false ? `${shot.error_code ?? "ERROR"}: ${shot.message ?? ""}`.trim() : undefined,
    highlights: hl.success ? (hl.data ?? []) : null,
    highlightsError: hl.success === false ? `${hl.error_code ?? "ERROR"}: ${hl.message ?? ""}`.trim() : undefined,
    isPartial: res.isPartial === true,
    cache: { status: res.cache_metadata?.status ?? "unknown", ageMs },
    capturedAt: new Date(Date.now() - ageMs).toISOString(),
    requestId: res.request_id,
    creditsConsumed: res.key_metadata?.credits_consumed,
  };
}
