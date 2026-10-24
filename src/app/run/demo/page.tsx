"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Bubble, Cite, ReceiptCard, useTypewriter, type Receipt, type Side } from "@/components/chat";
import { Check, CountUp, Magnetic, Stamp } from "@/components/motion";

// Demo playback of a finished run. Same screen the live run will use once the
// agents write to run_steps / messages / receipts; only the data source changes.

const AGENTS = [
  { name: "Extractor", detail: "Read vendor, price, seats" },
  { name: "Researcher", detail: "Fetched 2 pricing pages" },
  { name: "Buyer and vendor sim", detail: "3 rounds rehearsed" },
  { name: "Verifier", detail: "Checked claims against receipts" },
  { name: "Judge", detail: "Wrote the final email" },
];

const RECEIPTS: Receipt[] = [
  { id: "R1", claim: "Team plan: $11 per seat per month, billed annually", source: "taskboard.example/pricing", fetched: "24 Oct 2026, 18:42" },
  { id: "R2", claim: "Boardly Team: $10 per seat per month, billed annually", source: "boardly.example/plans", fetched: "24 Oct 2026, 18:43" },
];

const ROUNDS: { side: Side; text: string; cite?: string; round?: number }[] = [
  { round: 1, side: "buyer", text: "Taskboard lists the Team plan at $11 per seat per month on annual billing. We are paying $14 monthly. We would like to renew annually at the listed rate.", cite: "R1" },
  { side: "vendor", text: "Annual billing is something I can look at. Before I do, can you confirm all 12 seats are active?" },
  { round: 2, side: "buyer", text: "Yes, all 12 seats are active. A comparable plan from Boardly is listed at $10 per seat per month, annual. We would rather stay, on the annual rate.", cite: "R2" },
  { side: "vendor", text: "Feature sets differ between plans. I would want to understand what you use before moving on price." },
  { round: 3, side: "buyer", text: "We use boards, timelines and sharing, all on the Team plan. We will commit to a 12 month term at the listed annual rate." },
];

const EMAIL =
  "Hi Taskboard team,\n\nAhead of our 14 November renewal, we would like to move our 12 seats to annual billing at the publicly listed Team rate of $11 per seat per month. We currently pay $14 per seat per month on monthly billing.\n\nWe are happy to commit to a 12 month term. Please confirm the annual quote before the renewal date.\n\nThanks,\nNaveen";

// stage: 0 extract, 1 research, 2 rehearse, 3 verify, 4 judge, 5 done
const STAGE_MS = [2000, 3200, 0, 2600, 0, 0];

function FinalEmail({ onDone }: { onDone: () => void }) {
  const { shown, finished } = useTypewriter(EMAIL, 130, onDone);
  return (
    <div className="mono max-w-[760px] whitespace-pre-wrap rounded-2xl border border-[#2b3a4f] bg-ink p-6 text-[14.5px] leading-[1.75] text-[#d3dce8]">
      {shown}
      {!finished && <span className="caret bg-buyer" />}
    </div>
  );
}

export default function RunDemo() {
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState(0);
  const [msgs, setMsgs] = useState(0);
  const [extra, setExtra] = useState<{ side: Side; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (STAGE_MS[stage] > 0) {
      const t = setTimeout(() => setStage((s) => s + 1), STAGE_MS[stage]);
      return () => clearTimeout(t);
    }
  }, [stage, run]);

  const replay = useCallback(() => {
    setRun((r) => r + 1);
    setStage(0);
    setMsgs(0);
    setExtra([]);
    setApproved(false);
    setCopied(false);
  }, []);

  const pct = Math.min(100, Math.round(((stage + (stage === 2 ? msgs / ROUNDS.length : 0)) / 5) * 100));
  const verified = stage >= 3;

  function sendVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setExtra((x) => [...x, { side: "you", text: draft.trim() }]);
    setDraft("");
  }

  return (
    <div key={run} className="flex justify-center px-5 pb-24 pt-10 sm:px-8">
      <div className="flex w-full max-w-[1160px] flex-col gap-7">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-2.5">
            <span className="mono flex items-center gap-2.5 text-xs uppercase tracking-[0.12em] text-buyer">
              <span className={`block size-2 rounded-full ${stage < 5 ? "pulse-ring bg-vendor" : "bg-buyer"}`} style={stage < 5 ? { animationName: "ring" } : undefined} />
              {stage < 5 ? "Rehearsal in progress · Sample data" : "Rehearsal complete · Sample data"}
            </span>
            <h1 className="disp text-[clamp(2rem,5vw,2.9rem)] font-bold leading-[1.05]">Taskboard Team, 12 seats</h1>
            <div className="text-muted">Renews 14 Nov 2026 · currently $14 per seat per month, billed monthly</div>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="mono text-[11px] tracking-[0.1em] text-dim">EST. SAVING PER YEAR</span>
            <span className="disp text-[clamp(2.6rem,6vw,3.5rem)] font-bold leading-none text-buyer">
              {stage >= 4 ? <CountUp to={432} prefix="$" /> : <span className="text-line">$---</span>}
            </span>
          </div>
        </div>

        {/* Agent progress */}
        <div className="rounded-3xl border border-line bg-panel/80 p-5 backdrop-blur-md">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="disp text-lg font-bold">What the agents are doing</span>
            <span className="mono text-[11px] text-dim">Runs on our servers. Safe to close this tab.</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-panel2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-buyer to-vendor"
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {AGENTS.map((a, i) => {
              const done = stage > i;
              const active = stage === i;
              return (
                <motion.div
                  key={a.name}
                  animate={{ opacity: done || active ? 1 : 0.35, y: active ? -2 : 0 }}
                  className="flex items-start gap-2.5"
                >
                  <span className="mt-0.5 flex size-[18px] flex-none items-center justify-center">
                    {done ? (
                      <Check color="#3ee0c1" size={18} />
                    ) : active ? (
                      <motion.span
                        className="block size-4 rounded-full border-2 border-vendor border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <span className="block size-2 rounded-full bg-line" />
                    )}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="mono text-[11px] leading-relaxed text-dim">{done ? a.detail : active ? "Working..." : "Waiting"}</div>
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
              <span className="mono rounded-full border border-vendor/40 px-3 py-1.5 text-[11px] text-vendor">
                Simulated rehearsal partner, not a prediction.
              </span>
            </div>
            {stage < 2 && (
              <div className="mono flex items-center gap-2 rounded-2xl border border-dashed border-line p-5 text-sm text-dim">
                <motion.span className="block size-2 rounded-full bg-buyer" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                Waiting for the researcher&apos;s receipts...
              </div>
            )}
            {stage >= 2 &&
              ROUNDS.slice(0, msgs + 1).map((m, i) => (
                <div key={i} className="flex flex-col gap-3.5">
                  {m.round && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      className="mono origin-left border-b border-line pb-1.5 text-[11px] tracking-[0.1em] text-dim"
                    >
                      ROUND {m.round}
                    </motion.div>
                  )}
                  <Bubble
                    side={m.side}
                    text={m.text}
                    cps={110}
                    instant={i < msgs}
                    onDone={
                      i === msgs
                        ? () => setTimeout(() => (i + 1 < ROUNDS.length ? setMsgs((n) => n + 1) : setStage(3)), 450)
                        : undefined
                    }
                  >
                    {m.cite && <Cite id={m.cite} />}
                  </Bubble>
                </div>
              ))}
            <AnimatePresence>
              {extra.map((m, i) => (
                <div key={i} className="flex flex-col gap-3.5">
                  <Bubble side={m.side} text={m.text} instant />
                  <Bubble side="buyer" text="Understood. At 12 seats, the listed annual rate is $11 per seat per month, and a 12 month commitment already gives you predictable revenue." cps={110}>
                    <Cite id="R1" />
                  </Bubble>
                </div>
              ))}
            </AnimatePresence>

            {stage >= 4 && (
              <motion.form
                onSubmit={sendVendor}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex flex-col gap-3 rounded-2xl border border-[#2b3a4f] bg-panel/80 p-5 backdrop-blur-md"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label htmlFor="obj" className="disp text-lg font-bold">You be the vendor</label>
                  <span className="mono text-[11px] text-dim">Type an objection. The buyer replies with evidence. Demo reply.</span>
                </div>
                <input
                  id="obj"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="We cannot go below the monthly rate without a 2 year term."
                  className="rounded-xl border border-[#2b3a4f] bg-ink px-4 py-3 text-[15px] outline-none transition placeholder:text-dim focus:border-vendor focus:shadow-[0_0_0_4px_rgba(255,153,102,0.12)]"
                />
                <div className="flex justify-end">
                  <motion.button whileTap={{ scale: 0.95 }} className="min-h-11 rounded-xl bg-vendor px-5 py-2.5 font-semibold text-[#2a1308]">
                    Send as vendor
                  </motion.button>
                </div>
              </motion.form>
            )}
          </div>

          {/* Receipts */}
          <div className="flex min-w-0 flex-col gap-4">
            <span className="disp text-[22px] font-bold">Receipts</span>
            {stage < 1 && <div className="mono rounded-2xl border border-dashed border-line p-5 text-sm text-dim">Nothing fetched yet.</div>}
            {stage >= 1 && RECEIPTS.map((r, i) => <ReceiptCard key={r.id} r={r} verified={verified} delay={i * 0.9} />)}
            {stage >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-xl border border-dashed border-[#3a4a60] bg-panel/80 p-4"
              >
                <span className="mono text-[11px] tracking-[0.12em] text-[#ffd166]">NOT VERIFIED</span>
                <div className="mt-1.5 text-sm leading-relaxed text-muted">&quot;No verified pricing found&quot; for a third alternative. It was left out of the final email.</div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Final email */}
        {stage >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-col gap-5 rounded-[28px] border border-line bg-panel/80 p-6 backdrop-blur-md sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="disp text-2xl font-bold">Your final email</span>
              {stage >= 5 && (
                <Stamp>
                  <Check size={16} /> 3 OF 3 CLAIMS VERIFIED
                </Stamp>
              )}
            </div>
            <FinalEmail onDone={() => setStage(5)} />
            {stage >= 5 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-stretch gap-4">
                <div className="flex min-w-[260px] flex-1 flex-col gap-1.5 rounded-2xl border border-vendor/30 bg-vendor/10 p-5">
                  <span className="mono text-[11px] tracking-[0.1em] text-vendor">COUNTER YOU ARE MOST LIKELY TO FACE</span>
                  <span className="text-[15px] leading-relaxed">&quot;We can only offer that rate on a 2 year term.&quot;</span>
                  <span className="text-sm leading-relaxed text-muted">
                    Prepared reply: ask for the 1 year annual rate in writing, and mention the Boardly listing. <Cite id="R2" />
                  </span>
                </div>
                <div className="flex min-w-[240px] flex-1 flex-col justify-center gap-3">
                  <span className="mono text-xs text-dim">Likely outcome: a smaller discount on annual billing.</span>
                  <div className="flex flex-wrap gap-3">
                    <Magnetic>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(EMAIL).catch(() => {});
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1800);
                        }}
                        className="min-h-12 rounded-xl border border-[#3a4a60] px-6 py-3 font-semibold transition hover:border-buyer"
                      >
                        {copied ? "Copied" : "Copy email"}
                      </button>
                    </Magnetic>
                    <Magnetic>
                      <button
                        onClick={() => setApproved(true)}
                        className={`shine min-h-12 rounded-xl px-6 py-3 font-semibold text-[#06231d] ${approved ? "bg-buyer/60" : "bg-buyer"}`}
                      >
                        {approved ? "Approved" : "Approve"}
                      </button>
                    </Magnetic>
                  </div>
                  <span className="mono text-[11px] text-dim">Approve saves your decision. It does not send any email.</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button onClick={replay} className="mono rounded-full border border-line px-4 py-2 text-xs text-muted transition hover:border-buyer hover:text-buyer">
            Replay the run
          </button>
        </div>
      </div>
    </div>
  );
}
