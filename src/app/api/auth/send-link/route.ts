import { EMAIL_RE, createSignInLink, safeNext } from "@/lib/magic-link";
import { MailError, sendMail } from "@/lib/primitive";

const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return true;
  recent.push(now);
  hits.set(key, recent);
  return false;
}

// Emails a one-time sign-in link through Primitive.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return Response.json({ error: "That does not look like an email address. Check it and try again." }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (limited(`ip:${ip}`, 12, 3_600_000) || limited(`mail:${email}`, 3, 15 * 60_000)) {
    return Response.json({ error: "Too many sign-in emails requested. Please wait a few minutes and try again." }, { status: 429 });
  }

  try {
    const link = await createSignInLink(email, safeNext(body.next));
    await sendMail({
      to: email,
      subject: "Your Renewal Negotiator sign-in link",
      text: `Hi,\n\nUse this link to sign in to Renewal Negotiator:\n\n${link}\n\nIt works once and expires in an hour. If you did not ask for it, you can ignore this email and nothing will happen.\n\nRenewal Negotiator`,
    });
  } catch (e) {
    console.error("send-link failed", e instanceof MailError ? e.message : e);
    return Response.json({ error: "We could not send the email just now. Please try again in a moment." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
