"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Magnetic, Reveal, SplitText } from "@/components/motion";
import { SAMPLES } from "@/lib/samples";
import { ensureSession, supabaseBrowser } from "@/lib/supabase";

const ICONS = [
  <path key="c" d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 8.5 4.5 4.5 0 0 1 17.5 18z" />,
  <path key="a" d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM9 4v16M3 10h6" />,
  <path key="b" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />,
];

export default function NewDeal() {
  const router = useRouter();
  // The box starts empty so people can paste their own email. Picking a sample types it in,
  // and the result stays fully editable.
  const [text, setText] = useState("");
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [review, setReview] = useState(true);
  const [vendorEmail, setVendorEmail] = useState("");
  const [suggested, setSuggested] = useState("");
  const [myEmail, setMyEmail] = useState<string | null>(null); // null for guests

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((c) => {
      setSuggested(c.suggestedVendorEmail ?? "");
      setVendorEmail((v) => v || c.suggestedVendorEmail || "");
    }).catch(() => {});
    supabaseBrowser().auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setMyEmail(u && !u.is_anonymous && u.email ? u.email.toLowerCase() : null);
    });
  }, []);
  const sameAddress = !!myEmail && vendorEmail.trim().toLowerCase() === myEmail;
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    box.current?.focus();
    return () => clearInterval(timer.current);
  }, []);

  function loadSample(id: string) {
    const sm = SAMPLES.find((x) => x.id === id)!;
    const full = `From: ${sm.from}
Subject: ${sm.subject}

${sm.body}`;
    clearInterval(timer.current);
    setSampleId(id);
    setTyping(true);
    setError(null);
    let n = 0;
    timer.current = setInterval(() => {
      n += 6;
      setText(full.slice(0, n));
      if (n >= full.length) {
        clearInterval(timer.current);
        setTyping(false);
      }
    }, 12);
  }

  function onEdit(v: string) {
    clearInterval(timer.current);
    setTyping(false);
    setSampleId(null);
    setText(v);
  }

  async function start() {
    setError(null);
    setLaunching(true);
    try {
      const token = await ensureSession();
      const r = await fetch("/api/runs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: text, review, vendorEmail }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.runId) throw new Error(j.error ?? "Something went wrong starting the rehearsal. Please try again.");
      router.push(`/run/${j.runId}`);
    } catch (e) {
      setLaunching(false);
      setError(e instanceof Error ? e.message : "We could not reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="flex justify-center px-5 pb-24 pt-14 sm:px-8">
      <div className="flex w-full max-w-[1160px] flex-col gap-9">
        <div className="flex flex-col gap-3">
          <span className="mono text-xs uppercase tracking-[0.12em] text-buyer">New deal</span>
          <h1 className="disp text-[clamp(2.2rem,5.5vw,3.2rem)] font-bold leading-[1.05]">
            <SplitText text="Bring a renewal to the rehearsal room." />
          </h1>
          <p className="max-w-[600px] text-[17px] leading-relaxed text-muted">
            Paste the renewal or quote email into the box, or load a sample and edit it. No sign-up needed.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-line bg-panel/80 p-6 backdrop-blur-md">
              <AnimatePresence>
                {launching && (
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    className="absolute inset-0 z-10 origin-top bg-gradient-to-b from-buyer/30 to-transparent"
                  />
                )}
              </AnimatePresence>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <label htmlFor="email" className="disp text-xl font-bold">The email</label>
                {sampleId ? (
                  <motion.span key={sampleId} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mono rounded-full border border-vendor/40 px-3 py-1 text-[11px] text-vendor">
                    Sample: {SAMPLES.find((x) => x.id === sampleId)?.label}
                  </motion.span>
                ) : text ? (
                  <button type="button" onClick={() => onEdit("")} className="mono text-[11px] text-dim transition hover:text-fg">Clear</button>
                ) : null}
              </div>
              <textarea
                id="email"
                ref={box}
                value={text}
                onChange={(e) => onEdit(e.target.value)}
                maxLength={8000}
                placeholder={"Paste the renewal or vendor-quote email here.\n\nOr load a sample on the right and edit it."}
                className="mono h-[340px] w-full resize-none rounded-2xl border border-[#2b3a4f] bg-ink p-5 text-sm leading-[1.7] text-[#d3dce8] outline-none transition focus:border-buyer focus:shadow-[0_0_0_4px_rgba(62,224,193,0.12)]"
              />
              <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-line bg-ink/60 p-4">
                <label htmlFor="vendor" className="font-semibold">Who plays the vendor?</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="vendor"
                    type="email"
                    inputMode="email"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    placeholder="vendor@example.com"
                    className="min-w-[240px] flex-1 rounded-xl border border-[#2b3a4f] bg-ink px-4 py-3 text-[15px] outline-none transition placeholder:text-dim focus:border-vendor"
                  />
                  {suggested && vendorEmail.trim().toLowerCase() !== suggested.toLowerCase() && (
                    <button type="button" onClick={() => setVendorEmail(suggested)} className="mono text-xs text-vendor underline decoration-dotted underline-offset-2">Use suggested</button>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  We suggest your personal inbox. After you approve the draft, the negotiation email goes there and you reply as the vendor, with a lower price. Use a different address from the one you sign in with. If they match, the vendor&apos;s replies, your sign-in link and your results all land in one inbox and you cannot tell them apart.
                </p>
                {sameAddress && <p role="alert" className="text-sm text-[#ffb3ad]">This is the address you are signed in with. Choose another inbox for the vendor, or sign out and continue as a guest.</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={review}
                onClick={() => setReview((v) => !v)}
                className="mt-4 flex w-full items-center gap-3.5 rounded-2xl border border-line bg-ink/60 p-3.5 text-left transition hover:border-buyer/50"
              >
                <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${review ? "bg-buyer" : "bg-line"}`}>
                  <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={`absolute top-1 size-4 rounded-full bg-white ${review ? "right-1" : "left-1"}`} />
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{review ? "Review each step" : "Autopilot"}</span>
                  <span className="text-sm text-muted">
                    {review ? "The agents pause after reading, researching and each round so you can approve or steer." : "The agents run straight through to the final email."}
                  </span>
                </span>
              </button>
              {error && (
                <motion.div role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-4 py-3 text-sm text-[#ffb3ad]">
                  {error}
                </motion.div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <span className="mono max-w-[330px] text-xs leading-relaxed text-dim">
                  Rehearsal runs on our servers. You can close this tab and come back.
                </span>
                <Magnetic>
                  <button
                    onClick={start}
                    disabled={launching || typing || text.trim().length < 30 || sameAddress || !vendorEmail.includes("@")}
                    className="shine inline-flex min-h-12 items-center gap-2.5 rounded-2xl bg-buyer px-7 py-4 text-[17px] font-semibold text-[#06231d] shadow-[0_0_30px_rgba(62,224,193,0.3)] transition disabled:opacity-50"
                  >
                    {launching ? "Opening the room..." : "Start the rehearsal"}
                    <motion.svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                      animate={{ x: launching ? 40 : [0, 5, 0], opacity: launching ? 0 : 1 }}
                      transition={launching ? { duration: 0.5 } : { duration: 1.6, repeat: Infinity }}
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </motion.svg>
                  </button>
                </Magnetic>
              </div>
            </div>
          </Reveal>

          <div className="flex flex-col gap-3.5">
            <Reveal delay={0.1}><div className="disp text-xl font-bold">Or load a sample</div></Reveal>
            {SAMPLES.map((sm, idx) => {
              const active = sampleId === sm.id;
              return (
                <Reveal key={sm.id} delay={0.15 + idx * 0.08}>
                  <motion.button
                    onClick={() => loadSample(sm.id)}
                    whileHover={{ x: 6 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative flex w-full items-start gap-3.5 rounded-2xl border border-line bg-panel/80 p-4 text-left backdrop-blur-md"
                  >
                    {active && (
                      <motion.span
                        layoutId="sample-active"
                        className="absolute inset-0 rounded-2xl border-[1.5px] border-buyer bg-buyer/10"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className={`relative flex size-11 flex-none items-center justify-center rounded-xl transition-colors ${active ? "bg-buyer text-[#06231d]" : "bg-panel2 text-muted"}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[idx]}</svg>
                    </span>
                    <span className="relative flex min-w-0 flex-col gap-1">
                      <span className="text-[17px] font-semibold">{sm.label}</span>
                      <span className="text-sm leading-snug text-muted">{sm.blurb}</span>
                    </span>
                  </motion.button>
                </Reveal>
              );
            })}
            <p className="mono px-1 text-[11px] leading-relaxed text-dim">
              The emails and their prices are made up. The pricing the agents research is real and public.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
