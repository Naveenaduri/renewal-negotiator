import "server-only";

import { ContextDevError } from "@/lib/context-dev";

/** Map wrapper errors to HTTP responses without leaking secrets; always surface request_id for support/feedback. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ContextDevError) {
    const status =
      err.errorCode === "MISSING_API_KEY" ? 500
      : err.status === 402 ? 402 // out of credits
      : err.status === 429 ? 429
      : err.status === 408 || err.errorCode === "CLIENT_TIMEOUT" ? 504
      : 502;
    return Response.json(
      { error: err.message, code: err.errorCode ?? null, requestId: err.requestId ?? null, retryable: err.retryable },
      { status },
    );
  }
  console.error(err);
  return Response.json({ error: "Internal error" }, { status: 500 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function parseHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
