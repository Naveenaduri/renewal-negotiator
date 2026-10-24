import { sendInput } from "@/lib/omnara";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase-admin";
import { agentIdFor } from "@/lib/verify";

const MAX_OBJECTIONS = 5;

// "You be the vendor": stores the user's objection and hands it to the same agent, which
// answers as the buyer using only existing receipts.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please refresh the page." }, { status: 401 });

  const text = String((await req.json().catch(() => ({}))).text ?? "").trim();
  if (text.length < 3) return Response.json({ error: "Type the objection you would raise as the vendor." }, { status: 400 });
  if (text.length > 600) return Response.json({ error: "Keep the objection under 600 characters." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: run } = await sb.from("runs").select("id, status").eq("id", id).eq("user_id", user.id).single();
  if (!run) return Response.json({ error: "We could not find that run." }, { status: 404 });
  if (run.status !== "complete") return Response.json({ error: "Wait for the rehearsal to finish first." }, { status: 409 });

  const { count } = await sb.from("messages").select("id", { count: "exact", head: true }).eq("run_id", id).eq("role", "user_vendor");
  if ((count ?? 0) >= MAX_OBJECTIONS) return Response.json({ error: `That is all ${MAX_OBJECTIONS} objections for this run.` }, { status: 429 });

  const agent = await agentIdFor(id);
  if (!agent) return Response.json({ error: "This run has no agent to answer." }, { status: 409 });

  await sb.from("messages").insert({ run_id: id, role: "user_vendor", round: 4, text });
  try {
    await sendInput(agent, `OBJECTION: ${text}`);
  } catch (e) {
    console.error("objection failed", e);
    return Response.json({ error: "The buyer agent could not be reached. Please try again." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
