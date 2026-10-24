"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Bubble, Cite, ReceiptCard, type Receipt, type Side } from "@/components/chat";
import FinalPanel from "@/components/FinalPanel";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import { Check, CountUp } from "@/components/motion";
import { useRun, type Message } from "@/hooks/useRun";
import { ensureSession, supabaseBrowser } from "@/lib/supabase";

const SIDE: Record<string, Side> = { buyer: "buyer", vendor_sim: "vendor", user_vendor: "you" };

function split(text: string) {
  const cites = [...new Set([...text.matchAll(/\[R(\d+)\]/g)].map((m) => m[1]))];
  return { clean: text.replace(/\s*\[R\d+\]/g, "").trim(), cites };
}

const host = (u: string) => {
  try {
    return new URL(u).host.replace(/^www\./, "") + new URL(u).pathname.replace(/\/$/, "");
  } catch {
    return u;
  }
};

export default function Run() {
  const { id } = useParams<{ id: string }>();
  const { run, deal, steps, messages, receipts, judge, offer, sentTo, gate, error, loaded, initialIds, reload } = useRun(id);
  const [guidance, setGuidance] = useState("");
  const [gating, setGating] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const has = (lane: string, kind: string) => steps.some((s) => s.lane === lane && s.kind === kind);
  const lastText = (lane: string) => [...steps].reverse().find((s) => s.lane === lane)?.text;
  const status = run?.status ?? "queued";
  const complete = status === "complete";
  const paused = status === "awaiting_approval";
  const failed = status === "failed";

  const agents = [
    { name: "Extractor", done: has("extractor", "done"), lane: "extractor" },
    { name: "Researcher", done: has("researcher", "done"), lane: "researcher" },
    { name: "Buyer and vendor sim", done: has("judge", "start") || !!judge, lane: "buyer" },
    { name: "Judge", done: has("judge", "done") || !!judge, lane: "judge" },
    { name: "Verifier", done: has("verifier", "done") || complete, lane: "verifier" },
  ];
  const activeIdx = agents.findIndex((a) => !a.done);
  const pct = complete ? 100 : Math.round((agents.filter((a) => a.done).length / agents.length) * 100);

  const receiptList: Receipt[] = receipts.map((r, i) => ({
    id: `R${i + 1}`,
    claim: r.claim,
    source: host(r.source_url),
    href: r.source_url,
    fetched: new Date(r.fetched_at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    screenshot: r.screenshot_url,
  }));
  const verifiedFor = (i: number): boolean | null => (complete || has("verifier", "done") ? !!receipts[i].verified : null);

  const verifiedByLabel = useMemo(() => new Map(receipts.map((r, i) => [`R${i + 1}`, r.verified])), [receipts]);

  const talk = messages.filter((m) => m.role !== "judge");
  const waitingBuyer = talk.length > 0 && talk[talk.length - 1].role === "user_vendor" && talk[talk.length - 1].round !== 5;
  const groups: { label: string; msgs: Message[] }[] = [];
  for (const m of talk) {
    const label = m.round === 5 ? "THE VENDOR'S REAL REPLY" : m.role === "user_vendor" || (m.round ?? 0) >= 4 ? "YOU AS THE VENDOR" : `ROUND ${m.round ?? 1}`;
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.msgs.push(m);
    else groups.push({ label, msgs: [m] });
  }

  async function sendObjection(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setFormError(null);
    try {
      const token = await ensureSession();
      const r = await fetch(`/api/runs/${id}/objection`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setFormError(j.error ?? "That did not go through. Please try again.");
      else setDraft("");
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function answerGate(action: "approve" | "feedback" | "autopilot") {
    if (gating) return;
    setGating(true);
    setGateError(null);
    try {
      const token = await ensureSession();
      const r = await fetch(`/api/runs/${id}/gate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: guidance }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setGateError(j.error ?? "That did not go through. Please try again.");
      else {
        setGuidance("");
        await reload();
      }
    } catch {
      setGateError("We could not reach the server. Check your connection and try again.");
    } finally {
      setGating(false);
    }
  }


  if (error)
    return (
      <div className="flex justify-center px-5 py-24">
        <div className="max-w-[520px] rounded-3xl border border-line bg-panel/80 p-8 text-center">
          <div className="disp text-2xl font-bold">We could not open this run</div>
          <p className="mt-3 text-muted">{error}</p>
          <Link href="/new" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-buyer px-5 py-2.5 font-semibold text-[#06231d]">Start a new rehearsal</Link>
        </div>
      </div>
    );

  // "Slack Pro", not "Slack · Slack Pro": skip the vendor when the product name already starts with it.
  const title = deal?.vendor
    ? deal.product
      ? deal.product.toLowerCase().startsWith(deal.vendor.toLowerCase()) ? deal.product : `${deal.vendor} · ${deal.product}`
      : deal.vendor
    : "Reading your email";

  return (
    <div className="flex justify-center px-5 pb-24 pt-10 sm:px-8">
      <div className="flex w-full max-w-[1160px] flex-col gap-7">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-2.5">
            <span className="mono flex items-center gap-2.5 text-xs uppercase tracking-[0.12em] text-buyer">
              <span className={`block size-2 rounded-full ${complete ? "bg-buyer" : failed ? "bg-[#ff6b6b]" : paused ? "bg-vendor" : "pulse-ring bg-vendor"}`} />
              {status === "deal_done" ? "Deal reached" : status === "awaiting_vendor" ? "Waiting for the vendor" : status === "negotiating" || status === "vendor_reviewed" ? "Reading the vendor's reply" : status === "reply_ready" ? "The vendor replied" : complete ? "Rehearsal ready to send" : failed ? "Rehearsal stopped" : paused ? "Paused · waiting for you" : "Rehearsal in progress"}
            </span>
            <h1 className="disp text-[clamp(2rem,5vw,2.9rem)] font-bold leading-[1.05]">
              {loaded ? title : "Opening the room"}
              {!deal?.vendor && <span className="caret ml-1 bg-buyer" />}
            </h1>
            <div className="text-muted">
              {deal?.renewal_date ? `Renews ${new Date(deal.renewal_date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "Renewal date pending"}
              {deal?.price ? ` · currently $${Number(deal.price).toLocaleString()} per year` : ""}
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="mono text-[11px] tracking-[0.1em] text-dim">SAVED PER YEAR</span>
            <span className="disp text-[clamp(2.6rem,6vw,3.5rem)] font-bold leading-none text-buyer">
              {status === "deal_done" && deal?.est_saving ? <CountUp to={Number(deal.est_saving)} prefix="$" /> : <span className="text-line">$---</span>}
            </span>
          </div>
        </div>

        {failed && (
          <div className="rounded-2xl border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 p-5">
            <div className="font-semibold">This rehearsal did not finish.</div>
            <div className="mt-1 text-sm text-muted">{lastText("judge") ?? lastText("system") ?? "Something went wrong."} Nothing was sent anywhere.</div>
            <Link href="/new" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-buyer px-5 py-2.5 font-semibold text-[#06231d]">Try again</Link>
          </div>
        )}

        {/* Knowledge graph */}
        <KnowledgeGraph run={run} deal={deal} steps={steps} messages={messages} receipts={receipts} judge={judge} gate={gate} />

        {/* Checkpoint: the agents wait here for you */}
        <AnimatePresence>
          {paused && gate && (
            <motion.div
              key={gate.gate}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-wrap items-stretch gap-6 rounded-[22px] border-[1.5px] border-vendor bg-[#1b130d] p-6 shadow-[0_0_50px_rgba(255,153,102,0.14)]"
            >
              <div className="flex min-w-[280px] flex-[1_1_420px] flex-col gap-2.5">
                <span className="mono text-[11px] tracking-[0.12em] text-vendor">PAUSED · {gate.gate.toUpperCase()} REVIEW</span>
                <div className="disp text-2xl font-bold">{gate.title ?? "Please review this step"}</div>
                <ul className="flex flex-col gap-2 text-[15px] leading-relaxed text-[#d3dce8]">
                  {(gate.bullets ?? []).map((b, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="flex gap-2.5">
                      <span className={i === 0 ? "text-buyer" : i === 1 ? "text-vendor" : "text-fg"}>●</span>
                      <span>{split(b).clean}</span>
                    </motion.li>
                  ))}
                </ul>
                {gate.question && <div className="mt-1 font-semibold">{gate.question}</div>}
              </div>
              <div className="flex min-w-[260px] flex-[1_1_340px] flex-col justify-between gap-3">
                <textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  maxLength={600}
                  rows={3}
                  aria-label="Guidance for the agents"
                  placeholder="Optional guidance, for example: drop Jira, push on a 12 month term."
                  className="w-full resize-none rounded-xl border border-[#2b3a4f] bg-ink p-3.5 text-[15px] outline-none transition placeholder:text-dim focus:border-vendor focus:shadow-[0_0_0_4px_rgba(255,153,102,0.12)]"
                />
                {gateError && <div role="alert" className="text-sm text-[#ff8b82]">{gateError}</div>}
                <div className="flex flex-wrap items-center gap-2.5">
                  <motion.button whileTap={{ scale: 0.96 }} disabled={gating} onClick={() => answerGate("approve")} className="shine min-h-11 rounded-xl bg-buyer px-5 py-2.5 font-semibold text-[#06231d] disabled:opacity-60">
                    {gating ? "Sending..." : "Approve and continue"}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} disabled={gating || guidance.trim().length < 3} onClick={() => answerGate("feedback")} className="min-h-11 rounded-xl border border-vendor px-5 py-2.5 font-semibold text-vendor disabled:opacity-40">
                    Send guidance
                  </motion.button>
                  <button disabled={gating} onClick={() => answerGate("autopilot")} className="min-h-11 px-2 text-sm text-muted transition hover:text-fg">Switch to autopilot</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agents */}
        <div className="rounded-3xl border border-line bg-panel/80 p-5 backdrop-blur-md">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="disp text-lg font-bold">What the agents are doing</span>
            <span className="mono text-[11px] text-dim">Runs on our servers. Safe to close this tab.</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-buyer to-vendor" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {agents.map((a, i) => {
              const active = !complete && !failed && i === activeIdx;
              return (
                <motion.div key={a.name} animate={{ opacity: a.done || active ? 1 : 0.4, y: active ? -2 : 0 }} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-[18px] flex-none items-center justify-center">
                    {a.done ? <Check color="#3ee0c1" size={18} /> : active ? (
                      <motion.span className="block size-4 rounded-full border-2 border-vendor border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                    ) : <span className="block size-2 rounded-full bg-line" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="mono text-[11px] leading-relaxed text-dim [overflow-wrap:anywhere]">
                      {a.done || active ? (lastText(a.lane) ?? "Working...").slice(0, 90) : "Waiting"}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Rehearsal */}
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="disp text-[22px] font-bold">The rehearsal</span>
              <span className="mono rounded-full border border-vendor/40 px-3 py-1.5 text-[11px] text-vendor">Simulated rehearsal partner, not a prediction.</span>
            </div>
            {talk.length === 0 && !failed && (
              <div className="mono flex items-center gap-2 rounded-2xl border border-dashed border-line p-5 text-sm text-dim">
                <motion.span className="block size-2 rounded-full bg-buyer" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                The researcher is gathering receipts. The debate starts as soon as it has evidence.
              </div>
            )}
            {groups.map((g) => (
              <div key={g.label} className="flex flex-col gap-3.5">
                <div className="mono border-b border-line pb-1.5 text-[11px] tracking-[0.1em] text-dim">{g.label}</div>
                {g.msgs.map((m) => {
                  const { clean, cites } = split(m.text);
                  return (
                    <Bubble key={m.id} side={m.round === 5 ? "vendor" : SIDE[m.role] ?? "buyer"} label={m.round === 5 ? "VENDOR, BY EMAIL" : undefined} text={clean} cps={160} instant={initialIds?.has(m.id) ?? true}>
                      {cites.map((c) => (
                        <a key={c} href={`#r${c}`}><Cite id={`R${c}`} /></a>
                      ))}
                    </Bubble>
                  );
                })}
              </div>
            ))}
            {waitingBuyer && (
              <div className="mono flex items-center gap-2 text-xs text-buyer">
                <motion.span className="block size-2 rounded-full bg-buyer" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                The buyer agent is preparing a reply with evidence...
              </div>
            )}

            {!!judge?.email && (
              <motion.form onSubmit={sendObjection} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex flex-col gap-3 rounded-2xl border border-[#2b3a4f] bg-panel/80 p-5 backdrop-blur-md">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label htmlFor="obj" className="disp text-lg font-bold">You be the vendor</label>
                  <span className="mono text-[11px] text-dim">{complete ? "Type an objection. The buyer replies with evidence from the receipts." : "Opens as soon as the claims are verified."}</span>
                </div>
                <input
                  id="obj"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={600}
                  placeholder="We cannot go below the monthly rate without a 2 year term."
                  className="rounded-xl border border-[#2b3a4f] bg-ink px-4 py-3 text-[15px] outline-none transition placeholder:text-dim focus:border-vendor focus:shadow-[0_0_0_4px_rgba(255,153,102,0.12)]"
                />
                {formError && <div role="alert" className="text-sm text-[#ff8b82]">{formError}</div>}
                <div className="flex justify-end">
                  <motion.button whileTap={{ scale: 0.95 }} disabled={sending || waitingBuyer || !complete} className="min-h-11 rounded-xl bg-vendor px-5 py-2.5 font-semibold text-[#2a1308] disabled:opacity-50">
                    {sending ? "Sending..." : "Send as vendor"}
                  </motion.button>
                </div>
              </motion.form>
            )}
          </div>

          {/* Receipts */}
          <div className="flex min-w-0 flex-col gap-4">
            <span className="disp text-[22px] font-bold">Receipts</span>
            {receiptList.length === 0 && <div className="mono rounded-2xl border border-dashed border-line p-5 text-sm text-dim">{failed ? "No receipts were collected." : "Nothing fetched yet."}</div>}
            <AnimatePresence initial={false}>
              {receiptList.map((r, i) => (
                <ReceiptCard key={r.id} r={r} verified={verifiedFor(i)} />
              ))}
            </AnimatePresence>
            {steps.filter((s) => s.lane === "researcher" && s.kind === "note" && /no verified pricing/i.test(s.text)).map((s) => (
              <div key={s.id} className="rounded-xl border border-dashed border-[#3a4a60] bg-panel/80 p-4">
                <span className="mono text-[11px] tracking-[0.12em] text-[#ffd166]">NO VERIFIED PRICING FOUND</span>
                <div className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Send to the vendor, wait for the reply, close the deal */}
        {run && (judge?.email || offer) && <FinalPanel vendorEmail={steps.find((x) => x.kind === "vendor")?.text ?? ""} id={id} run={run} deal={deal} judge={judge} offer={offer} sentTo={sentTo} steps={steps} reload={reload} />}

        <div className="flex flex-wrap items-center gap-4">
          <Link href="/new" className="mono rounded-full border border-line px-4 py-2 text-xs text-muted transition hover:border-buyer hover:text-buyer">New rehearsal</Link>
        </div>
      </div>
    </div>
  );
}
