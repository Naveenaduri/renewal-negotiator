import { omnaraReachable } from "@/lib/omnara";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function check(fn: () => Promise<unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "failed" };
  }
}

// Database, agent platform and research key. Add ?deep=1 to also spend one tiny model call.
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const [database, agents] = await Promise.all([
    check(async () => {
      const { error } = await supabaseAdmin().from("deals").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw error;
    }),
    check(omnaraReachable),
  ]);
  const research = process.env.CONTEXT_DEV_API_KEY ? { ok: true } : { ok: false, error: "key missing" };
  const model = deep
    ? await check(async () => {
        const { launchAgent, cancelAgent } = await import("@/lib/omnara");
        const id = await launchAgent("health-check", "Health check. Reply with the single word OK and do nothing else. Do not run any commands.");
        await cancelAgent(id);
      })
    : { ok: true, note: "not exercised; add ?deep=1" };
  const ok = database.ok && agents.ok && research.ok && model.ok;
  return Response.json({ ok, database, agents, research, model }, { status: ok ? 200 : 503 });
}
