import { HELPER_PY } from "@/lib/agent/instruction";

// Serves the agent's sandbox helper so the model does not have to type it out (faster first stage).
// It contains no secrets: the helper reads them from the sandbox environment.
export function GET() {
  return new Response(HELPER_PY, { headers: { "Content-Type": "text/x-python; charset=utf-8", "Cache-Control": "no-store" } });
}
