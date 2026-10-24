// Server only. Email in and out through Primitive. Docs: https://docs.primitive.dev
const BASE = "https://api.primitive.dev/v1";

export class MailError extends Error {}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Sends an email from our managed address. Callers only send to the signed-in user or to a vendor address the user approved.
export async function sendMail(opts: { from?: string; to: string; subject: string; text: string; html?: string; replyTo?: string; idempotencyKey?: string }): Promise<void> {
  const key = process.env.PRIMITIVE_API_KEY;
  if (!key) throw new MailError("PRIMITIVE_API_KEY is not set");
  const r = await fetch(`${BASE}/send-mail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: opts.from ?? process.env.PRIMITIVE_FROM ?? "hello@vast-crane.primitive.email",
      to: opts.to,
      subject: opts.subject,
      body_text: opts.text,
      ...(opts.html ? { body_html: opts.html } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      wait: true,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) {
    const code = j.error?.code ?? r.status;
    throw new MailError(code === "recipient_not_allowed" ? "recipient_not_allowed" : `Primitive send failed: ${code} ${JSON.stringify(j.error ?? j).slice(0, 200)}`);
  }
  const status = j.data?.delivery_status ?? j.data?.status;
  if (status && !["delivered", "queued", "accepted", "sent"].includes(status)) {
    throw new MailError(`Primitive did not deliver the email: ${status}`);
  }
}

export type InboundRow = { id: string; sender: string; to: string; subject: string; received_at: string; snippet?: string };

async function get<T>(path: string): Promise<T> {
  const key = process.env.PRIMITIVE_API_KEY;
  if (!key) throw new MailError("PRIMITIVE_API_KEY is not set");
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new MailError(`Primitive read failed: ${r.status}`);
  return j.data as T;
}

// Newest mail first. Used to pick up the vendor's reply.
export async function listInbound(limit = 25): Promise<InboundRow[]> {
  const rows = await get<{ id: string; from_email?: string; sender?: string; to_email?: string; recipient?: string; subject?: string; received_at: string; snippet?: string }[]>(`/emails?limit=${limit}`);
  return rows.map((r) => ({ id: r.id, sender: (r.from_email ?? r.sender ?? "").toLowerCase(), to: (r.to_email ?? r.recipient ?? "").toLowerCase(), subject: r.subject ?? "", received_at: r.received_at, snippet: r.snippet }));
}

export async function getEmailBody(id: string): Promise<string> {
  const e = await get<{ body_text?: string | null; parsed?: { body_text?: string | null } }>(`/emails/${id}`);
  return e.body_text ?? e.parsed?.body_text ?? "";
}

// Drops the quoted history so only the sender's new words remain.
export function stripQuoted(body: string): string {
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^On .{5,120} wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line)) break;
    if (/^From:\s.+@/i.test(line) && out.length > 0) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export type FullEmail = { id: string; from: string; to: string; subject: string; text: string; html: string | null; received_at: string };

// One stored email with its body, for the mail desk.
export async function getEmail(id: string): Promise<FullEmail> {
  const e = await get<{ id: string; sender?: string; from_email?: string; recipient?: string; to_email?: string; subject?: string; body_text?: string | null; body_html?: string | null; parsed?: { body_text?: string | null; body_html?: string | null }; received_at: string }>(`/emails/${id}`);
  return {
    id: e.id,
    from: (e.from_email ?? e.sender ?? "").toLowerCase(),
    to: (e.to_email ?? e.recipient ?? "").toLowerCase(),
    subject: e.subject ?? "",
    text: e.body_text ?? e.parsed?.body_text ?? "",
    html: e.body_html ?? e.parsed?.body_html ?? null,
    received_at: e.received_at,
  };
}
