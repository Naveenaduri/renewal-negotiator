import { checkVendorReply, reviewOffer } from "@/lib/negotiation";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase-admin";

export const maxDuration = 60;

// Idempotent nudge from the page while it waits on the vendor: picks up their reply,
// and moves the run on once the buyer agent has read it.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please refresh the page." }, { status: 401 });
  const { data: run } = await supabaseAdmin().from("runs").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!run) return Response.json({ error: "We could not find that run." }, { status: 404 });
  try {
    const a = await checkVendorReply(id);
    const b = a === "negotiating" || a === "vendor_reviewed" ? await reviewOffer(id) : a;
    return Response.json({ status: b });
  } catch (e) {
    console.error("vendor-check failed", e);
    return Response.json({ error: "Could not check for a reply just now." }, { status: 502 });
  }
}
