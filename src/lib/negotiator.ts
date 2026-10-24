/**
 * Renewal research pipeline. Uses ONLY the Context.dev wrapper (`@/lib/context-dev`).
 *
 *   1. Answers (fast)  → vendor plans + alternatives, each price with a cited source_url
 *   2. Search          → fallback source URL for prices Answers couldn't cite
 *   3. Scrape          → screenshot + Highlights for every unique source URL (evidence)
 */
import "server-only";

import { answer, capturePageEvidence, searchWeb, type PageEvidence } from "@/lib/context-dev";
import type { Alternative, EvidenceItem, PricePoint, RenewalReport } from "@/lib/report-types";

export interface ResearchInput {
  vendor: string;
  /** Vendor website/domain if known — focuses research. */
  domain?: string;
  /** What the customer pays today; used only as context for negotiation levers. */
  currentDeal?: string;
  /** Max unique URLs to screenshot (each ≈ 1–2 credits). Default 4, max 8. */
  maxEvidence?: number;
  /** Force fresh captures (maxAgeMs: 0) instead of accepting ≤24h cache. */
  fresh?: boolean;
}

/** Shape requested from Answers (example object, not JSON Schema). */
export interface AnswersPricing {
  vendor?: { name?: string | null; website?: string | null; pricing_page_url?: string | null } | null;
  plans?: Array<{ name?: string | null; price?: string | null; billing_period?: string | null; source_url?: string | null }> | null;
  alternatives?: Array<{
    name?: string | null;
    website?: string | null;
    plan_name?: string | null;
    price?: string | null;
    billing_period?: string | null;
    source_url?: string | null;
    why_relevant?: string | null;
  }> | null;
  negotiation_levers?: Array<string | null> | null;
}

export const PRICING_JSON_FORMAT = {
  vendor: { name: "", website: "", pricing_page_url: "" },
  plans: [{ name: "", price: "", billing_period: "", source_url: "" }],
  alternatives: [
    { name: "", website: "", plan_name: "", price: "", billing_period: "", source_url: "", why_relevant: "" },
  ],
  negotiation_levers: [""],
};

export function buildTask(input: ResearchInput): string {
  const site = input.domain ? ` (website: ${input.domain})` : "";
  const deal = input.currentDeal ? ` The customer currently pays: ${input.currentDeal.slice(0, 300)}.` : "";
  return [
    `Research public list pricing for the software vendor "${input.vendor}"${site}, for a customer preparing a renewal negotiation.${deal}`,
    "Read the vendor's official pricing page. List each plan with its list price exactly as published (keep the currency symbol) and its billing period, and set source_url to the exact page URL where that price appears.",
    "Then find 3 credible alternative products. For each, give its cheapest comparable paid plan and price, with source_url set to the page showing that price (prefer the alternative's own pricing page).",
    "Use null for any price that is not publicly listed (e.g. 'Contact sales'). Never guess prices.",
    "Finally, list 3-5 short negotiation levers grounded in the pricing you found (annual discounts, cheaper tiers, competitor prices).",
  ].join(" ");
}

const clean = (v: string | null | undefined): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.toLowerCase() !== "null" ? s : null;
};

const toHttpUrl = (v: string | null | undefined): string | null => {
  const s = clean(v);
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Pull numeric amounts out of a price string: "$1,299.00/mo" → ["1299", "1299.00"]. */
export function priceTokens(price: string): string[] {
  const out = new Set<string>();
  for (const m of price.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/,/g, "");
    out.add(raw);
    out.add(raw.replace(/\.0+$/, ""));
  }
  return [...out].filter(Boolean);
}

/** True when any numeric token of `price` appears as a standalone number in the passages. */
export function priceAppearsIn(price: string, passages: string[]): boolean {
  const tokens = priceTokens(price);
  if (!tokens.length) return false;
  const text = passages.join("\n").replace(/(\d),(\d)/g, "$1$2");
  return tokens.some((t) => new RegExp(`(^|[^\\d.])${t.replace(".", "\\.")}(?![\\d])`).test(text));
}

export async function researchRenewal(input: ResearchInput): Promise<RenewalReport> {
  const warnings: string[] = [];
  let credits = 0;
  const maxEvidence = Math.min(Math.max(input.maxEvidence ?? 4, 1), 8);

  // 1) Answers: structured pricing with cited sources.
  const research = await answer<AnswersPricing>({ task: buildTask(input), jsonFormat: PRICING_JSON_FORMAT, mode: "fast" });
  credits += research.creditsConsumed ?? 0;
  if (research.partial) warnings.push("Research hit its deadline; some prices may be missing (partial answer).");

  const data = research.data ?? {};
  const vendorName = clean(data.vendor?.name) ?? input.vendor;
  const vendorWebsite = toHttpUrl(data.vendor?.website) ?? toHttpUrl(input.domain);
  const pricingPageUrl = toHttpUrl(data.vendor?.pricing_page_url);

  const points: PricePoint[] = [];
  for (const p of data.plans ?? []) {
    const plan = clean(p?.name);
    if (!plan) continue;
    const cited = toHttpUrl(p?.source_url);
    const sourceUrl = cited ?? pricingPageUrl;
    points.push({
      id: `v${points.length}`,
      kind: "vendor",
      product: vendorName,
      plan,
      price: clean(p?.price),
      billingPeriod: clean(p?.billing_period),
      sourceUrl,
      sourceOrigin: cited ? "answers" : sourceUrl ? "pricing_page" : null,
      evidenceId: null,
      status: "unsourced",
    });
  }
  const alternatives: Alternative[] = [];
  for (const a of data.alternatives ?? []) {
    const name = clean(a?.name);
    if (!name) continue;
    alternatives.push({ name, website: toHttpUrl(a?.website), whyRelevant: clean(a?.why_relevant) });
    const cited = toHttpUrl(a?.source_url);
    points.push({
      id: `a${points.length}`,
      kind: "alternative",
      product: name,
      plan: clean(a?.plan_name) ?? "Starting plan",
      price: clean(a?.price),
      billingPeriod: clean(a?.billing_period),
      sourceUrl: cited,
      sourceOrigin: cited ? "answers" : null,
      evidenceId: null,
      status: "unsourced",
    });
  }

  // 2) Search fallback: one query per product whose priced rows have no source URL.
  const needSource = [...new Set(points.filter((p) => p.price && !p.sourceUrl).map((p) => p.product))];
  for (const product of needSource) {
    try {
      const found = await searchWeb({ query: `${product} pricing plans`, numResults: 3 });
      credits += found.creditsConsumed ?? 0;
      const hit = found.results.find((r) => /pric/i.test(r.url + r.title)) ?? found.results[0];
      if (!hit) continue;
      for (const p of points) {
        if (p.product === product && !p.sourceUrl) {
          p.sourceUrl = hit.url;
          p.sourceOrigin = "search";
        }
      }
    } catch (err) {
      warnings.push(`Could not search for a ${product} pricing page: ${(err as Error).message}`);
    }
  }

  // 3) Evidence: screenshot + highlights for each unique source URL (vendor rows first).
  const byUrl = new Map<string, PricePoint[]>();
  for (const p of points) {
    if (!p.sourceUrl) continue;
    byUrl.set(p.sourceUrl, [...(byUrl.get(p.sourceUrl) ?? []), p]);
  }
  const urls = [...byUrl.keys()];
  const toCapture = urls.slice(0, maxEvidence);
  if (urls.length > toCapture.length) {
    warnings.push(`Captured ${toCapture.length} of ${urls.length} source pages (maxEvidence=${maxEvidence}).`);
  }

  const evidence: Record<string, EvidenceItem> = {};
  const captures = await Promise.allSettled(
    toCapture.map((url) => {
      const rows = byUrl.get(url)!;
      const plans = rows.map((r) => r.plan).join(", ");
      return capturePageEvidence({
        url,
        query: `What is the price of the ${plans} plan${rows.length > 1 ? "s" : ""} of ${rows[0].product}?`,
        maxAgeMs: input.fresh ? 0 : undefined,
      });
    }),
  );

  captures.forEach((result, i) => {
    const url = toCapture[i];
    const id = `e${i}`;
    let ev: PageEvidence | null = null;
    if (result.status === "fulfilled") {
      ev = result.value;
      credits += ev.creditsConsumed ?? 0;
      evidence[id] = {
        id,
        url: ev.finalUrl,
        title: ev.title,
        screenshot: ev.screenshot,
        highlights: ev.highlights ?? [],
        capturedAt: ev.capturedAt,
        cacheStatus: ev.cache.status,
        requestId: ev.requestId,
        error: ev.screenshotError,
      };
    } else {
      warnings.push(`Capture failed for ${url}: ${(result.reason as Error)?.message ?? result.reason}`);
    }
    for (const p of byUrl.get(url)!) {
      if (!ev) continue;
      p.evidenceId = id;
      p.sourceUrl = ev.finalUrl;
    }
  });

  for (const p of points) {
    const ev = p.evidenceId ? evidence[p.evidenceId] : undefined;
    if (!p.sourceUrl) p.status = "unsourced";
    else if (!ev?.screenshot) p.status = "not_captured";
    else if (p.price && priceAppearsIn(p.price, ev.highlights)) p.status = "verified";
    else p.status = "captured";
    if (!p.price) p.note = "No public price listed";
  }

  return {
    vendor: { name: vendorName, website: vendorWebsite, pricingPageUrl },
    generatedAt: new Date().toISOString(),
    pricePoints: points,
    alternatives,
    evidence,
    negotiationLevers: (data.negotiation_levers ?? []).map((l) => clean(l)).filter((l): l is string => !!l),
    researchSources: research.sources,
    warnings,
    creditsConsumed: credits,
  };
}
