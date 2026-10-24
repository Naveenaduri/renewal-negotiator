import { sendInput } from "@/lib/omnara";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase-admin";
import { agentIdFor } from "@/lib/verify";

type Action = "approve" | "feedback" | "autopilot";

// The human's answer at a checkpoint. Resumes the same agent exactly where it paused.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please refresh the page." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as Action;
  const text = String(body.text ?? "").trim();
  if (!["approve", "feedback", "autopilot"].includes(action)) return Response.json({ error: "Unknown action." }, { status: 400 });
  if (action === "feedback" && text.length < 3) return Response.json({ error: "Type your guidance first, or choose Approve." }, { status: 400 });
  if (text.length > 600) return Response.json({ error: "Keep guidance under 600 characters." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: run } = await sb.from("runs").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!run) return Response.json({ error: "We could not find that run." }, { status: 404 });

  // Only one answer counts: flip awaiting_approval -> running atomically.
  const { data: flipped } = await sb.from("runs").update({ status: "running" }).eq("id", id).eq("status", "awaiting_approval").select("id");
  if (!flipped?.length) return Response.json({ error: "Nothing is waiting for you right now." }, { status: 409 });

  const agent = await agentIdFor(id);
  if (!agent) {
    await sb.from("runs").update({ status: "awaiting_approval" }).eq("id", id);
    return Response.json({ error: "This run has no agent to continue." }, { status: 409 });
  }

  const message = action === "approve" ? "APPROVED" : action === "autopilot" ? "AUTOPILOT" : `FEEDBACK: ${text}`;
  const label = action === "approve" ? "You approved this step." : action === "autopilot" ? "You switched to autopilot." : `You said: ${text}`;
  await sb.from("run_steps").insert({ run_id: id, lane: "human", kind: action, text: label });
  try {
    await sendInput(agent, message);
  } catch (e) {
    console.error("gate input failed", e);
    await sb.from("runs").update({ status: "awaiting_approval" }).eq("id", id);
    return Response.json({ error: "The agents could not be reached. Please try again." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
