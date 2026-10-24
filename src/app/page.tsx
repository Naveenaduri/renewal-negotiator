"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import Duel from "@/components/Duel";
import { CountUp, Magnetic, Reveal, SplitText, Tilt } from "@/components/motion";

const CLAIMS = [
  "No receipt, no claim",
  "Every price links to its source",
  "Screenshot for every number",
  "Vendor rep is always labeled a simulation",
  "Nothing is sent without you",
  "If no public price exists, it says so",
];

const STEPS = [
  { tag: "RESEARCH", color: "text-buyer", title: "Extract and research", body: "Pulls vendor, price, seats and renewal date from your email, then fetches the vendor's public pricing and two or three real alternatives." },
  { tag: "REHEARSE", color: "text-vendor", title: "Rehearse up to 3 rounds", body: "A buyer agent argues only from receipts. A labeled simulation plays the vendor rep. You can step in and be the vendor yourself." },
  { tag: "VERIFY", color: "text-fg", title: "Verify, then draft", body: "Every price claim is checked against its saved source. You get a final email with a count of verified claims. Nothing is sent without you." },
];

export default function Landing() {
  const how = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: how, offset: ["start 80%", "end 60%"] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  return (
    <div className="flex flex-col items-center px-5 pb-24 sm:px-8">
      {/* Hero */}
      <section className="grid w-full max-w-[1160px] items-center gap-14 pb-10 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div className="flex min-w-0 flex-col gap-7">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="mono flex items-center gap-2.5 text-xs uppercase tracking-[0.12em] text-buyer"
          >
            <span className="pulse-buyer block size-2 rounded-full bg-buyer" />
            Rehearsal room is open
          </motion.div>
          <h1 className="disp text-[clamp(2.6rem,7vw,4.6rem)] font-bold leading-[1.02]">
            <SplitText text="Rehearse the negotiation" delay={0.1} />
            <br />
            <SplitText text="before you" delay={0.45} />
            <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
              <motion.span
                className="flow-text inline-block"
                initial={{ y: "115%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.75, delay: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              >
                send it.
              </motion.span>
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7 }}
            className="max-w-[540px] text-lg leading-relaxed text-muted"
          >
            For small teams that auto-renew software they never review: agents{" "}
            <span className="font-semibold text-fg">research real public pricing and alternatives</span>, then{" "}
            <span className="mono font-semibold tracking-wide text-vendor">REHEARSE</span> the negotiation against a
            simulated vendor rep.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.7 }}
            className="max-w-[540px] text-lg leading-relaxed text-muted"
          >
            You get a <span className="font-semibold text-fg">ready-to-send counter-offer</span>, an{" "}
            <span className="font-semibold text-buyer">estimated yearly saving</span> from verified prices, and the
            vendor&apos;s most likely pushback with your answer ready.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.7 }}
            className="flex flex-wrap items-center gap-4"
          >
            <Magnetic>
              <Link
                href="/new"
                className="shine inline-flex min-h-12 items-center gap-2.5 rounded-2xl bg-buyer px-7 py-4 text-lg font-semibold text-[#06231d] shadow-[0_0_40px_rgba(62,224,193,0.35)] transition-shadow hover:shadow-[0_0_60px_rgba(62,224,193,0.55)]"
              >
                Try a sample renewal
                <motion.svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </motion.svg>
              </Link>
            </Magnetic>
            <Link href="/signin" className="min-h-12 px-2 py-3 text-muted transition-colors hover:text-fg">
              or sign in with an emailed link
            </Link>
          </motion.div>
          <div className="mono text-xs text-dim">No sign-up needed for samples. Nothing is ever sent for you.</div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: 0.5, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative min-w-0"
        >
          <Duel />
        </motion.div>
      </section>

      {/* Marquee */}
      <div className="mt-14 w-full overflow-hidden border-y border-line/70 py-4 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee">
          {[...CLAIMS, ...CLAIMS].map((c, i) => (
            <span key={i} className="mono flex items-center gap-6 pr-6 text-sm uppercase tracking-[0.1em] text-dim">
              {c}
              <span className="block size-1.5 rotate-45 bg-vendor" />
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section ref={how} className="w-full max-w-[1160px] pt-28">
        <Reveal>
          <h2 className="disp max-w-[640px] text-[clamp(2rem,4.5vw,2.8rem)] font-bold leading-tight">
            Six agents do the homework you skip.
          </h2>
        </Reveal>
        <div className="relative mt-12">
          <div className="absolute inset-x-0 -top-5 hidden h-px bg-line md:block">
            <motion.div className="h-px origin-left bg-gradient-to-r from-buyer to-vendor" style={{ scaleX: line }} />
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.12}>
                <Tilt className="h-full rounded-3xl border border-line bg-panel/80 p-6 backdrop-blur-md">
                  <div className={`mono text-[11px] tracking-[0.1em] ${s.color}`}>
                    STEP {i + 1} · {s.tag}
                  </div>
                  <div className="disp mt-3 text-2xl font-bold">{s.title}</div>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sample result */}
      <section className="mt-28 w-full max-w-[1160px]">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-buyer/10 via-panel/60 to-vendor/10 p-8 sm:p-12">
            <div className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
              <div>
                <div className="disp text-[clamp(1.6rem,3.4vw,2.2rem)] font-bold leading-tight">
                  No receipt, no claim. If no public price exists, it says so.
                </div>
                <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-muted">
                  The agents never invent a price. When nothing verifiable is found, they negotiate on billing period,
                  seat count and term length instead.
                </p>
                <div className="mt-7">
                  <Magnetic>
                    <Link href="/new" className="inline-flex min-h-12 items-center rounded-2xl bg-fg px-6 py-3.5 text-[17px] font-semibold text-ink">
                      Try a sample renewal
                    </Link>
                  </Magnetic>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <span className="mono text-[11px] tracking-[0.1em] text-dim">SAMPLE RESULT · EST. SAVING PER YEAR</span>
                <span className="disp text-[clamp(3.5rem,9vw,5.5rem)] font-bold leading-none text-buyer">
                  <CountUp to={432} prefix="$" />
                </span>
                <span className="mono text-xs text-muted">3 of 3 claims verified</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mono mt-16 flex w-full max-w-[1160px] flex-wrap justify-between gap-4 text-xs text-dim">
        <span>Built for the Agent Builders Hackathon</span>
        <span>Simulated rehearsal partner, not a prediction.</span>
      </footer>
    </div>
  );
}
