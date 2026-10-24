// Server-side only. Every Context.dev call in the app goes through this module.
// The key is read from CONTEXT_DEV_API_KEY and must never reach a browser bundle.
import ContextDev from "context.dev";

let client: ContextDev | null = null;

function getClient(): ContextDev {
  if (!process.env.CONTEXT_DEV_API_KEY) {
    throw new Error("CONTEXT_DEV_API_KEY is not set");
  }
  // The SDK retries 408/429/5xx with backoff and honors Retry-After.
  client ??= new ContextDev({ maxRetries: 2, timeout: 60_000 });
  return client;
}

export type ScrapeResult = {
  url: string;
  markdown: string | null;
  screenshot: string | null;
  fetchedAt: string;
  requestId: string;
  creditsUsed: number | null;
};

// Fetch one page as markdown, optionally with a screenshot (used for receipts).
// maxAgeMs defaults to 0 so a receipt always reflects a fresh fetch.
export async function scrapePage(
  url: string,
  opts: { screenshot?: boolean; maxAgeMs?: number } = {},
): Promise<ScrapeResult> {
  const res = await getClient().web.scrape({
    url,
    formats: { markdown: true, screenshot: opts.screenshot ?? false },
    maxAgeMs: opts.maxAgeMs ?? 0,
  });
  return {
    url,
    markdown: res.markdown?.success ? res.markdown.data : null,
    screenshot: res.screenshot?.success ? res.screenshot.data : null,
    fetchedAt: new Date().toISOString(),
    requestId: res.request_id,
    creditsUsed: res.key_metadata?.credits_consumed ?? null,
  };
}

export type SearchHit = { title: string; url: string; snippet: string };

// Find public pages, e.g. a vendor's pricing page or alternatives.
export async function searchWeb(
  query: string,
  opts: { numResults?: number; includeDomains?: string[] } = {},
): Promise<SearchHit[]> {
  const res = await getClient().web.search({
    query,
    numResults: opts.numResults ?? 5,
    includeDomains: opts.includeDomains,
  });
  return res.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}
