"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bubble, Cite, type Side } from "./chat";
import { Tilt } from "./motion";

const SCRIPT: { side: Side; text: string; cite?: string }[] = [
  { side: "buyer", text: "Taskboard lists its Team plan at $11 per seat per month on annual billing. We pay $14 monthly. We would like the annual rate.", cite: "R1" },
  { side: "vendor", text: "Annual billing is something I can look at. Can you confirm all 12 seats are active?" },
  { side: "buyer", text: "Yes, all 12 are active. Boardly lists a comparable plan at $10 per seat per month, annual.", cite: "R2" },
  { side: "vendor", text: "Feature sets differ between plans. I would want to understand what you use first." },
];

// Hero demo: the two agents argue in a loop, with receipts popping in.
export default function Duel() {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const next = useCallback(() => {
    timer.current = setTimeout(() => {
      setStep((s) => {
        if (s + 1 < SCRIPT.length) return s + 1;
        // Finished: hold, then replay from the top.
        timer.current = setTimeout(() => {
          setStep(0);
          setRound((r) => r + 1);
        }, 3200);
        return s;
      });
    }, 700);
  }, []);

  return (
    <Tilt className="rounded-3xl border border-line bg-panel/80 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="mono text-[11px] uppercase tracking-[0.1em] text-dim">
          Round {Math.min(Math.floor(step / 2) + 1, 3)} of 3 · Sample: Taskboard Pro
        </span>
        <span className="mono flex items-center gap-2 text-[11px] text-vendor">
          <span className="pulse-ring block size-2 rounded-full bg-vendor" /> Simulation
        </span>
      </div>
      <div key={round} className="flex min-h-[330px] flex-col gap-3.5">
        <AnimatePresence initial={false}>
          {SCRIPT.slice(0, step + 1).map((m, i) => (
            <Bubble key={i} side={m.side} text={m.text} instant={i < step} onDone={i === step ? next : undefined} cps={62}>
              {m.cite && <Cite id={m.cite} />}
            </Bubble>
          ))}
        </AnimatePresence>
      </div>
      <div className="mono mt-4 border-t border-line pt-3 text-[11px] text-dim">
        Simulated rehearsal partner, not a prediction.
      </div>
      <motion.div
        aria-hidden
        className="mono absolute -bottom-8 -right-3 hidden w-52 rotate-[-3deg] rounded-md bg-paper px-4 pb-4 pt-3 text-[#10161f] shadow-2xl sm:block"
        animate={{ y: [0, -9, 0], rotate: [-3, -1.5, -3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="text-[10px] tracking-[0.12em] text-[#5b6778]">RECEIPT R1</div>
        <div className="my-1.5 text-[13px] font-medium">Team plan, annual</div>
        <div className="text-[11px] leading-relaxed text-[#5b6778]">taskboard.example/pricing</div>
      </motion.div>
    </Tilt>
  );
}
