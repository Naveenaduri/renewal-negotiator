"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CountUp, Magnetic } from "@/components/motion";
import type { Deal, Judge, Offer, RunRow, Step } from "@/hooks/useRun";
import { ensureSession } from "@/lib/supabase";

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
// The judge's estimates, shown as whole percents. Never shown as certain (capped at 5-95%); hidden if missing.
const chance = (v: unknown): number | null => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.min(95, Math.max(5, n)) : null;
};

function Chance(props: { value: number; tone: "buyer" | "vendor"; label: string; word: string }) {
  const { value, tone, label, word } = props;
  return (
    <div className="mt-2 flex items-center gap-3" aria-label={`${label}: ${value}%`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <motion.div className={`h-full rounded-full ${tone === "buyer" ? "bg-buyer" : "bg-vendor"}`} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
      <span className={`disp whitespace-nowrap text-xl font-bold ${tone === "buyer" ? "text-buyer" : "text-vendor"}`}>{value}% <span className="text-sm font-semibold">{word}</span></span>
    </div>
  );
}

// Before vs after, from the verified saving only (the verifier zeroes it when no price claim checks out).
function Saving(props: { deal: Deal | null; judge: Judge | null }) {
  const was = Number(props.deal?.price ?? 0);
  const saving = Number(props.deal?.est_saving ?? 0);
  const basis = props.judge?.saving_basis;
  if (saving > 0 && was > saving) {
    const after = was - saving;
    return (
      <div className="rounded-2xl border border-buyer/40 bg-buyer/10 p-4 sm:p-5">
        <div className="mono text-[11px] tracking-[0.1em] text-buyer">ANTICIPATED SAVING · FROM VERIFIED PRICES</div>
        <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="flex flex-col">
            <span className="mono text-[11px] text-dim">BEFORE</span>
            <span className="disp text-xl text-muted line-through">{money(was)}/yr</span>
          </div>
          <span className="pb-1 text-vendor" aria-hidden>→</span>
          <div className="flex flex-col">
            <span className="mono text-[11px] text-dim">AFTER</span>
            <span className="disp text-xl font-bold text-fg">{money(after)}/yr</span>
          </div>
          <div className="flex flex-col sm:ml-auto sm:items-end">
            <span className="mono text-[11px] text-dim">YOU SAVE</span>
            <span className="disp text-3xl font-bold leading-none text-buyer">
              <CountUp to={saving} prefix="$" /> <span className="text-base font-semibold">/yr · {Math.round((saving / was) * 100)}%</span>
            </span>
          </div>
        </div>
        {basis && <div className="mono mt-3 text-xs leading-relaxed text-muted">How: {basis}</div>}
      </div>
    );
  }
  if (saving > 0) {
    return (
      <div className="rounded-2xl border border-buyer/40 bg-buyer/10 p-4 text-sm">
        <span className="mono text-[11px] tracking-[0.1em] text-buyer">ANTICIPATED SAVING</span>
        <div className="disp mt-1 text-2xl font-bold text-buyer">{money(saving)}/yr</div>
        {basis && <div className="mono mt-1 text-xs text-muted">How: {basis}</div>}
      </div>
    );
  }
  if (was > 0) {
    return (
      <div className="rounded-2xl border border-line p-4 text-sm leading-relaxed text-muted">
        <span className="mono text-[11px] tracking-[0.1em] text-dim">ANTICIPATED SAVING</span>
        <div className="mt-1">No verified pricing found, so there is no saving estimate. The email negotiates on billing period, seats and term instead. Today you pay {money(was)}/yr.</div>
      </div>
    );
  }
  return null;
}

function Sparks() {
  // A short burst when the deal lands.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 22 }).map((_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-24 block size-2 rounded-full"
            style={{ background: i % 2 ? "#3ee0c1" : "#ff9966" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * (160 + (i % 5) * 40), y: Math.sin(a) * (110 + (i % 4) * 40), opacity: 0, scale: 0.2 }}
            transition={{ duration: 1.4 + (i % 4) * 0.15, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

// The editable email and the Send button. Re-mounted (via key) for each new draft, so it starts from the right text.
function Draft(props: { vendorEmail: string; id: string; counter: boolean; deal: Deal | null; judge: Judge | null; offer: Offer | null; sentTo: { to: string } | null; reload: () => Promise<void> }) {
  const { id, counter, deal, judge, offer, sentTo, reload, vendorEmail } = props;
  const outcomeChance = chance(judge?.outcome_chance);
  const replyChance = chance(judge?.counter_reply_chance);
  const [body, setBody] = useState((counter ? offer?.suggested_reply : judge?.email) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await ensureSession();
      const r = await fetch(`/api/runs/${id}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error ?? "That did not go through. Please try again.");
      else await reload();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="flex flex-col gap-5 rounded-[28px] border border-line bg-panel/80 p-6 backdrop-blur-md sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="disp text-2xl font-bold">{counter ? "The vendor replied. Your move." : "Your email to the vendor"}</span>
        {counter && offer?.kind && <span className="mono rounded-full border border-vendor/50 px-3 py-1 text-[11px] text-vendor">{offer.kind.toUpperCase()}</span>}
      </div>
      {!counter && <Saving deal={deal} judge={judge} />}
      {counter && (
        <div className="rounded-2xl border border-vendor/30 bg-vendor/10 p-4 text-[15px] leading-relaxed">
          <div className="mono text-[11px] tracking-[0.1em] text-vendor">WHAT THEY SAID</div>
          <div className="mt-1">{offer?.summary ?? "The vendor replied."}</div>
          {offer?.leverage && <div className="mt-1 text-muted">Leverage: {offer.leverage}</div>}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="mono rounded-xl border border-line bg-ink/60 px-4 py-3 text-[13px] text-muted">{vendorEmail ? <>Goes to <span className="text-fg">{vendorEmail}</span>, the person playing the vendor.</> : "Goes to the vendor mailbox."} Nothing is sent until you press the button.</div>
        <label htmlFor="draft" className="mono mt-2 text-[11px] tracking-[0.1em] text-dim">THE EMAIL (EDIT IF YOU LIKE)</label>
        <textarea id="draft" value={body} onChange={(e) => setBody(e.target.value)} rows={11} maxLength={6000} className="mono w-full resize-y rounded-xl border border-[#2b3a4f] bg-ink p-4 text-[14.5px] leading-[1.7] text-[#d3dce8] outline-none transition focus:border-buyer" />
      </div>
      {!counter && (judge?.counter || judge?.outcome) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {judge?.outcome && <div className="rounded-2xl border border-line p-4 text-sm leading-relaxed text-muted"><div className="mono mb-1 text-[11px] tracking-[0.1em] text-dim">LIKELY OUTCOME</div>{outcomeChance !== null && <Chance value={outcomeChance} tone="buyer" label="Chance of this outcome" word="chance" />}<div className="mt-2">{judge.outcome}</div></div>}
          {judge?.counter && <div className="rounded-2xl border border-vendor/30 bg-vendor/10 p-4 text-sm leading-relaxed"><div className="mono mb-1 text-[11px] tracking-[0.1em] text-vendor">COUNTER YOU MAY FACE</div><div className="mt-1">{judge.counter}</div>{judge.counter_reply && <div className="mt-3 rounded-xl border border-buyer/30 bg-ink/50 p-3"><div className="mono text-[11px] tracking-[0.1em] text-buyer">YOUR PREPARED REPLY</div>{replyChance !== null && <Chance value={replyChance} tone="buyer" label="Chance this reply works" word="it works" />}<div className="mt-2 text-fg">{judge.counter_reply}</div></div>}</div>}
          {(outcomeChance !== null || replyChance !== null) && <div className="mono text-[11px] text-dim sm:col-span-2">Percentages are the judge agent&apos;s estimates from the receipts and the rehearsal, not a guarantee.</div>}
        </div>
      )}
      {error && <div role="alert" className="text-sm text-[#ff8b82]">{error}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <Magnetic>
          <button onClick={send} disabled={busy || body.trim().length < 20} className="shine min-h-12 rounded-xl bg-buyer px-6 py-3 font-semibold text-[#06231d] disabled:opacity-50">
            {busy ? "Sending..." : counter ? "Send my reply" : "Send to vendor"}
          </button>
        </Magnetic>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(body).then(() => setCopied(true)).catch(() => {});
            setTimeout(() => setCopied(false), 1800);
          }}
          className="min-h-12 rounded-xl border border-[#3a4a60] px-5 py-3 font-semibold transition hover:border-buyer"
        >
          {copied ? "Copied" : "Copy email"}
        </button>
        <span className="mono text-[11px] text-dim">Nothing is sent until you press the button. Replies come back here.</span>
      </div>
    </motion.div>
  );
}

export default function FinalPanel(props: {
  vendorEmail: string;
  id: string;
  run: RunRow;
  deal: Deal | null;
  judge: Judge | null;
  offer: Offer | null;
  sentTo: { to: string; n: number } | null;
  steps: Step[];
  reload: () => Promise<void>;
}) {
  const { id, run, deal, judge, offer, sentTo, steps, reload, vendorEmail } = props;
  const status = run.status;
  const [copied, setCopied] = useState(false);
  const emailed = steps.find((s) => s.kind === "emailed")?.text;
  const vendor = deal?.vendor ?? "the vendor";
  const was = Number(deal?.price ?? 0);
  const now = Number(offer?.offer_price_annual ?? 0);

  // ---- WON ----
  if (status === "deal_done" && was > 0 && now > 0) {
    const saved = was - now;
    return (
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 140, damping: 18 }} className="relative overflow-hidden rounded-[32px] border-[1.5px] border-buyer bg-gradient-to-br from-buyer/15 via-panel to-vendor/10 p-8 text-center shadow-[0_0_80px_rgba(62,224,193,0.2)] sm:p-12">
        <Sparks />
        <div className="mono text-xs tracking-[0.3em] text-buyer">DEAL REACHED</div>
        <div className="mt-3 text-muted">You saved</div>
        <div className="disp text-[clamp(4rem,14vw,7.5rem)] font-bold leading-none text-buyer">
          <CountUp to={saved} prefix="$" duration={1.8} />
        </div>
        <div className="mt-2 text-lg">per year on <strong>{vendor}</strong></div>
        <div className="mono mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-line bg-ink/60 px-6 py-3">
          <span className="text-muted line-through">{money(was)}</span>
          <span className="text-vendor">→</span>
          <span className="text-xl font-bold text-fg">{money(now)}</span>
          <span className="rounded-full border border-buyer px-3 py-1 text-xs text-buyer">{Math.round((saved / was) * 100)}% off</span>
        </div>
        {offer?.offer_quote && (
          <div className="mx-auto mt-8 max-w-[640px] border-l-[3px] border-vendor pl-4 text-left italic leading-relaxed text-fg">
            &ldquo;{offer.offer_quote}&rdquo;
            <div className="mono mt-1.5 text-xs not-italic text-dim">{sentTo?.to ?? "the vendor"}, in their own words</div>
          </div>
        )}
        {offer?.suggested_reply && (
          <div className="mx-auto mt-8 max-w-[640px] text-left">
            <div className="mono mb-2 text-[11px] tracking-[0.12em] text-buyer">REPLY WITH THIS TO LOCK IT IN</div>
            <div className="mono whitespace-pre-wrap rounded-2xl bg-paper p-5 text-sm leading-[1.7] text-[#10161f]">{offer.suggested_reply}</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Magnetic>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(offer.suggested_reply ?? "").then(() => setCopied(true)).catch(() => {});
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className="shine min-h-12 rounded-xl bg-buyer px-6 py-3 font-semibold text-[#06231d]"
                >
                  {copied ? "Copied" : "Copy reply"}
                </button>
              </Magnetic>
              {deal?.renewal_date && <span className="mono text-xs text-[#ffd166]">Send it before your renewal on {new Date(deal.renewal_date + "T00:00").toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}.</span>}
            </div>
          </div>
        )}
        {emailed && <div className="mono mt-6 text-xs text-dim">{emailed}</div>}
      </motion.div>
    );
  }

  // ---- WAITING ON THE VENDOR ----
  if (status === "awaiting_vendor" || status === "negotiating" || status === "vendor_reviewed") {
    const reading = status !== "awaiting_vendor";
    return (
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 rounded-[28px] border border-vendor/40 bg-panel/80 p-10 text-center backdrop-blur-md">
        <motion.span className="flex size-16 items-center justify-center rounded-2xl bg-vendor/15 text-3xl" animate={{ y: [0, -8, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity }} aria-hidden>✉</motion.span>
        <div className="disp text-2xl font-bold">{reading ? "Reading the vendor's reply" : "Sent. Waiting for the vendor"}</div>
        <p className="max-w-[520px] leading-relaxed text-muted">
          {reading ? (
            "The buyer agent is checking their reply against your current price."
          ) : (
            <>Your email went to <span className="text-fg">{sentTo?.to}</span>. When they reply, it appears here automatically. You can close this tab; we keep watching.</>
          )}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => <motion.span key={i} className="block size-2 rounded-full bg-vendor" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />)}
        </div>
      </motion.div>
    );
  }

  // ---- DRAFT: first email, or a counter ----
  if (status !== "complete" && status !== "reply_ready") return null;
  const counter = status === "reply_ready";
  return <Draft vendorEmail={vendorEmail} key={counter ? `reply-${offer?.suggested_reply ?? ""}` : `first-${judge?.email ?? ""}`} id={id} counter={counter} deal={deal} judge={judge} offer={offer} sentTo={sentTo} reload={reload} />;
}
