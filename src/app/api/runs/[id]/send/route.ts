import { EMAIL_OK, sendToVendor } from "@/lib/negotiation";
import { MailError } from "@/lib/primitive";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase-admin";

// The user approves the exact email, then we send it to the vendor. Replies come back to our inbox.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please refresh the page." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // The vendor address was chosen and checked when the run started. The browser cannot change it here.
  const { data: vendorRow } = await supabaseAdmin().from("run_steps").select("text").eq("run_id", id).eq("kind", "vendor").order("id", { ascending: false }).limit(1);
  const to = String(vendorRow?.[0]?.text ?? process.env.DEFAULT_VENDOR_EMAIL ?? "").trim().toLowerCase();
  const text = String(body.body ?? "").trim();
  if (!EMAIL_OK.test(to) || to.length > 200) return Response.json({ error: "No vendor mailbox is configured." }, { status: 500 });
  if (text.length < 20) return Response.json({ error: "The email is empty. Write or keep the draft before sending." }, { status: 400 });
  if (text.length > 6000) return Response.json({ error: "That email is too long. Keep it under 6,000 characters." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: run } = await sb.from("runs").select("status").eq("id", id).eq("user_id", user.id).single();
  if (!run) return Response.json({ error: "We could not find that run." }, { status: 404 });
  if (!["complete", "reply_ready"].includes(run.status)) return Response.json({ error: "This run is not ready to send yet." }, { status: 409 });

  try {
    await sendToVendor(id, to, text);
  } catch (e) {
    if (e instanceof MailError && e.message === "recipient_not_allowed") {
      return Response.json({ error: "Our email service cannot deliver to that address yet. Try an address on a domain you control, or ask us to enable it." }, { status: 422 });
    }
    if (e instanceof MailError && e.message === "max_exchanges") return Response.json({ error: "That is the maximum number of emails for one negotiation." }, { status: 429 });
    console.error("send to vendor failed", e);
    return Response.json({ error: "The email could not be sent. Please try again." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
