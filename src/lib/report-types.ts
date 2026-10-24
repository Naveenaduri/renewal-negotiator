// Client-safe types for the research report (no server imports here).

export type PriceKind = "vendor" | "alternative";

/**
 * verified  — screenshot captured AND the price text was found on the source page
 * captured  — screenshot captured, but the price text was not matched in page passages (check the image)
 * unsourced — no source URL could be found for this price
 * not_captured — source URL known, but no screenshot (capture failed or over the evidence cap)
 */
export type EvidenceStatus = "verified" | "captured" | "unsourced" | "not_captured";

export interface PricePoint {
  id: string;
  kind: PriceKind;
  product: string;
  plan: string;
  /** Price exactly as published, e.g. "$10", "€8.50". null = not public (e.g. "Contact sales"). */
  price: string | null;
  billingPeriod: string | null;
  sourceUrl: string | null;
  sourceOrigin: "answers" | "pricing_page" | "search" | null;
  evidenceId: string | null;
  status: EvidenceStatus;
  note?: string;
}

export interface EvidenceItem {
  id: string;
  url: string;
  title?: string;
  screenshot: string | null;
  highlights: string[];
  capturedAt: string;
  cacheStatus: string;
  requestId: string;
  error?: string;
}

export interface Alternative {
  name: string;
  website: string | null;
  whyRelevant: string | null;
}

export interface RenewalReport {
  vendor: { name: string; website: string | null; pricingPageUrl: string | null };
  generatedAt: string;
  pricePoints: PricePoint[];
  alternatives: Alternative[];
  evidence: Record<string, EvidenceItem>;
  negotiationLevers: string[];
  /** URLs Answers read/cited while researching. */
  researchSources: string[];
  warnings: string[];
  creditsConsumed: number;
}
