import { badRequest, errorResponse, parseHttpUrl } from "@/lib/api-errors";
import { capturePageEvidence } from "@/lib/context-dev";

export const maxDuration = 60;

/**
 * Capture (or re-capture) price evidence for one URL: screenshot + passages matching `query`.
 * Body: { url: string, query?: string, fresh?: boolean, fullPage?: boolean }
 * Cost: 1 credit (+1 when highlights return passages).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const url = parseHttpUrl(body.url);
  if (!url) return badRequest("`url` must be an absolute http(s) URL.");
  const query = typeof body.query === "string" && body.query.trim() ? body.query.trim().slice(0, 2000) : undefined;

  try {
    const evidence = await capturePageEvidence({
      url,
      query,
      maxAgeMs: body.fresh === true ? 0 : undefined,
      area: body.fullPage === true ? "fullPage" : "viewport",
    });
    return Response.json(evidence);
  } catch (err) {
    return errorResponse(err);
  }
}
