// Server only. The real-email half of a run: send the negotiated email to the vendor, pick up
// their reply, hand it to the buyer agent, and close the deal when an offer beats the current price.
import { createSignInLink } from "./magic-link";
import { sendInput } from "./omnara";
import { MailError, getEmailBody, listInbound, sendMail, stripQuoted } from "./primitive";
import { winEmail } from "./result-email";
import { supabaseAdmin } from "./supabase-admin";
import { agentIdFor } from "./verify";

export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EXCHANGES = 5;
const token = (runId: string) => `[RN-${runId.slice(0, 8)}]`;

type Offer = {
  kind?: "offer" | "counter" | "question" | "decline";
  offer_price_annual?: number | null;
  offer_quote?: string;
  summary?: string;
  leverage?: string;
  suggested_reply?: string;
  accept?: boolean;
};

async function step(runId: string, lane: string, kind: string, text: string) {
  await supabaseAdmin().from("run_steps").insert({ run_id: runId, lane, kind, text });
}

async function lastSent(runId: string): Promise<{ to: string; at: string } | null> {
  const { data } = await supabaseAdmin().from("run_steps").select("text").eq("run_id", runId).eq("lane", "mail").eq("kind", "sent").order("id", { ascending: false }).limit(1);
  try {
    return data?.[0] ? JSON.parse(data[0].text) : null;
  } catch {
    return null;
  }
}

// Sends one email to the vendor. The user has approved the exact text.
export async function sendToVendor(runId: string, to: string, body: string): Promise<void> {
  const sb = supabaseAdmin();
  const { data: run } = await sb.from("runs").select("deal_id, user_id").eq("id", runId).single();
  const { data: deal } = await sb.from("deals").select("vendor").eq("id", run!.deal_id).single();
  const { data: sent } = await sb.from("run_steps").select("id").eq("run_id", runId).eq("lane", "mail").eq("kind", "sent");
  if ((sent?.length ?? 0) >= MAX_EXCHANGES) throw new MailError("max_exchanges");
  const { data: u } = await sb.auth.admin.getUserById(run!.user_id);
  const subject = `Renewal ${deal?.vendor ?? "request"} ${token(runId)}`;
  const footer = `\n\n--\nSent on behalf of ${u.user?.email ?? "the account holder"} by Renewal Negotiator. Reply to this email and it reaches them.`;
  await sendMail({ to, subject, text: body.trim() + footer });
  await step(runId, "mail", "sent", JSON.stringify({ to: to.toLowerCase(), at: new Date().toISOString(), n: (sent?.length ?? 0) + 1 }));
  await sb.from("runs").update({ status: "awaiting_vendor" }).eq("id", runId);
}

// Looks for the vendor's reply. When found, shows it in the chat and hands it to the buyer agent.
export async function checkVendorReply(runId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data: run } = await sb.from("runs").select("status").eq("id", runId).single();
  if (run?.status !== "awaiting_vendor") return run?.status ?? "unknown";
  const sent = await lastSent(runId);
  if (!sent) return "awaiting_vendor";

  const since = new Date(sent.at).getTime() - 5_000;
  const tag = token(runId).toLowerCase();
  const rows = await listInbound(25);
  const hit = rows.find((r) => r.sender === sent.to && r.subject.toLowerCase().includes(tag) && new Date(r.received_at).getTime() >= since);
  if (!hit) return "awaiting_vendor";

  const { data: seen } = await sb.from("run_steps").select("id").eq("run_id", runId).eq("lane", "mail").eq("kind", "received").eq("text", hit.id).limit(1);
  if (seen?.length) return "awaiting_vendor";

  // Claim it exactly once.
  const { data: claimed } = await sb.from("runs").update({ status: "negotiating" }).eq("id", runId).eq("status", "awaiting_vendor").select("id");
  if (!claimed?.length) return "negotiating";
  await step(runId, "mail", "received", hit.id);

  const text = stripQuoted(await getEmailBody(hit.id)).slice(0, 4000) || hit.snippet || "(empty reply)";
  await sb.from("messages").insert({ run_id: runId, role: "user_vendor", round: 5, text });
  const agent = await agentIdFor(runId);
  if (!agent) {
    await sb.from("runs").update({ status: "complete" }).eq("id", runId);
    return "complete";
  }
  try {
    await sendInput(agent, `VENDOR_REPLY: ${text}`);
  } catch (e) {
    console.error("could not hand the reply to the agent", e);
    await step(runId, "system", "error", "The buyer agent could not be reached. Please try again.");
    await sb.from("runs").update({ status: "awaiting_vendor" }).eq("id", runId);
  }
  return "negotiating";
}

// After the agent has read the reply: either the deal is won, or a counter-draft is ready for the user.
export async function reviewOffer(runId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data: run } = await sb.from("runs").select("status, deal_id, user_id").eq("id", runId).single();
  if (run?.status === "negotiating") {
    // The agent has a few minutes to read the reply before we hand control back.
    const { data: last } = await sb.from("messages").select("created_at").eq("run_id", runId).eq("role", "user_vendor").order("id", { ascending: false }).limit(1);
    if (last?.[0] && Date.now() - new Date(last[0].created_at).getTime() > 4 * 60_000) {
      await step(runId, "system", "error", "The buyer took too long to answer. You can write your own reply below.");
      await sb.from("runs").update({ status: "reply_ready" }).eq("id", runId).eq("status", "negotiating");
      return "reply_ready";
    }
    return "negotiating";
  }
  if (run?.status !== "vendor_reviewed") return run?.status ?? "unknown";

  const { data: rows } = await sb.from("messages").select("text").eq("run_id", runId).eq("role", "judge").eq("round", 9).order("id", { ascending: false }).limit(1);
  let offer: Offer = {};
  try {
    offer = JSON.parse(rows?.[0]?.text ?? "{}");
  } catch {
    offer = {};
  }
  const { data: vend } = await sb.from("messages").select("text").eq("run_id", runId).eq("role", "user_vendor").eq("round", 5).order("id", { ascending: false }).limit(1);
  const vendorText = vend?.[0]?.text ?? "";
  const { data: deal } = await sb.from("deals").select("vendor, price, renewal_date").eq("id", run.deal_id).single();
  const was = Number(deal?.price ?? 0);
  const now = Number(offer.offer_price_annual ?? 0);

  // A win needs the vendor's own words (the agent's quote must really appear in their reply)
  // and a price that beats what the user pays today.
  const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const quoteOk = !!offer.offer_quote && squash(vendorText).includes(squash(offer.offer_quote));
  if (offer.accept && was > 0 && now > 0 && now < was && quoteOk) {
    const { data: flipped } = await sb.from("runs").update({ status: "deal_done" }).eq("id", runId).eq("status", "vendor_reviewed").select("id");
    if (!flipped?.length) return "deal_done";
    await sb.from("deals").update({ est_saving: Math.round(was - now), status: "won" }).eq("id", run.deal_id);
    await step(runId, "mail", "won", JSON.stringify({ was, now }));
    await emailWin(runId, run.user_id, { vendor: deal?.vendor ?? "your vendor", was, now, quote: offer.offer_quote ?? vendorText.slice(0, 280), reply: offer.suggested_reply ?? "", renews: deal?.renewal_date ?? null, to: (await lastSent(runId))?.to ?? "the vendor" }).catch((e) => console.error("win email failed", e));
    return "deal_done";
  }
  await sb.from("runs").update({ status: "reply_ready" }).eq("id", runId).eq("status", "vendor_reviewed");
  return "reply_ready";
}

async function emailWin(runId: string, userId: string, f: { vendor: string; was: number; now: number; quote: string; reply: string; renews: string | null; to: string }) {
  const sb = supabaseAdmin();
  const { data: u } = await sb.auth.admin.getUserById(userId);
  const email = u.user?.email;
  if (!email || u.user?.is_anonymous) {
    await step(runId, "system", "note", "Sign in next time to get the winning email in your inbox.");
    return;
  }
  const link = await createSignInLink(email, `/run/${runId}`);
  const renews = f.renews ? new Date(f.renews + "T00:00").toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : null;
  const mail = winEmail({ vendor: f.vendor, was: f.was, now: f.now, quote: f.quote, vendorEmail: f.to, reply: f.reply, renews, link });
  await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html, idempotencyKey: `win-${runId}` });
  await step(runId, "system", "emailed", `Winning email sent to ${email}`);
}
