import { badRequest, errorResponse } from "@/lib/api-errors";
import { researchRenewal } from "@/lib/negotiator";
import type { RenewalReport } from "@/lib/report-types";

// Answers (≤30s fast) + search fallback + 2-at-a-time screenshots.
export const maxDuration = 120;

/** Vercel caps function responses at 4.5 MB; drop screenshots (largest first) beyond this budget. */
const RESPONSE_BUDGET_BYTES = 4_000_000;

function fitPayload(report: RenewalReport): RenewalReport {
  let size = JSON.stringify(report).length;
  if (size <= RESPONSE_BUDGET_BYTES) return report;
  const items = Object.values(report.evidence).sort((a, b) => (b.screenshot?.length ?? 0) - (a.screenshot?.length ?? 0));
  for (const item of items) {
    if (size <= RESPONSE_BUDGET_BYTES || !item.screenshot) break;
    size -= item.screenshot.length;
    item.screenshot = null;
    item.error = "Screenshot omitted to fit the response size limit; re-capture it via /api/evidence.";
  }
  report.warnings.push("Some screenshots were omitted to stay under the response size limit.");
  return report;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const vendor = typeof body.vendor === "string" ? body.vendor.trim() : "";
  if (!vendor || vendor.length > 100) return badRequest("`vendor` is required (1-100 chars).");
  const domain = typeof body.domain === "string" && body.domain.trim() ? body.domain.trim().slice(0, 200) : undefined;
  const currentDeal = typeof body.currentDeal === "string" && body.currentDeal.trim() ? body.currentDeal.trim() : undefined;
  const maxEvidence = typeof body.maxEvidence === "number" ? body.maxEvidence : undefined;

  try {
    const report = await researchRenewal({ vendor, domain, currentDeal, maxEvidence, fresh: body.fresh === true });
    return Response.json(fitPayload(report));
  } catch (err) {
    return errorResponse(err);
  }
}
