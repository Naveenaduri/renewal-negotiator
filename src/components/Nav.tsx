"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Who = { email: string } | null; // null: nobody, or a guest session (samples work without signing in)

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [who, setWho] = useState<Who>(null);
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false); // phone menu
  const close = () => setOpen(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    const read = (u?: { email?: string | null; is_anonymous?: boolean } | null) =>
      setWho(u && !u.is_anonymous && u.email ? { email: u.email } : null);
    sb.auth.getSession().then(({ data }) => read(data.session?.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => read(s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    setOpen(false);
    setLeaving(true);
    await supabaseBrowser().auth.signOut();
    setLeaving(false);
    setWho(null);
    router.push("/");
    router.refresh();
  }

  const onNew = path.startsWith("/new");
  const onPricing = path.startsWith("/pricing");

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="sticky top-0 z-30 flex justify-center px-3 pt-3 sm:px-8 sm:pt-4"
    >
      <div className="relative w-full max-w-[1160px]">
        <nav className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line/80 bg-ink/60 px-3 py-2 backdrop-blur-xl sm:gap-4 sm:px-4 sm:py-2.5">
          <Link href="/" onClick={close} className="flex min-w-0 items-center gap-2.5">
            <motion.span
              whileHover={{ rotate: 180 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              className="block size-7 shrink-0 rounded-lg"
              style={{ background: "linear-gradient(135deg,#3ee0c1 0 50%,#ff9966 50% 100%)" }}
            />
            <span className="disp truncate whitespace-nowrap text-base font-bold sm:text-lg">Renewal Negotiator</span>
          </Link>

          {/* Tablet and desktop */}
          <div className="hidden items-center gap-1 whitespace-nowrap text-[15px] text-muted sm:flex">
            <Link href="/new" className="relative rounded-lg px-3 py-2 transition-colors hover:text-fg">
              {onNew && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-lg bg-panel2" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              <span className={onNew ? "text-fg" : ""}>New rehearsal</span>
            </Link>
            <Link href="/pricing" className={`rounded-lg px-3 py-2 transition-colors hover:text-fg ${onPricing ? "text-fg" : ""}`}>
              Pricing
            </Link>
            <AnimatePresence mode="wait" initial={false}>
              {who ? (
                <motion.div key="in" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="ml-2 flex items-center gap-2">
                  <span className="mono hidden max-w-[200px] truncate rounded-full border border-line px-3 py-2 text-xs text-fg lg:block" title={who.email}>{who.email}</span>
                  <button onClick={signOut} disabled={leaving} className="rounded-full border border-line px-4 py-2 text-fg transition hover:border-vendor hover:text-vendor disabled:opacity-60">
                    {leaving ? "Signing out..." : "Sign out"}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="out" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="ml-2">
                  <Link href="/signin" className="rounded-full border border-line px-4 py-2 text-fg transition hover:border-buyer hover:text-buyer">Sign in</Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Phone: menu button */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-fg sm:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </nav>

        {/* Phone: menu panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-x-0 top-full mt-2 flex flex-col gap-1 rounded-2xl border border-line/80 bg-ink/95 p-2 text-[16px] backdrop-blur-xl sm:hidden"
            >
              <Link href="/new" onClick={close} className={`flex min-h-12 items-center rounded-xl px-4 ${onNew ? "bg-panel2 text-fg" : "text-muted"}`}>
                New rehearsal
              </Link>
              <Link href="/pricing" onClick={close} className={`flex min-h-12 items-center rounded-xl px-4 ${onPricing ? "bg-panel2 text-fg" : "text-muted"}`}>
                Pricing
              </Link>
              {who ? (
                <>
                  <span className="mono truncate px-4 pt-2 text-xs text-dim" title={who.email}>{who.email}</span>
                  <button onClick={signOut} disabled={leaving} className="flex min-h-12 items-center rounded-xl px-4 text-left text-fg disabled:opacity-60">
                    {leaving ? "Signing out..." : "Sign out"}
                  </button>
                </>
              ) : (
                <Link href="/signin" onClick={close} className="flex min-h-12 items-center rounded-xl px-4 text-fg">
                  Sign in
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
