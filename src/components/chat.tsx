"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "./motion";

// Types text out character by character, then calls onDone once.
export function useTypewriter(text: string, cps = 55, onDone?: () => void) {
  const [state, setState] = useState({ text, n: 0 });
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setState({ text, n: i });
      if (i >= text.length) {
        clearInterval(id);
        doneRef.current?.();
      }
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps]);
  const n = state.text === text ? state.n : 0;
  return { shown: text.slice(0, n), finished: n >= text.length };
}

export type Side = "buyer" | "vendor" | "you";

const SIDE = {
  buyer: {
    label: "BUYER AGENT",
    color: "text-buyer",
    box: "border-buyer/35 bg-buyer/10 rounded-2xl rounded-bl-sm",
    align: "items-start",
    caret: "bg-buyer",
  },
  vendor: {
    label: "SIMULATED VENDOR REP",
    color: "text-vendor",
    box: "border-vendor/35 bg-vendor/10 rounded-2xl rounded-br-sm",
    align: "items-end ml-auto",
    caret: "bg-vendor",
  },
  you: {
    label: "YOU, AS THE VENDOR",
    color: "text-vendor",
    box: "border-vendor border-dashed bg-vendor/5 rounded-2xl rounded-br-sm",
    align: "items-end ml-auto",
    caret: "bg-vendor",
  },
} as const;

// A chat bubble that springs in and types its text.
export function Bubble({
  side,
  text,
  cps = 55,
  onDone,
  instant,
  label,
  children,
}: {
  side: Side;
  text: string;
  cps?: number;
  onDone?: () => void;
  instant?: boolean;
  label?: string;
  children?: ReactNode;
}) {
  const s = SIDE[side];
  const { shown, finished } = useTypewriter(instant ? "" : text, cps, onDone);
  const out = instant ? text : shown;
  const showCaret = !instant && !finished;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`flex max-w-[90%] flex-col gap-1.5 ${s.align}`}
    >
      <span className={`mono text-[11px] tracking-[0.08em] ${s.color}`}>{label ?? s.label}</span>
      <div className={`border px-4 py-3 text-[15px] leading-relaxed ${s.box}`}>
        {out}
        {showCaret && <span className={`caret ${s.caret}`} />}
        {finished || instant ? children : null}
      </div>
    </motion.div>
  );
}

// Receipt-style citation chip inside a message.
export function Cite({ id }: { id: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 14 }}
      className="mono ml-1.5 inline-block border-b border-dashed border-buyer text-xs text-buyer"
    >
      receipt {id}
    </motion.span>
  );
}

export type Receipt = {
  id: string;
  claim: string;
  source: string;
  fetched: string;
  href?: string;
  screenshot?: string | null;
};

// Paper receipt with a zigzag edge. verified: true/false once checked, null while checking.
export function ReceiptCard({ r, verified, delay = 0 }: { r: Receipt; verified: boolean | null; delay?: number }) {
  return (
    <motion.div
      id={r.id.toLowerCase()}
      initial={{ opacity: 0, y: 30, rotate: -3, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 18, delay }}
      whileHover={{ y: -4, rotate: 0.6 }}
      className="receipt relative scroll-mt-28 rounded-t-lg bg-paper px-[18px] pt-4 text-[#10161f] shadow-[0_14px_34px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between">
        <span className="mono text-[11px] tracking-[0.12em] text-[#5b6778]">{r.id}</span>
        {verified === true && (
          <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="mono inline-flex items-center gap-1.5 text-[11px] text-[#0b6b58]">
            <Check color="#0b6b58" size={12} /> public source
          </motion.span>
        )}
        {verified === false && <span className="mono text-[11px] text-[#a3261f]">not verified</span>}
        {verified === null && (
          <span className="mono inline-flex items-center gap-1.5 text-[11px] text-[#9a6a00]">
            <motion.span className="block size-2 rounded-full bg-[#e0a030]" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            checking
          </span>
        )}
      </div>
      <div className="relative mt-2.5 h-24 overflow-hidden rounded-md border border-[#cbd3df] bg-[repeating-linear-gradient(0deg,#dde3ec_0_8px,#e6ebf2_8px_16px)]">
        {r.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.screenshot} alt={`Screenshot of ${r.source}`} className="size-full object-cover object-top" />
        ) : (
          <>
            {verified === null && (
              <motion.div
                aria-hidden
                className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-buyer/40 to-transparent"
                animate={{ y: ["-100%", "320%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
              />
            )}
            <span className="mono absolute bottom-2 left-2 rounded bg-paper px-1.5 py-0.5 text-[10px] text-[#5b6778]">screenshot</span>
          </>
        )}
      </div>
      <div className="mono mt-2.5 text-[13px] font-medium leading-snug">{r.claim}</div>
      <div className="mono mt-2.5 break-words border-t border-dashed border-[#aeb8c7] pt-2 text-[11px] leading-relaxed text-[#5b6778]">
        {r.href ? (
          <a href={r.href} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-[#0b6b58]">
            {r.source}
          </a>
        ) : (
          r.source
        )}
        <br />
        fetched {r.fetched}
      </div>
    </motion.div>
  );
}
