"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Magnetic, SplitText } from "@/components/motion";
import { supabaseBrowser } from "@/lib/supabase";

function SignIn() {
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get("next") ?? "/new";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/new";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u && !u.is_anonymous && u.email) setMe(u.email);
    });
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
      setSent(email.trim().toLowerCase());
      setWait(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    setMe(null);
    router.refresh();
  }

  return (
    <div className="flex justify-center px-5 pb-24 pt-16 sm:px-8">
      <div className="flex w-full max-w-[520px] flex-col gap-7">
        <div className="flex flex-col gap-3">
          <span className="mono text-xs uppercase tracking-[0.12em] text-buyer">Sign in</span>
          <h1 className="disp text-[clamp(2.2rem,6vw,3rem)] font-bold leading-[1.05]">
            <SplitText text="We will email you a link." />
          </h1>
          <p className="text-[17px] leading-relaxed text-muted">
            No password. Signing in lets us email you the finished rehearsal. Samples work without signing in.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-line bg-panel/80 p-6 backdrop-blur-md">
          <AnimatePresence mode="wait" initial={false}>
            {me ? (
              <motion.div key="me" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <div className="disp text-xl font-bold">You are signed in</div>
                <div className="mono break-all text-sm text-muted">{me}</div>
                <div className="flex flex-wrap gap-3">
                  <Link href={next} className="inline-flex min-h-11 items-center rounded-xl bg-buyer px-5 py-2.5 font-semibold text-[#06231d]">Continue</Link>
                  <button onClick={signOut} className="min-h-11 rounded-xl border border-line px-5 py-2.5 font-semibold transition hover:border-vendor hover:text-vendor">Sign out</button>
                </div>
              </motion.div>
            ) : sent ? (
              <motion.div key="sent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-start gap-4">
                <motion.span
                  initial={{ scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14 }}
                  className="flex size-14 items-center justify-center rounded-2xl bg-buyer text-2xl text-[#06231d]"
                  aria-hidden
                >
                  ✉
                </motion.span>
                <div className="disp text-2xl font-bold">Check your inbox</div>
                <p className="leading-relaxed text-muted">
                  We sent a sign-in link to <span className="text-fg">{sent}</span>. Open it on this device. It works once. If you do not see it, look in spam.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <button onClick={() => submit()} disabled={wait > 0 || busy} className="min-h-11 rounded-xl border border-line px-5 py-2.5 font-semibold transition hover:border-buyer disabled:opacity-50">
                    {wait > 0 ? `Send again in ${wait}s` : busy ? "Sending..." : "Send again"}
                  </button>
                  <button onClick={() => { setSent(null); setError(null); }} className="text-sm text-muted transition hover:text-fg">Use a different email</button>
                </div>
                {error && <div role="alert" className="text-sm text-[#ff8b82]">{error}</div>}
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <label htmlFor="email" className="disp text-xl font-bold">Your email</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="rounded-xl border border-[#2b3a4f] bg-ink px-4 py-3.5 text-[17px] outline-none transition placeholder:text-dim focus:border-buyer focus:shadow-[0_0_0_4px_rgba(62,224,193,0.12)]"
                />
                {error && <div role="alert" className="text-sm text-[#ff8b82]">{error}</div>}
                <Magnetic>
                  <button disabled={busy || !email.includes("@")} className="shine inline-flex min-h-12 items-center rounded-2xl bg-buyer px-7 py-3.5 text-[17px] font-semibold text-[#06231d] disabled:opacity-50">
                    {busy ? "Sending..." : "Email me a sign-in link"}
                  </button>
                </Magnetic>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <Link href="/new" className="mono text-sm text-muted transition hover:text-buyer">Or try a sample without signing in →</Link>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
