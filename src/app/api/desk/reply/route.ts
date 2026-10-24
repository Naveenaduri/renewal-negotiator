import { BOXES, deskOk, denied } from "@/lib/desk";
import { MailError, getEmail, sendMail } from "@/lib/primitive";

// Reply as the vendor. The subject keeps the [RN-...] tag, which is how the app matches the reply to its run.
export async function POST(req: Request) {
  if (!deskOk(req)) return denied();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const text = String(body.body ?? "").trim();
  if (!/^[0-9a-f-]{20,}$/i.test(id)) return Response.json({ error: "Pick a message to reply to." }, { status: 400 });
  if (text.length < 5) return Response.json({ error: "Write your reply first." }, { status: 400 });
  if (text.length > 6000) return Response.json({ error: "Keep the reply under 6,000 characters." }, { status: 400 });
  try {
    const m = await getEmail(id);
    if (m.to !== BOXES.vendor) return Response.json({ error: "You can only reply from the vendor desk." }, { status: 403 });
    const subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
    await sendMail({ from: BOXES.vendor, to: m.from, subject, text });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("desk reply failed", e instanceof MailError ? e.message : e);
    return Response.json({ error: "The reply could not be sent. Please try again." }, { status: 502 });
  }
}
