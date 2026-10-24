import { supabaseAdmin, userFromRequest } from "@/lib/supabase-admin";
import { finalizeRun, reapIfStale } from "@/lib/verify";

export const maxDuration = 120;

// Idempotent nudge the page sends while it watches a run. It finishes verification if the
// server-side watcher has not, and stops runs that have gone on too long.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please refresh the page." }, { status: 401 });
  const { data: run } = await supabaseAdmin().from("runs").select("id, status").eq("id", id).eq("user_id", user.id).single();
  if (!run) return Response.json({ error: "We could not find that run." }, { status: 404 });

  if (await reapIfStale(id)) return Response.json({ status: "failed" });
  if (run.status === "agent_done") return Response.json({ status: await finalizeRun(id) });
  return Response.json({ status: run.status });
}
